import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 定时任务：汇总每日统计数据
 * 建议每天凌晨 1:00 执行
 * Vercel Cron: 0 1 * * *
 */
export async function GET(request: Request) {
  try {
    // 验证 Cron Secret
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] 开始汇总统计数据...")

    // 计算昨天的日期
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const startOfYesterday = yesterday
    const endOfYesterday = new Date(yesterday)
    endOfYesterday.setHours(23, 59, 59, 999)

    // 检查是否已经存在昨天的统计数据
    const existing = await prisma.systemStats.findUnique({
      where: { date: yesterday }
    })

    if (existing) {
      console.log("[CRON] 昨天的统计数据已存在，跳过")
      return NextResponse.json({ 
        message: "Statistics already aggregated",
        date: yesterday.toISOString()
      })
    }

    // 计算前一天的日期（用于计算新增）
    const dayBeforeYesterday = new Date(yesterday)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1)

    // 并行查询所有统计数据
    const [
      // 总数统计
      totalUsers,
      totalFeeds,
      totalArticles,
      totalReads,
      
      // 昨天新增统计
      newUsers,
      newFeeds,
      newArticles,
      newReads,
      
      // 昨天活跃用户（有阅读行为的用户）
      activeUserIds,
    ] = await Promise.all([
      // 总数统计
      prisma.user.count({
        where: { createdAt: { lte: endOfYesterday } }
      }),
      prisma.feed.count({
        where: { createdAt: { lte: endOfYesterday } }
      }),
      prisma.article.count({
        where: { createdAt: { lte: endOfYesterday } }
      }),
      prisma.readArticle.count({
        where: { readAt: { lte: endOfYesterday } }
      }),
      
      // 昨天新增统计
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
          }
        }
      }),
      prisma.feed.count({
        where: {
          createdAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
          }
        }
      }),
      prisma.article.count({
        where: {
          createdAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
          }
        }
      }),
      prisma.readArticle.count({
        where: {
          readAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
          }
        }
      }),
      
      // 昨天活跃用户
      prisma.readArticle.groupBy({
        by: ['userId'],
        where: {
          readAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
          }
        }
      }).then(result => result.length)
    ])

    // 创建统计记录
    const stats = await prisma.systemStats.create({
      data: {
        date: yesterday,
        totalUsers,
        newUsers,
        activeUsers: activeUserIds,
        totalFeeds,
        newFeeds,
        totalArticles,
        newArticles,
        totalReads,
        newReads
      }
    })

    // 同时汇总用户活跃度数据
    const usersWithActivity = await prisma.readArticle.groupBy({
      by: ['userId'],
      where: {
        readAt: {
          gte: startOfYesterday,
          lte: endOfYesterday
        }
      },
      _count: {
        _all: true
      }
    })

    // 批量创建用户活跃度记录
    if (usersWithActivity.length > 0) {
      await prisma.userActivity.createMany({
        data: usersWithActivity.map(activity => ({
          userId: activity.userId,
          date: yesterday,
          actions: activity._count._all,
          articlesRead: activity._count._all
        })),
        skipDuplicates: true
      })
    }

    // 更新用户的最后活跃时间
    const activeUserIdList = usersWithActivity.map(u => u.userId)
    if (activeUserIdList.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: { in: activeUserIdList }
        },
        data: {
          lastActiveAt: endOfYesterday
        }
      })
    }

    console.log("[CRON] 统计数据汇总完成:", {
      date: yesterday.toISOString(),
      totalUsers,
      newUsers,
      activeUsers: activeUserIds,
      totalArticles,
      newArticles
    })

    return NextResponse.json({
      success: true,
      date: yesterday.toISOString(),
      stats: {
        totalUsers,
        newUsers,
        activeUsers: activeUserIds,
        totalFeeds,
        newFeeds,
        totalArticles,
        newArticles,
        totalReads,
        newReads
      }
    })
  } catch (error) {
    console.error("[CRON] 统计数据汇总失败:", error)
    return NextResponse.json(
      { error: "Failed to aggregate statistics" },
      { status: 500 }
    )
  }
}
