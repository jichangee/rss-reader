import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// Vercel Cron Job: 定时刷新所有用户的RSS订阅
export async function GET(req: Request) {
  try {
    // 验证Vercel Cron Secret
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("CRON_SECRET 环境变量未设置")
      return NextResponse.json({ error: "服务器配置错误" }, { status: 500 })
    }

    // 验证授权
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("Cron认证失败")
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    console.log("============ Cron Job 开始 ============")
    const startTime = Date.now()

    // 获取所有用户及其订阅
    const users = await prisma.user.findMany({
      include: {
        feeds: true,
      },
    })

    console.log(`找到 ${users.length} 个用户`)

    const minRefreshInterval = 1 * 60 * 60 * 1000 // 1小时
    const now = Date.now()

    let totalFeedsProcessed = 0
    let totalFeedsSkipped = 0
    let totalSuccess = 0
    let totalFailed = 0
    let totalNewArticles = 0

    // 为每个用户刷新订阅
    for (const user of users) {
      // 过滤出需要刷新的 feed
      const feedsToRefresh = user.feeds.filter(feed => {
        if (!feed.lastRefreshedAt) return true
        return now - new Date(feed.lastRefreshedAt).getTime() >= minRefreshInterval
      })

      totalFeedsSkipped += user.feeds.length - feedsToRefresh.length

      if (feedsToRefresh.length === 0) {
        console.log(`用户 ${user.email}: 没有需要刷新的订阅`)
        continue
      }

      console.log(`用户 ${user.email}: 刷新 ${feedsToRefresh.length} 个订阅`)

      // 并行处理该用户的所有 feed 刷新
      const refreshResults = await Promise.allSettled(
        feedsToRefresh.map(async (feed) => {
          try {
            const parsedFeed = await parseRSSWithTimeout(feed.url, 10000)

            // 准备更新数据
            const updateData: any = {
              lastRefreshedAt: new Date(),
            }

            if (parsedFeed.title && parsedFeed.title !== feed.title) {
              updateData.title = parsedFeed.title
            }
            if (parsedFeed.description !== undefined && parsedFeed.description !== feed.description) {
              updateData.description = parsedFeed.description
            }
            if (parsedFeed.link !== undefined && parsedFeed.link !== feed.link) {
              updateData.link = parsedFeed.link
            }
            const newImageUrl = parsedFeed.image?.url
            if (newImageUrl !== undefined && newImageUrl !== feed.imageUrl) {
              updateData.imageUrl = newImageUrl
            }

            // 更新 feed 信息
            const feedUpdatePromise = Object.keys(updateData).length > 1
              ? prisma.feed.update({
                  where: { id: feed.id },
                  data: updateData,
                })
              : Promise.resolve(feed)

            // 处理文章
            let newArticlesCount = 0
            let articleInsertPromise = Promise.resolve(0)
            
            if (parsedFeed.items && parsedFeed.items.length > 0) {
              // 查询已存在的文章 guid
              const existingGuids = await prisma.article.findMany({
                where: { feedId: feed.id },
                select: { guid: true },
              })
              const existingGuidSet = new Set(existingGuids.map(a => a.guid))

              // 解析关键词过滤设置
              let filterKeywords: string[] = []
              if (feed.filterKeywords) {
                try {
                  filterKeywords = JSON.parse(feed.filterKeywords)
                } catch (e) {
                  // 忽略解析错误
                }
              }

              // 过滤出新文章
              const newArticles = parsedFeed.items
                .slice(0, 20)
                .map((item: any) => {
                  const guid = item.guid || item.link || `${feed.id}-${item.pubDate || Date.now()}`
                  return {
                    feedId: feed.id,
                    title: item.title || "无标题",
                    link: item.link || "",
                    content: item.content,
                    contentSnippet: item.contentSnippet,
                    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
                    author: item.creator || item.author,
                    guid,
                  }
                })
                .filter((article: any) => !existingGuidSet.has(article.guid))
                .filter((article: any) => {
                  // 如果没有设置过滤关键词，则保留所有文章
                  if (filterKeywords.length === 0) return true
                  
                  // 检查标题和内容是否包含任何关键词（不区分大小写）
                  const titleLower = (article.title || "").toLowerCase()
                  const contentLower = (article.content || "").toLowerCase()
                  const snippetLower = (article.contentSnippet || "").toLowerCase()
                  
                  // 如果包含任一关键词，则过滤掉该文章
                  for (const keyword of filterKeywords) {
                    const keywordLower = keyword.toLowerCase()
                    if (titleLower.includes(keywordLower) || 
                        contentLower.includes(keywordLower) || 
                        snippetLower.includes(keywordLower)) {
                      return false
                    }
                  }
                  return true
                })

              // 插入新文章
              if (newArticles.length > 0) {
                newArticlesCount = newArticles.length
                articleInsertPromise = prisma.article.createMany({
                  data: newArticles,
                  skipDuplicates: true,
                }).then(() => newArticlesCount)
              }
            }

            // 并行执行更新和插入
            await Promise.all([feedUpdatePromise, articleInsertPromise])

            return { 
              success: true, 
              feedId: feed.id, 
              feedTitle: feed.title,
              newArticles: newArticlesCount 
            }
          } catch (error) {
            console.error(`刷新订阅 ${feed.title} 失败:`, error)
            throw error
          }
        })
      )

      // 统计该用户的结果
      const userSuccess = refreshResults.filter(r => r.status === 'fulfilled').length
      const userFailed = refreshResults.filter(r => r.status === 'rejected').length
      const userNewArticles = refreshResults
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r: any) => sum + (r.value.newArticles || 0), 0)

      totalFeedsProcessed += feedsToRefresh.length
      totalSuccess += userSuccess
      totalFailed += userFailed
      totalNewArticles += userNewArticles

      console.log(`用户 ${user.email}: 成功 ${userSuccess}, 失败 ${userFailed}, 新文章 ${userNewArticles}`)
    }

    const duration = Date.now() - startTime

    const summary = {
      executedAt: new Date().toISOString(),
      duration: `${duration}ms`,
      users: users.length,
      totalFeeds: totalFeedsProcessed,
      skippedFeeds: totalFeedsSkipped,
      successfulRefreshes: totalSuccess,
      failedRefreshes: totalFailed,
      newArticles: totalNewArticles,
    }

    console.log("============ Cron Job 完成 ============")
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error("Cron Job 执行失败:", error)
    return NextResponse.json({ 
      error: "Cron执行失败",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
