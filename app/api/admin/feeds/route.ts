import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取订阅源列表
export async function GET(request: Request) {
  try {
    const admin = await checkAdmin()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const sortBy = searchParams.get("sortBy") || "createdAt" // createdAt, articleCount, subscribers
    const sortOrder = searchParams.get("sortOrder") || "desc"
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where: any = {}
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    // 构建排序
    let orderBy: any = {}
    if (sortBy === "articleCount") {
      orderBy = { articles: { _count: sortOrder } }
    } else {
      orderBy = { [sortBy]: sortOrder }
    }
    
    // 并行查询总数和订阅源列表
    const [total, feeds] = await Promise.all([
      prisma.feed.count({ where }),
      prisma.feed.findMany({
        where,
        select: {
          id: true,
          title: true,
          url: true,
          description: true,
          imageUrl: true,
          enableTranslation: true,
          lastRefreshedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          _count: {
            select: {
              articles: true,
              webhooks: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      })
    ])
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_feeds",
      targetType: "feed",
      request
    })
    
    return NextResponse.json({
      feeds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    console.error("获取订阅源列表失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取订阅源列表失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
