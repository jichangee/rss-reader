import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取文章列表
export async function GET(request: Request) {
  try {
    const admin = await checkAdmin()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const feedId = searchParams.get("feedId") || ""
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where: any = {}
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contentSnippet: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (feedId) {
      where.feedId = feedId
    }
    
    // 并行查询总数和文章列表
    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          link: true,
          contentSnippet: true,
          pubDate: true,
          author: true,
          createdAt: true,
          feed: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              readBy: true,
              readLaterBy: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      })
    ])
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_articles",
      targetType: "article",
      request
    })
    
    return NextResponse.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    console.error("获取文章列表失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取文章列表失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}

// 批量删除文章
export async function DELETE(request: Request) {
  try {
    const admin = await checkAdmin()
    const body = await request.json()
    const { articleIds } = body
    
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: "请提供要删除的文章ID列表" }, { status: 400 })
    }
    
    // 删除文章
    const result = await prisma.article.deleteMany({
      where: {
        id: { in: articleIds }
      }
    })
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "delete_articles_batch",
      targetType: "article",
      details: { count: result.count, articleIds },
      request
    })
    
    return NextResponse.json({ 
      success: true,
      count: result.count
    })
  } catch (error: unknown) {
    console.error("批量删除文章失败:", error)
    const errorMessage = error instanceof Error ? error.message : "批量删除文章失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
