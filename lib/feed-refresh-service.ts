import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout, RSSParseResult } from "@/lib/rss-parser"

// Feed 状态枚举
export enum FeedStatus {
  ACTIVE = "ACTIVE",
  ERROR = "ERROR",
  DISABLED = "DISABLED",
}

// 刷新结果
export interface RefreshResult {
  success: boolean
  feedId: string
  feedTitle: string
  newArticlesCount: number
  error?: string
}

// 刷新单个 Feed 的配置
interface RefreshFeedOptions {
  forceRefresh?: boolean // 强制刷新，忽略 nextFetchAt 限制
}

/**
 * 计算指数退避重试延迟（分钟）
 * @param errorCount 错误次数
 * @returns 重试延迟（分钟），最多 60 分钟
 */
function calculateRetryDelay(errorCount: number): number {
  // 指数退避：15 * 2^(errorCount-1)，最多 60 分钟
  return Math.min(60, 15 * Math.pow(2, Math.min(errorCount - 1, 5)))
}

/**
 * 刷新单个 Feed
 */
export async function refreshFeed(
  feedId: string,
  options: RefreshFeedOptions = {}
): Promise<RefreshResult> {
  const { forceRefresh = false } = options

  // 获取 Feed 信息
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
  })

  if (!feed) {
    return {
      success: false,
      feedId,
      feedTitle: "未知",
      newArticlesCount: 0,
      error: "Feed 不存在",
    }
  }

  // 检查是否需要刷新（除非强制刷新）
  if (!forceRefresh) {
    // 只刷新状态为 ACTIVE 的 Feed
    if (feed.status !== FeedStatus.ACTIVE) {
      return {
        success: false,
        feedId,
        feedTitle: feed.title,
        newArticlesCount: 0,
        error: `Feed 状态为 ${feed.status}，无法刷新`,
      }
    }

    // 检查是否到了刷新时间
    if (feed.nextFetchAt) {
      const now = new Date()
      if (feed.nextFetchAt > now) {
        return {
          success: false,
          feedId,
          feedTitle: feed.title,
          newArticlesCount: 0,
          error: "未到刷新时间",
        }
      }
    }
  }

  try {
    // HTTP 条件请求
    const parseResult = await parseRSSWithTimeout(
      feed.url,
      10000, // 10秒超时
      feed.etag,
      feed.lastModified || undefined
    )

    // 如果是 304 Not Modified，直接返回成功（无需更新）
    if (parseResult.notModified) {
      // 更新 lastRefreshedAt，但不更新其他字段
      await prisma.feed.update({
        where: { id: feedId },
        data: {
          lastRefreshedAt: new Date(),
          // 计划下次刷新（15分钟后）
          nextFetchAt: new Date(Date.now() + 15 * 60 * 1000),
          // 重置错误计数
          errorCount: 0,
          errorMessage: null,
          status: FeedStatus.ACTIVE,
        },
      })

      return {
        success: true,
        feedId,
        feedTitle: feed.title,
        newArticlesCount: 0,
      }
    }

    const parsedFeed = parseResult.feed

    // 准备更新数据
    const updateData: any = {
      lastRefreshedAt: new Date(),
      status: FeedStatus.ACTIVE,
      errorCount: 0,
      errorMessage: null,
    }

    // 更新 Feed 元数据（只在有变化时更新）
    if (parsedFeed.title && parsedFeed.title !== feed.title) {
      updateData.title = parsedFeed.title
    }
    if (parsedFeed.description !== undefined && parsedFeed.description !== feed.description) {
      updateData.description = parsedFeed.description
    }
    if (parsedFeed.link !== undefined && parsedFeed.link !== feed.link) {
      updateData.link = parsedFeed.link
    }
    const newImageUrl = parsedFeed.image?.url
    if (newImageUrl !== undefined && newImageUrl !== feed.imageUrl) {
      updateData.imageUrl = newImageUrl
    }

    // 更新缓存头
    if (parseResult.cacheHeaders) {
      if (parseResult.cacheHeaders.etag) {
        updateData.etag = parseResult.cacheHeaders.etag
      }
      if (parseResult.cacheHeaders["last-modified"]) {
        updateData.lastModified = parseResult.cacheHeaders["last-modified"]
      }
    }

    // 处理文章
    let newArticlesCount = 0
    let latestEntryTime: Date | null = null

    if (parsedFeed.items && parsedFeed.items.length > 0) {
      // 查询已存在的文章 guid
      const existingGuids = await prisma.article.findMany({
        where: { feedId: feed.id },
        select: { guid: true },
      })
      const existingGuidSet = new Set(existingGuids.map((a) => a.guid))

      // 过滤出新文章
      const newArticles = parsedFeed.items
        .slice(0, 20) // 限制每次最多处理 20 篇文章
        .map((item: any) => {
          const guid = item.guid || item.link || `${feed.id}-${item.pubDate || Date.now()}`
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()

          // 跟踪最新文章时间
          if (!latestEntryTime || pubDate > latestEntryTime) {
            latestEntryTime = pubDate
          }

          return {
            feedId: feed.id,
            title: item.title || "无标题",
            link: item.link || "",
            content: item.content,
            contentSnippet: item.contentSnippet,
            pubDate,
            author: item.creator || item.author,
            guid,
          }
        })
        .filter((article: any) => !existingGuidSet.has(article.guid))

      // 插入新文章
      if (newArticles.length > 0) {
        await prisma.article.createMany({
          data: newArticles,
          skipDuplicates: true,
        })
        newArticlesCount = newArticles.length
      }
    }

    // 更新最新文章时间
    if (latestEntryTime) {
      updateData.lastEntryAt = latestEntryTime
    }

    // 计划下次刷新（15分钟后）
    updateData.nextFetchAt = new Date(Date.now() + 15 * 60 * 1000)

    // 更新 Feed
    await prisma.feed.update({
      where: { id: feedId },
      data: updateData,
    })

    return {
      success: true,
      feedId,
      feedTitle: feed.title,
      newArticlesCount,
    }
  } catch (error) {
    // 错误处理
    const errorMessage = error instanceof Error ? error.message : String(error)
    const newErrorCount = feed.errorCount + 1

    // 计算重试延迟
    const retryDelayMinutes = calculateRetryDelay(newErrorCount)
    const nextFetchAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000)

    // 如果错误次数达到 10 次，禁用 Feed
    const newStatus = newErrorCount >= 10 ? FeedStatus.ERROR : FeedStatus.ACTIVE

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastRefreshedAt: new Date(),
        errorCount: newErrorCount,
        errorMessage,
        status: newStatus,
        nextFetchAt,
      },
    })

    console.error(`刷新 Feed ${feed.title} (${feedId}) 失败:`, errorMessage)

    return {
      success: false,
      feedId,
      feedTitle: feed.title,
      newArticlesCount: 0,
      error: errorMessage,
    }
  }
}

/**
 * 刷新多个 Feed
 */
export async function refreshFeeds(
  feedIds: string[],
  options: RefreshFeedOptions = {}
): Promise<RefreshResult[]> {
  const results = await Promise.allSettled(
    feedIds.map((feedId) => refreshFeed(feedId, options))
  )

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      return {
        success: false,
        feedId: "unknown",
        feedTitle: "未知",
        newArticlesCount: 0,
        error: result.reason?.message || "未知错误",
      }
    }
  })
}

/**
 * 获取需要刷新的 Feed ID 列表
 * @param userId 用户 ID（可选，如果提供则只查询该用户的 Feed）
 * @returns Feed ID 列表
 */
export async function getFeedsToRefresh(userId?: string): Promise<string[]> {
  const now = new Date()

  const feeds = await prisma.feed.findMany({
    where: {
      status: FeedStatus.ACTIVE,
      OR: [
        { nextFetchAt: null }, // 从未设置过下次刷新时间
        { nextFetchAt: { lte: now } }, // 已到刷新时间
      ],
      ...(userId ? { userId } : {}), // 如果提供了 userId，则只查询该用户的 Feed
    },
    select: {
      id: true,
    },
  })

  return feeds.map((feed) => feed.id)
}

