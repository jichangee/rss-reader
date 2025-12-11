import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

/**
 * 手动清理旧文章
 * 删除一周前已读且不在稍后读列表中的文章
 */
export async function POST(request: Request) {
  try {
    const admin = await checkAdmin()
    const body = await request.json().catch(() => ({}))
    
    // 可以自定义清理的天数，默认 7 天
    const days = body.days || 7
    
    console.log(`[CLEANUP] 开始清理 ${days} 天前的已读文章`)
    const startTime = Date.now()
    
    // 计算截止时间
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    // 1. 查找已读且超过指定天数的文章
    const oldReadArticles = await prisma.readArticle.findMany({
      where: {
        readAt: {
          lt: cutoffDate
        }
      },
      select: {
        articleId: true,
        readAt: true
      },
      distinct: ['articleId']
    })
    
    console.log(`[CLEANUP] 找到 ${oldReadArticles.length} 篇 ${days} 天前已读的文章`)
    
    let deletedCount = 0
    
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
      const articlesToDelete = articleIds.filter(id => !readLaterIds.has(id))
      
      console.log(`[CLEANUP] 排除 ${readLaterIds.size} 篇在稍后读列表中的文章`)
      console.log(`[CLEANUP] 准备删除 ${articlesToDelete.length} 篇文章`)
      
      if (articlesToDelete.length > 0) {
        // 3. 批量删除文章
        const deleteResult = await prisma.article.deleteMany({
          where: {
            id: { in: articlesToDelete }
          }
        })
        
        deletedCount = deleteResult.count
        console.log(`[CLEANUP] 成功删除 ${deletedCount} 篇旧文章`)
      }
    }
    
    const duration = Date.now() - startTime
    
    // 记录操作日志
    await logAdminAction({
      adminId: admin.id,
      action: "cleanup_old_articles",
      targetType: "article",
      details: {
        days,
        candidateCount: oldReadArticles.length,
        deletedCount,
        duration: `${duration}ms`
      },
      request
    })
    
    return NextResponse.json({
      success: true,
      message: `成功清理 ${deletedCount} 篇旧文章`,
      details: {
        days,
        candidateArticles: oldReadArticles.length,
        deletedArticles: deletedCount,
        duration: `${duration}ms`
      }
    })
  } catch (error: unknown) {
    console.error("[CLEANUP] 清理旧文章失败:", error)
    const errorMessage = error instanceof Error ? error.message : "清理旧文章失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
