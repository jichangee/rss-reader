import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refreshFeedsForUserId } from "@/lib/refresh-user-feeds"

// 刷新订阅 - 同步版本
export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, lastRefreshRequestAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const MIN_REFRESH_INTERVAL = 10 * 60 * 1000 // 10分钟
    const now = Date.now()

    let feedIds: string[] | undefined
    let forceRefresh = false
    try {
      const body = await req.json()
      feedIds = body.feedIds
      forceRefresh = body.forceRefresh === true
    } catch {
      // 忽略 JSON 解析错误，视为全量刷新
    }

    if (!forceRefresh && user.lastRefreshRequestAt) {
      const timeSinceLastRefresh = now - new Date(user.lastRefreshRequestAt).getTime()
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const remainingMinutes = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000))
        return NextResponse.json(
          {
            error: `刷新过于频繁，请等待 ${remainingMinutes} 分钟后再试`,
            remainingMinutes,
          },
          { status: 429 }
        )
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastRefreshRequestAt: new Date(),
        lastActiveAt: new Date(),
      },
    })

    const result = await refreshFeedsForUserId(user.id, { forceRefresh, feedIds })

    const totalTime = Date.now() - startTime

    return NextResponse.json({
      success: result.success,
      refreshedCount: result.refreshedCount,
      newArticlesCount: result.newArticlesCount,
      failedCount: result.failedCount,
      totalTime,
    })
  } catch (error) {
    console.error("刷新失败:", error)
    const totalTime = Date.now() - startTime
    return NextResponse.json(
      {
        error: "刷新失败",
        totalTime,
      },
      { status: 500 }
    )
  }
}
