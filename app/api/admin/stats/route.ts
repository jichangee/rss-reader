import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const admin = await checkAdmin()

    // 记录管理员操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_dashboard",
      targetType: "system",
      request
    })

    // 获取当前时间
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    // 并行查询所有统计数据
    const [
      // 用户统计
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      
      // 订阅源统计
      totalFeeds,
      newFeedsToday,
      
      // 文章统计
      totalArticles,
      newArticlesToday,
      
      // 阅读统计
      totalReads,
      readsToday,
      
      // 稍后读统计
      totalReadLater,
      
      // Webhook 统计
      totalWebhooks,
      
      // 活跃用户统计（有阅读记录的用户）
      dauUsers,
      wauUsers,
      mauUsers,
      
      // 热门订阅源
      topFeeds,
    ] = await Promise.all([
      // 用户统计
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      
      // 订阅源统计
      prisma.feed.count(),
      prisma.feed.count({ where: { createdAt: { gte: today } } }),
      
      // 文章统计
      prisma.article.count(),
      prisma.article.count({ where: { createdAt: { gte: today } } }),
      
      // 阅读统计
      prisma.readArticle.count(),
      prisma.readArticle.count({ where: { readAt: { gte: today } } }),
      
      // 稍后读统计
      prisma.readLater.count(),
      
      // Webhook 统计
      prisma.webhook.count(),
      
      // 活跃用户统计
      prisma.readArticle.groupBy({
        by: ['userId'],
        where: { readAt: { gte: today } },
        _count: true
      }).then(result => result.length),
      
      prisma.readArticle.groupBy({
        by: ['userId'],
        where: { readAt: { gte: weekAgo } },
        _count: true
      }).then(result => result.length),
      
      prisma.readArticle.groupBy({
        by: ['userId'],
        where: { readAt: { gte: monthAgo } },
        _count: true
      }).then(result => result.length),
      
      // 热门订阅源 Top 10
      prisma.feed.findMany({
        select: {
          id: true,
          title: true,
          url: true,
          imageUrl: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              articles: true
            }
          }
        },
        orderBy: {
          articles: {
            _count: 'desc'
          }
        },
        take: 10
      })
    ])

    // 获取最近7天的用户增长趋势
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const count = await prisma.user.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })
      
      last7Days.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    // 构建返回数据
    const stats = {
      users: {
        total: totalUsers,
        new: {
          today: newUsersToday,
          week: newUsersWeek,
          month: newUsersMonth
        },
        active: {
          dau: dauUsers,
          wau: wauUsers,
          mau: mauUsers
        },
        growth: last7Days
      },
      content: {
        feeds: {
          total: totalFeeds,
          new: newFeedsToday
        },
        articles: {
          total: totalArticles,
          new: newArticlesToday
        },
        topFeeds: topFeeds.map(feed => ({
          id: feed.id,
          title: feed.title,
          url: feed.url,
          imageUrl: feed.imageUrl,
          articleCount: feed._count.articles,
          owner: {
            id: feed.user.id,
            name: feed.user.name,
            email: feed.user.email
          }
        }))
      },
      activity: {
        reads: {
          total: totalReads,
          today: readsToday
        },
        readLater: totalReadLater,
        webhooks: totalWebhooks
      }
    }

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error("获取统计数据失败:", error)
    return NextResponse.json(
      { error: error.message || "获取统计数据失败" },
      { status: error.message === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
