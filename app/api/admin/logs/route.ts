import { NextResponse } from "next/server"
import { checkAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取操作日志
export async function GET(request: Request) {
  try {
    const admin = await checkAdmin()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const action = searchParams.get("action") || ""
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where: any = {}
    
    if (action && action !== "all") {
      where.action = action
    }
    
    // 并行查询总数和日志列表
    const [total, logs] = await Promise.all([
      prisma.adminLog.count({ where }),
      prisma.adminLog.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
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
    
    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    console.error("获取操作日志失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取操作日志失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
