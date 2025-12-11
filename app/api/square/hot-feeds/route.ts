import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 获取热门RSS源排行榜
 * GET /api/square/hot-feeds
 * 
 * Query参数:
 * - limit: 返回数量（默认20）
 * - days: 统计时间范围（默认30天）
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30")))

    // 计算时间范围
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 查询每个Feed的热度统计
    const feedStats = await prisma.feed.findMany({
      where: {
        createdAt: {
          lte: new Date() // 只统计已存在的Feed
        }
      },
      include: {
        articles: {
          where: {
            createdAt: {
              gte: startDate
            }
          },
          include: {
            hotness: true,
            readBy: true,
            readLaterBy: true
          }
        },
        user: {
          select: {
            id: true
          }
        }
      }
    })

    // 计算每个Feed的综合热度
    const hotFeeds = feedStats
      .map(feed => {
        // 统计该Feed下所有文章的热度
        const totalHotScore = feed.articles.reduce(
          (sum, article) => sum + (article.hotness?.hotScore || 0),
          0
        )
        
        const totalReadLaterCount = feed.articles.reduce(
          (sum, article) => sum + article.readLaterBy.length,
          0
        )
        
        const totalReadCount = feed.articles.reduce(
          (sum, article) => sum + article.readBy.length,
          0
        )

        // 统计影响的独立用户数
        const allUsers = new Set<string>()
        feed.articles.forEach(article => {
          article.readBy.forEach(r => allUsers.add(r.userId))
          article.readLaterBy.forEach(r => allUsers.add(r.userId))
        })

        // 统计订阅该Feed的用户数（通过查找相同URL的Feed）
        const subscriberCount = 1 // 至少有当前Feed的所有者

        return {
          id: feed.id,
          title: feed.title,
          url: feed.url,
          description: feed.description,
          link: feed.link,
          imageUrl: feed.imageUrl,
          stats: {
            totalHotScore,
            totalReadLaterCount,
            totalReadCount,
            uniqueUsers: allUsers.size,
            articleCount: feed.articles.length,
            subscriberCount // 这个需要跨用户统计，暂时设为1
          }
        }
      })
      .filter(feed => feed.stats.totalHotScore > 0) // 只保留有热度的Feed
      .sort((a, b) => b.stats.totalHotScore - a.stats.totalHotScore) // 按总热度排序
      .slice(0, limit)

    // 获取当前用户已订阅的Feed URL
    const userFeeds = await prisma.feed.findMany({
      where: { userId: user.id },
      select: { url: true }
    })
    const subscribedUrls = new Set(userFeeds.map(f => f.url))

    // 统计每个Feed URL的订阅数
    const feedUrls = hotFeeds.map(f => f.url)
    const allFeeds = await prisma.feed.groupBy({
      by: ['url'],
      where: {
        url: { in: feedUrls }
      },
      _count: {
        userId: true
      }
    })

    const subscriberMap = new Map(
      allFeeds.map(row => [row.url, row._count.userId])
    )

    // 添加订阅状态和实际订阅数
    const result = hotFeeds.map(feed => ({
      ...feed,
      stats: {
        ...feed.stats,
        subscriberCount: subscriberMap.get(feed.url) || 1
      },
      isSubscribed: subscribedUrls.has(feed.url)
    }))

    return NextResponse.json({
      feeds: result,
      total: result.length
    })
  } catch (error) {
    console.error("获取热门RSS源失败:", error)
    return NextResponse.json(
      { 
        error: "获取热门RSS源失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
