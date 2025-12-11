import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"

// 刷新订阅源
export async function POST(request: Request) {
  try {
    const admin = await checkAdmin()
    const body = await request.json()
    const { feedId } = body
    
    // 调用刷新 API
    const refreshRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/feeds/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        feedIds: feedId ? [feedId] : undefined,
        forceRefresh: true 
      }),
    })
    
    if (!refreshRes.ok) {
      const errorData = await refreshRes.json()
      return NextResponse.json(
        { error: errorData.error || "刷新失败" },
        { status: refreshRes.status }
      )
    }
    
    const result = await refreshRes.json()
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "refresh_feeds",
      targetType: "feed",
      targetId: feedId,
      details: result,
      request
    })
    
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("刷新订阅源失败:", error)
    const errorMessage = error instanceof Error ? error.message : "刷新订阅源失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
