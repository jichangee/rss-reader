import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取系统设置和统计信息
export async function GET(request: Request) {
  try {
    const admin = await checkAdmin()
    
    // 获取各种统计数据
    const [
      totalUsers,
      totalFeeds,
      totalArticles,
      adminUsers,
      recentLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.feed.count(),
      prisma.article.count(),
      prisma.user.findMany({
        where: { role: 'admin' },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true
        }
      }),
      prisma.adminLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })
    ])
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_settings",
      targetType: "system",
      request
    })
    
    return NextResponse.json({
      stats: {
        totalUsers,
        totalFeeds,
        totalArticles
      },
      admins: adminUsers,
      recentLogs,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasAdminEmails: !!process.env.ADMIN_EMAILS,
        hasCronSecret: !!process.env.CRON_SECRET,
        hasGoogleTranslateKey: !!process.env.GOOGLE_TRANSLATE_API_KEY
      }
    })
  } catch (error: unknown) {
    console.error("获取系统设置失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取系统设置失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
