import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refreshFeeds, getFeedsToRefresh } from "@/lib/feed-refresh-service"

// 刷新订阅 - 优化版本
export async function POST(req: Request) {
  const startTime = Date.now()
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户刷新间隔限制（10分钟）
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, lastRefreshRequestAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const MIN_REFRESH_INTERVAL = 10 * 60 * 1000 // 10分钟
    const now = Date.now()

    // 获取请求体中的 feedIds 和 forceRefresh
    let feedIds: string[] | undefined
    let forceRefresh: boolean = false
    try {
      const body = await req.json()
      feedIds = body.feedIds
      forceRefresh = body.forceRefresh === true
    } catch (e) {
      // 忽略 JSON 解析错误，视为全量刷新
    }

    // 如果 forceRefresh 为 false，检查刷新间隔限制
    if (!forceRefresh && user.lastRefreshRequestAt) {
      const timeSinceLastRefresh = now - new Date(user.lastRefreshRequestAt).getTime()
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const remainingMinutes = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000))
        return NextResponse.json({ 
          error: `刷新过于频繁，请等待 ${remainingMinutes} 分钟后再试`,
          remainingMinutes 
        }, { status: 429 })
      }
    }

    // 更新用户最后刷新请求时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastRefreshRequestAt: new Date() },
    })

    // 确定需要刷新的 Feed ID 列表
    let feedsToRefresh: string[]
    
    if (feedIds && feedIds.length > 0) {
      // 如果指定了 feedIds，使用指定的列表（但仍会检查状态和 nextFetchAt，除非强制刷新）
      feedsToRefresh = feedIds
    } else {
      // 如果没有指定，获取用户所有需要刷新的 Feed
      feedsToRefresh = await getFeedsToRefresh(user.id)
    }

    console.log(`同步刷新开始: ${feedsToRefresh.length} 个订阅需要刷新${forceRefresh ? ' (强制刷新)' : ''}`)

    // 使用优化的刷新服务刷新所有 Feed
    const refreshResults = await refreshFeeds(feedsToRefresh, { forceRefresh })

    // 统计结果
    const successCount = refreshResults.filter(r => r.success).length
    const failedCount = refreshResults.filter(r => !r.success).length
    
    // 统计新增文章总数
    const totalNewArticlesCount = refreshResults.reduce(
      (sum, r) => sum + r.newArticlesCount,
      0
    )

    const totalTime = Date.now() - startTime

    console.log(`同步刷新完成: 成功 ${successCount}, 失败 ${failedCount}, 新增文章 ${totalNewArticlesCount}, 耗时 ${totalTime}ms`)

    return NextResponse.json({
      success: true,
      refreshedCount: successCount,
      newArticlesCount: totalNewArticlesCount,
      failedCount,
      totalTime,
      results: refreshResults, // 返回详细结果
    })
  } catch (error) {
    console.error("刷新失败:", error)
    const totalTime = Date.now() - startTime
    return NextResponse.json({ 
      error: "刷新失败",
      totalTime,
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

