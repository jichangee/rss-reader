import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 定时任务：每日维护任务（合并多个任务以节省Cron配额）
 * 包含：
 * 1. 汇总统计数据
 * 2. 清理旧文章
 * 3. 计算文章热度
 * 
 * 建议每天凌晨 2:00 执行
 * Vercel Cron: 0 2 * * *
 */
export async function GET(request: Request) {
  try {
    // 验证 Cron Secret
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("CRON_SECRET 环境变量未设置")
      return NextResponse.json({ error: "服务器配置错误" }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("Cron认证失败")
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    console.log("============ 每日维护任务开始 ============")
    const maintenanceStartTime = Date.now()

    const results = {
      stats: null as any,
      cleanup: null as any,
      hotness: null as any,
    }

    // ==================== 任务1: 汇总统计数据 ====================
    console.log("\n[1/3] 开始汇总统计数据...")
    const statsStartTime = Date.now()
    
    try {
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

      if (!existing) {
        // 并行查询所有统计数据
        const [
          totalUsers, totalFeeds, totalArticles, totalReads,
          newUsers, newFeeds, newArticles, newReads, activeUserIds,
        ] = await Promise.all([
          prisma.user.count({ where: { createdAt: { lte: endOfYesterday } } }),
          prisma.feed.count({ where: { createdAt: { lte: endOfYesterday } } }),
          prisma.article.count({ where: { createdAt: { lte: endOfYesterday } } }),
          prisma.readArticle.count({ where: { readAt: { lte: endOfYesterday } } }),
          prisma.user.count({ where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } } }),
          prisma.feed.count({ where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } } }),
          prisma.article.count({ where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } } }),
          prisma.readArticle.count({ where: { readAt: { gte: startOfYesterday, lte: endOfYesterday } } }),
          prisma.readArticle.groupBy({
            by: ['userId'],
            where: { readAt: { gte: startOfYesterday, lte: endOfYesterday } }
          }).then(result => result.length)
        ])

        await prisma.systemStats.create({
          data: {
            date: yesterday,
            totalUsers, newUsers, activeUsers: activeUserIds,
            totalFeeds, newFeeds,
            totalArticles, newArticles,
            totalReads, newReads
          }
        })

        results.stats = { totalUsers, newUsers, activeUsers: activeUserIds, totalArticles, newArticles }
        console.log(`✓ 统计汇总完成 (${Date.now() - statsStartTime}ms)`)
      } else {
        console.log("⊘ 昨天的统计数据已存在，跳过")
        results.stats = { skipped: true }
      }
    } catch (error) {
      console.error("✗ 统计汇总失败:", error)
      results.stats = { error: error instanceof Error ? error.message : String(error) }
    }

    // ==================== 任务2: 清理旧文章 ====================
    console.log("\n[2/3] 开始清理旧文章...")
    const cleanupStartTime = Date.now()
    
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const oldReadArticles = await prisma.readArticle.findMany({
        where: { readAt: { lt: thirtyDaysAgo } },
        select: { articleId: true },
        distinct: ['articleId']
      })
      
      if (oldReadArticles.length > 0) {
        const articleIds = oldReadArticles.map(r => r.articleId)
        
        const articlesInReadLater = await prisma.readLater.findMany({
          where: { articleId: { in: articleIds } },
          select: { articleId: true }
        })
        
        const readLaterIds = new Set(articlesInReadLater.map(r => r.articleId))
        const articlesToDelete = articleIds.filter(id => !readLaterIds.has(id))
        
        if (articlesToDelete.length > 0) {
          const deleteResult = await prisma.article.deleteMany({
            where: { id: { in: articlesToDelete } }
          })
          
          results.cleanup = {
            oldReadArticles: oldReadArticles.length,
            readLaterArticles: readLaterIds.size,
            deletedArticles: deleteResult.count
          }
          console.log(`✓ 清理完成：删除 ${deleteResult.count} 篇旧文章 (${Date.now() - cleanupStartTime}ms)`)
        } else {
          results.cleanup = { deletedArticles: 0 }
          console.log("⊘ 没有需要清理的文章")
        }
      } else {
        results.cleanup = { deletedArticles: 0 }
        console.log("⊘ 没有30天前的已读文章")
      }
    } catch (error) {
      console.error("✗ 清理旧文章失败:", error)
      results.cleanup = { error: error instanceof Error ? error.message : String(error) }
    }

    // ==================== 任务3: 计算文章热度 ====================
    console.log("\n[3/3] 开始计算文章热度...")
    const hotnessStartTime = Date.now()
    
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const articles = await prisma.article.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          createdAt: true,
          readBy: { select: { userId: true } },
          readLaterBy: { select: { userId: true } }
        }
      })

      let processedCount = 0
      let createdCount = 0
      let updatedCount = 0

      for (const article of articles) {
        const readCount = article.readBy.length
        const readLaterCount = article.readLaterBy.length
        
        if (readCount === 0 && readLaterCount === 0) continue

        const userIds = new Set([
          ...article.readBy.map(r => r.userId),
          ...article.readLaterBy.map(r => r.userId)
        ])
        const uniqueUsers = userIds.size

        let baseScore = (readLaterCount * 3) + (readCount * 1)

        const now = Date.now()
        const articleAge = now - new Date(article.createdAt).getTime()
        const oneDayMs = 24 * 60 * 60 * 1000
        
        let timeDecay = 1.0
        if (articleAge < oneDayMs) {
          timeDecay = 1.5
        } else if (articleAge < 3 * oneDayMs) {
          timeDecay = 1.2
        } else if (articleAge < 7 * oneDayMs) {
          timeDecay = 1.0
        } else {
          timeDecay = 0.5
        }

        const hotScore = baseScore * timeDecay

        const existingHotness = await prisma.articleHotness.findUnique({
          where: { articleId: article.id }
        })

        if (existingHotness) {
          await prisma.articleHotness.update({
            where: { articleId: article.id },
            data: {
              readCount, readLaterCount, uniqueUsers, hotScore,
              lastCalculated: new Date()
            }
          })
          updatedCount++
        } else {
          await prisma.articleHotness.create({
            data: { articleId: article.id, readCount, readLaterCount, uniqueUsers, hotScore }
          })
          createdCount++
        }
        processedCount++
      }

      const deletedHotness = await prisma.articleHotness.deleteMany({
        where: { article: { createdAt: { lt: thirtyDaysAgo } } }
      })

      results.hotness = {
        totalArticles: articles.length,
        processedArticles: processedCount,
        createdRecords: createdCount,
        updatedRecords: updatedCount,
        deletedRecords: deletedHotness.count
      }
      console.log(`✓ 热度计算完成：处理 ${processedCount} 篇文章 (${Date.now() - hotnessStartTime}ms)`)
    } catch (error) {
      console.error("✗ 热度计算失败:", error)
      results.hotness = { error: error instanceof Error ? error.message : String(error) }
    }

    const maintenanceDuration = Date.now() - maintenanceStartTime

    const summary = {
      executedAt: new Date().toISOString(),
      duration: `${maintenanceDuration}ms`,
      results
    }

    console.log("\n============ 每日维护任务完成 ============")
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json({
      success: true,
      summary
    })
  } catch (error) {
    console.error("每日维护任务失败:", error)
    return NextResponse.json(
      {
        error: "维护任务执行失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
