import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 刷新订阅
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取请求体中的 feedIds
    let feedIds: string[] | undefined
    try {
      const body = await req.json()
      feedIds = body.feedIds
    } catch (e) {
      // 忽略 JSON 解析错误，视为全量刷新
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { 
        feeds: {
          where: feedIds ? { id: { in: feedIds } } : undefined
        } 
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const minRefreshInterval = 5 * 60 * 1000 // 5分钟
    const now = Date.now()

    // 过滤出需要刷新的 feed
    const feedsToRefresh = user.feeds.filter(feed => {
      if (!feed.lastRefreshedAt) return true
      return now - new Date(feed.lastRefreshedAt).getTime() >= minRefreshInterval
    })

    // 并行处理所有 feed 的刷新
    const refreshResults = await Promise.allSettled(
      feedsToRefresh.map(async (feed) => {
        try {
          const parsedFeed = await parseRSSWithTimeout(feed.url, 10000)
          
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
          let articleInsertPromise = Promise.resolve(0)
          if (parsedFeed.items && parsedFeed.items.length > 0) {
            // 先查询已存在的文章 guid，减少重复插入
            const existingGuids = await prisma.article.findMany({
              where: { feedId: feed.id },
              select: { guid: true },
            })
            const existingGuidSet = new Set(existingGuids.map(a => a.guid))

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

            // 只在有新文章时插入
            if (newArticles.length > 0) {
              articleInsertPromise = prisma.article.createMany({
                data: newArticles,
                skipDuplicates: true,
              }).then(() => newArticles.length)
            }
          }

          // 并行执行更新和插入
          await Promise.all([feedUpdatePromise, articleInsertPromise])

          return { success: true, feedId: feed.id }
        } catch (error) {
          console.error(`刷新订阅 ${feed.title} 失败:`, error)
          throw error
        }
      })
    )

    // 统计结果
    const successCount = refreshResults.filter(r => r.status === 'fulfilled').length
    const failCount = refreshResults.filter(r => r.status === 'rejected').length
    const skippedCount = user.feeds.length - feedsToRefresh.length

    return NextResponse.json({ 
      success: true, 
      successCount, 
      failCount,
      skippedCount,
      total: user.feeds.length 
    })
  } catch (error) {
    console.error("刷新订阅失败:", error)
    return NextResponse.json({ error: "刷新订阅失败" }, { status: 500 })
  }
}

