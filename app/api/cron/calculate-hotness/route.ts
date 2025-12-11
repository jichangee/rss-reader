import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 定时任务：计算文章热度分数
 * 建议每小时执行一次
 * Vercel Cron: 0 * * * * (每小时)
 * 
 * 热度算法：
 * - 基础分 = (稍后读次数 × 3) + (阅读次数 × 1)
 * - 时间衰减：
 *   - 24小时内：× 1.5
 *   - 3天内：× 1.2
 *   - 7天内：× 1.0
 *   - 7-30天：× 0.5
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

    console.log("============ 开始计算文章热度 ============")
    const startTime = Date.now()

    // 计算30天前的时间
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 获取30天内的所有文章
    const articles = await prisma.article.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        id: true,
        createdAt: true,
        readBy: {
          select: {
            userId: true
          }
        },
        readLaterBy: {
          select: {
            userId: true
          }
        }
      }
    })

    console.log(`找到 ${articles.length} 篇30天内的文章`)

    let processedCount = 0
    let createdCount = 0
    let updatedCount = 0

    // 批量处理文章热度计算
    for (const article of articles) {
      // 统计数据
      const readCount = article.readBy.length
      const readLaterCount = article.readLaterBy.length
      
      // 计算影响的独立用户数
      const userIds = new Set([
        ...article.readBy.map(r => r.userId),
        ...article.readLaterBy.map(r => r.userId)
      ])
      const uniqueUsers = userIds.size

      // 如果没有任何互动，跳过
      if (readCount === 0 && readLaterCount === 0) {
        continue
      }

      // 计算基础分数
      let baseScore = (readLaterCount * 3) + (readCount * 1)

      // 计算时间衰减因子
      const now = Date.now()
      const articleAge = now - new Date(article.createdAt).getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      
      let timeDecay = 1.0
      if (articleAge < oneDayMs) {
        // 24小时内
        timeDecay = 1.5
      } else if (articleAge < 3 * oneDayMs) {
        // 3天内
        timeDecay = 1.2
      } else if (articleAge < 7 * oneDayMs) {
        // 7天内
        timeDecay = 1.0
      } else {
        // 7-30天
        timeDecay = 0.5
      }

      // 最终热度分数
      const hotScore = baseScore * timeDecay

      // 更新或创建热度记录
      const existingHotness = await prisma.articleHotness.findUnique({
        where: { articleId: article.id }
      })

      if (existingHotness) {
        await prisma.articleHotness.update({
          where: { articleId: article.id },
          data: {
            readCount,
            readLaterCount,
            uniqueUsers,
            hotScore,
            lastCalculated: new Date()
          }
        })
        updatedCount++
      } else {
        await prisma.articleHotness.create({
          data: {
            articleId: article.id,
            readCount,
            readLaterCount,
            uniqueUsers,
            hotScore
          }
        })
        createdCount++
      }

      processedCount++
    }

    // 清理30天前的热度记录
    const deletedHotness = await prisma.articleHotness.deleteMany({
      where: {
        article: {
          createdAt: {
            lt: thirtyDaysAgo
          }
        }
      }
    })

    const duration = Date.now() - startTime

    const summary = {
      executedAt: new Date().toISOString(),
      duration: `${duration}ms`,
      totalArticles: articles.length,
      processedArticles: processedCount,
      createdRecords: createdCount,
      updatedRecords: updatedCount,
      deletedRecords: deletedHotness.count,
      thirtyDaysAgoDate: thirtyDaysAgo.toISOString()
    }

    console.log("============ 热度计算完成 ============")
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json({
      success: true,
      summary
    })
  } catch (error) {
    console.error("热度计算失败:", error)
    return NextResponse.json(
      {
        error: "热度计算失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
