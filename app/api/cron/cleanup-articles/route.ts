import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 定时任务：清理30天前已读的文章
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

    // 验证授权
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("Cron认证失败")
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    console.log("============ 开始清理旧文章 ============")
    const cleanupStartTime = Date.now()
    
    // 计算30天前的时间
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    let deletedArticlesCount = 0
    let oldReadArticlesCount = 0
    let readLaterArticlesCount = 0
    
    try {
      // 1. 查找30天前已读且不在稍后读列表中的文章
      // 这些文章至少被一个用户读过，且最后阅读时间在30天前
      const oldReadArticles = await prisma.readArticle.findMany({
        where: {
          readAt: {
            lt: thirtyDaysAgo
          }
        },
        select: {
          articleId: true,
          readAt: true
        },
        distinct: ['articleId']
      })
      
      oldReadArticlesCount = oldReadArticles.length
      console.log(`找到 ${oldReadArticlesCount} 篇30天前已读的文章`)
      
      if (oldReadArticles.length > 0) {
        const articleIds = oldReadArticles.map(r => r.articleId)
        
        // 2. 排除仍在稍后读列表中的文章
        const articlesInReadLater = await prisma.readLater.findMany({
          where: {
            articleId: { in: articleIds }
          },
          select: {
            articleId: true
          }
        })
        
        const readLaterIds = new Set(articlesInReadLater.map(r => r.articleId))
        readLaterArticlesCount = readLaterIds.size
        const articlesToDelete = articleIds.filter(id => !readLaterIds.has(id))
        
        console.log(`排除 ${readLaterArticlesCount} 篇在稍后读列表中的文章`)
        console.log(`准备删除 ${articlesToDelete.length} 篇文章`)
        
        if (articlesToDelete.length > 0) {
          // 3. 删除文章（会级联删除关联的 readArticle 记录）
          const deleteResult = await prisma.article.deleteMany({
            where: {
              id: { in: articlesToDelete }
            }
          })
          
          deletedArticlesCount = deleteResult.count
          console.log(`成功删除 ${deletedArticlesCount} 篇旧文章`)
        }
      }
      
      const cleanupDuration = Date.now() - cleanupStartTime
      console.log(`============ 清理完成，耗时 ${cleanupDuration}ms ============`)
      
      const summary = {
        executedAt: new Date().toISOString(),
        duration: `${cleanupDuration}ms`,
        thirtyDaysAgoDate: thirtyDaysAgo.toISOString(),
        oldReadArticles: oldReadArticlesCount,
        readLaterArticles: readLaterArticlesCount,
        deletedArticles: deletedArticlesCount,
      }
      
      console.log("清理统计:", JSON.stringify(summary, null, 2))
      
      return NextResponse.json({
        success: true,
        summary,
      })
    } catch (cleanupError) {
      console.error("清理旧文章失败:", cleanupError)
      return NextResponse.json({ 
        error: "清理失败",
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Cron Job 执行失败:", error)
    return NextResponse.json({ 
      error: "Cron执行失败",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
