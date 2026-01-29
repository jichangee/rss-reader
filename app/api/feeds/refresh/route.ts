import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 刷新订阅 - 同步版本
export async function POST(req: Request) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户刷新间隔限制（10分钟）
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, lastRefreshRequestAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const MIN_REFRESH_INTERVAL = 10 * 60 * 1000 // 10分钟
    const now = Date.now()

    // 获取请求体中的 feedIds 和 forceRefresh
    let feedIds: string[] | undefined
    let forceRefresh: boolean = false
    try {
      const body = await req.json()
      feedIds = body.feedIds
      forceRefresh = body.forceRefresh === true
    } catch (e) {
      // 忽略 JSON 解析错误，视为全量刷新
    }

    // 如果 forceRefresh 为 false，检查刷新间隔限制
    if (!forceRefresh && user.lastRefreshRequestAt) {
      const timeSinceLastRefresh = now - new Date(user.lastRefreshRequestAt).getTime()
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const remainingMinutes = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000))
        return NextResponse.json({ 
          error: `刷新过于频繁，请等待 ${remainingMinutes} 分钟后再试`,
          remainingMinutes 
        }, { status: 429 })
      }
    }

    // 更新用户最后刷新请求时间和最后活跃时间
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastRefreshRequestAt: new Date(),
        lastActiveAt: new Date(),
      },
    })

    // 获取用户的所有订阅
    const userWithFeeds = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { 
        feeds: {
          where: feedIds ? { id: { in: feedIds } } : undefined
        } 
      },
    })

    if (!userWithFeeds) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const minRefreshInterval = 5 * 60 * 1000 // 5分钟

    // 过滤出需要刷新的 feed
    // 如果 forceRefresh 为 true，则忽略时间限制
    const feedsToRefresh = userWithFeeds.feeds.filter(feed => {
      if (forceRefresh) return true // 强制刷新时，忽略时间限制
      if (!feed.lastRefreshedAt) return true
      return now - new Date(feed.lastRefreshedAt).getTime() >= minRefreshInterval
    })

    console.log(`同步刷新开始: ${feedsToRefresh.length} 个订阅需要刷新${forceRefresh ? ' (强制刷新)' : ''}`)

    // 并行处理所有 feed 的刷新
    const refreshResults = await Promise.allSettled(
      feedsToRefresh.map(async (feed) => {
        try {
          // 单个订阅源超时设为 8 秒
          const parsedFeed = await parseRSSWithTimeout(feed.url, 8000)
          
          // 准备更新数据，只在信息真正改变时才更新
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

          // 批量更新 feed 信息（如果有变化）
          const feedUpdatePromise = Object.keys(updateData).length > 1
            ? prisma.feed.update({
                where: { id: feed.id },
                data: updateData,
              })
            : Promise.resolve(feed)

          // 处理文章
          let newArticlesCount = 0
          if (parsedFeed.items && parsedFeed.items.length > 0) {
            // 先查询已存在的文章 guid，减少重复插入
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

            // 只在有新文章时插入
            if (newArticles.length > 0) {
              await prisma.article.createMany({
                data: newArticles,
                skipDuplicates: true,
              })
              newArticlesCount = newArticles.length
            }
          }

          // 执行 feed 更新
          await feedUpdatePromise

          return { success: true, feedId: feed.id, newArticlesCount }
        } catch (error) {
          console.error(`刷新订阅 ${feed.title} 失败:`, error)
          throw error
        }
      })
    )

    // 统计结果
    const successCount = refreshResults.filter(r => r.status === 'fulfilled').length
    const failedCount = refreshResults.filter(r => r.status === 'rejected').length
    
    // 统计新增文章总数
    let totalNewArticlesCount = 0
    refreshResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.newArticlesCount) {
        totalNewArticlesCount += result.value.newArticlesCount
      }
    })

    const totalTime = Date.now() - startTime

    console.log(`同步刷新完成: 成功 ${successCount}, 失败 ${failedCount}, 新增文章 ${totalNewArticlesCount}, 耗时 ${totalTime}ms`)

    return NextResponse.json({
      success: true,
      refreshedCount: successCount,
      newArticlesCount: totalNewArticlesCount,
      failedCount,
      totalTime,
    })
  } catch (error) {
    console.error("刷新失败:", error)
    const totalTime = Date.now() - startTime
    return NextResponse.json({ 
      error: "刷新失败",
      totalTime 
    }, { status: 500 })
  }
}

