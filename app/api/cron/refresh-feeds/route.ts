import { NextResponse } from "next/server"
import { refreshFeeds, getFeedsToRefresh } from "@/lib/feed-refresh-service"

// Vercel Cron Job: 定时刷新所有用户的RSS订阅（优化版本）
// 每 15 分钟执行一次（在整点、15分、30分、45分）
export async function GET(req: Request) {
  try {
    // 验证Vercel Cron Secret
    const authHeader = req.headers.get("authorization")
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

    console.log("============ Cron Job 开始 ============")
    const startTime = Date.now()

    // 获取所有需要刷新的 Feed（只查询状态为 ACTIVE 且 nextFetchAt <= now 的 Feed）
    const feedsToRefresh = await getFeedsToRefresh()

    console.log(`找到 ${feedsToRefresh.length} 个需要刷新的 Feed`)

    if (feedsToRefresh.length === 0) {
      const duration = Date.now() - startTime
      const summary = {
        executedAt: new Date().toISOString(),
        duration: `${duration}ms`,
        totalFeeds: 0,
        skippedFeeds: 0,
        successfulRefreshes: 0,
        failedRefreshes: 0,
        newArticles: 0,
      }

      console.log("============ Cron Job 完成（无需刷新）============")
      return NextResponse.json({
        success: true,
        summary,
      })
    }

    // 使用优化的刷新服务刷新所有 Feed
    const refreshResults = await refreshFeeds(feedsToRefresh, { forceRefresh: false })

    // 统计结果
    const successCount = refreshResults.filter(r => r.success).length
    const failedCount = refreshResults.filter(r => !r.success).length
    const totalNewArticles = refreshResults.reduce(
      (sum, r) => sum + r.newArticlesCount,
      0
    )

    const duration = Date.now() - startTime

    const summary = {
      executedAt: new Date().toISOString(),
      duration: `${duration}ms`,
      totalFeeds: feedsToRefresh.length,
      skippedFeeds: 0, // 已通过 getFeedsToRefresh 过滤，无需跳过
      successfulRefreshes: successCount,
      failedRefreshes: failedCount,
      newArticles: totalNewArticles,
    }

    console.log("============ Cron Job 完成 ============")
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error("Cron Job 执行失败:", error)
    return NextResponse.json({ 
      error: "Cron执行失败",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
