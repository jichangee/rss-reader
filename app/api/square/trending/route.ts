import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 获取热门文章列表
 * GET /api/square/trending
 * 
 * Query参数:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - days: 时间范围天数（默认30）
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 获取当前用户
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30")))

    // 计算时间范围
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 查询热门文章
    const skip = (page - 1) * limit
    
    const [hotArticles, totalCount] = await Promise.all([
      prisma.articleHotness.findMany({
        where: {
          article: {
            createdAt: {
              gte: startDate
            }
          },
          hotScore: {
            gt: 0
          }
        },
        include: {
          article: {
            include: {
              feed: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  imageUrl: true,
                  userId: true
                }
              },
              readBy: {
                where: { userId: user.id },
                select: { id: true }
              },
              readLaterBy: {
                where: { userId: user.id },
                select: { id: true }
              }
            }
          }
        },
        orderBy: [
          { hotScore: 'desc' },
          { lastCalculated: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.articleHotness.count({
        where: {
          article: {
            createdAt: {
              gte: startDate
            }
          },
          hotScore: {
            gt: 0
          }
        }
      })
    ])

    // 获取当前用户已订阅的所有Feed ID
    const userFeeds = await prisma.feed.findMany({
      where: { userId: user.id },
      select: { url: true }
    })
    const subscribedFeedUrls = new Set(userFeeds.map(f => f.url))

    // 格式化返回数据
    const articles = hotArticles.map(hotness => ({
      id: hotness.article.id,
      title: hotness.article.title,
      link: hotness.article.link,
      contentSnippet: hotness.article.contentSnippet,
      pubDate: hotness.article.pubDate,
      author: hotness.article.author,
      feed: {
        id: hotness.article.feed.id,
        title: hotness.article.feed.title,
        url: hotness.article.feed.url,
        imageUrl: hotness.article.feed.imageUrl
      },
      hotness: {
        readLaterCount: hotness.readLaterCount,
        readCount: hotness.readCount,
        uniqueUsers: hotness.uniqueUsers,
        hotScore: hotness.hotScore
      },
      isSubscribed: subscribedFeedUrls.has(hotness.article.feed.url),
      isReadLater: hotness.article.readLaterBy.length > 0,
      isRead: hotness.article.readBy.length > 0
    }))

    const hasMore = skip + hotArticles.length < totalCount

    return NextResponse.json({
      articles,
      pagination: {
        total: totalCount,
        page,
        limit,
        hasMore
      }
    })
  } catch (error) {
    console.error("获取热门文章失败:", error)
    return NextResponse.json(
      { 
        error: "获取热门文章失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
