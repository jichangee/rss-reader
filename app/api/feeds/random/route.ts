import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 随机获取10个其他用户订阅但当前用户未订阅的RSS源
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 获取当前用户已订阅的RSS URL
    const userFeeds = await prisma.feed.findMany({
      where: { userId: user.id },
      select: { url: true },
    })

    const userFeedUrls = new Set(userFeeds.map(feed => feed.url))

    // 获取其他用户的订阅，排除当前用户已订阅的
    const otherUserFeeds = await prisma.feed.findMany({
      where: {
        userId: { not: user.id },
        url: { notIn: Array.from(userFeedUrls) },
      },
      select: {
        url: true,
        title: true,
        description: true,
        link: true,
        imageUrl: true,
      },
      distinct: ['url'], // 去重，相同的URL只保留一份
    })

    // 应用层面的去重，确保URL唯一（处理可能的重复情况）
    const uniqueFeedsMap = new Map<string, typeof otherUserFeeds[0]>()
    for (const feed of otherUserFeeds) {
      // 标准化URL（去除尾部斜杠和空格，统一大小写）
      const normalizedUrl = feed.url.trim().toLowerCase().replace(/\/+$/, '')
      if (!uniqueFeedsMap.has(normalizedUrl)) {
        uniqueFeedsMap.set(normalizedUrl, feed)
      }
    }
    const uniqueFeeds = Array.from(uniqueFeedsMap.values())

    // 随机选择10个RSS源
    const shuffled = uniqueFeeds.sort(() => 0.5 - Math.random())
    const selectedFeeds = shuffled.slice(0, 10)

    if (selectedFeeds.length === 0) {
      return NextResponse.json({
        error: "暂无可推荐的订阅源"
      }, { status: 404 })
    }

    type SuccessResult = {
      success: boolean
      feed: {
        id: string
        url: string
        title: string
        description: string | null
        link: string | null
        imageUrl: string | null
        enableTranslation: boolean
        userId: string
        createdAt: Date
        updatedAt: Date
        unreadCount: number
      }
      url: string
    }

    const results: SuccessResult[] = []
    const errors: Array<{ url: string; error: string }> = []

    // 批量处理订阅（限制并发数为5）
    const batchSize = 5
    for (let i = 0; i < selectedFeeds.length; i += batchSize) {
      const batch = selectedFeeds.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (feedInfo) => {
          // 再次检查是否已订阅（防止并发问题）
          const existingFeed = await prisma.feed.findUnique({
            where: {
              userId_url: {
                userId: user.id,
                url: feedInfo.url,
              },
            },
          })

          if (existingFeed) {
            throw new Error("已订阅此RSS")
          }

          // 解析RSS feed (10秒超时)
          let feed
          try {
            feed = await parseRSSWithTimeout(feedInfo.url, 10000)
          } catch (error) {
            const errorMessage = error instanceof Error && error.message === 'RSS解析超时'
              ? "RSS解析超时"
              : "无效的RSS链接"
            throw new Error(errorMessage)
          }

          // 创建订阅
          const newFeed = await prisma.feed.create({
            data: {
              url: feedInfo.url,
              title: feed.title || feedInfo.title || "未命名订阅",
              description: feed.description || feedInfo.description,
              link: feed.link || feedInfo.link,
              imageUrl: feed.image?.url || feedInfo.imageUrl,
              enableTranslation: false, // 随机订阅默认不启用翻译
              userId: user.id,
            },
          })

          // 保存文章（最多保存20篇）
          if (feed.items && feed.items.length > 0) {
            const articles = feed.items.slice(0, 20).map((item: any) => ({
              feedId: newFeed.id,
              title: item.title || "无标题",
              link: item.link || "",
              content: item.content,
              contentSnippet: item.contentSnippet,
              pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
              author: item.creator || item.author,
              guid: item.guid || item.link || `${newFeed.id}-${Date.now()}`,
            }))

            await prisma.article.createMany({
              data: articles,
              skipDuplicates: true,
            })
          }

          // 计算未读文章数
          const unreadCount = await prisma.article.count({
            where: {
              feedId: newFeed.id,
              readBy: {
                none: {
                  userId: user.id,
                },
              },
            },
          })

          return {
            success: true,
            feed: {
              ...newFeed,
              unreadCount,
            },
            url: feedInfo.url,
          }
        })
      )

      // 处理批次结果
      batchResults.forEach((result, index) => {
        const feedInfo = batch[index]
        if (result.status === "fulfilled") {
          if (result.value && result.value.success) {
            results.push(result.value)
          } else {
            errors.push({
              url: feedInfo.url,
              error: "添加失败",
            })
          }
        } else {
          const errorMessage = result.reason instanceof Error
            ? result.reason.message
            : typeof result.reason === 'string'
            ? result.reason
            : "添加失败"
          errors.push({
            url: feedInfo.url,
            error: errorMessage,
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: selectedFeeds.length,
        success: results.length,
        failed: errors.length,
      },
    })
  } catch (error) {
    console.error("随机订阅失败:", error)
    return NextResponse.json({ error: "随机订阅失败" }, { status: 500 })
  }
}