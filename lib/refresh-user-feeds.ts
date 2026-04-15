import type { Feed } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

type ParsedFeedItem = {
  guid?: string
  link?: string
  title?: string
  content?: string
  contentSnippet?: string
  pubDate?: string
  creator?: string
  author?: string
}

export type RefreshFeedsForUserResult = {
  success: boolean
  refreshedCount: number
  newArticlesCount: number
  failedCount: number
  totalTime: number
}

/**
 * 按用户 ID 拉取 RSS 并写入新文章（与 /api/feeds/refresh 核心逻辑一致）。
 * 不负责鉴权与「10 分钟全局限流」；调用方自行处理。
 */
export async function refreshFeedsForUserId(
  userId: string,
  options: { forceRefresh?: boolean; feedIds?: string[] }
): Promise<RefreshFeedsForUserResult> {
  const startTime = Date.now()
  const forceRefresh = options.forceRefresh === true
  const feedIds = options.feedIds

  const userWithFeeds = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      feeds: {
        where: feedIds?.length ? { id: { in: feedIds } } : undefined,
      },
    },
  })

  if (!userWithFeeds) {
    return {
      success: false,
      refreshedCount: 0,
      newArticlesCount: 0,
      failedCount: 0,
      totalTime: Date.now() - startTime,
    }
  }

  const now = Date.now()
  const minRefreshInterval = 5 * 60 * 1000

  const feedsToRefresh = userWithFeeds.feeds.filter((feed) => {
    if (forceRefresh) return true
    if (!feed.lastRefreshedAt) return true
    return now - new Date(feed.lastRefreshedAt).getTime() >= minRefreshInterval
  })

  console.log(
    `同步刷新开始: ${feedsToRefresh.length} 个订阅需要刷新${forceRefresh ? " (强制刷新)" : ""} (userId=${userId})`
  )

  const refreshResults = await Promise.allSettled(
    feedsToRefresh.map((feed) => refreshSingleFeed(feed))
  )

  const successCount = refreshResults.filter((r) => r.status === "fulfilled").length
  const failedCount = refreshResults.filter((r) => r.status === "rejected").length

  let totalNewArticlesCount = 0
  refreshResults.forEach((result) => {
    if (result.status === "fulfilled" && result.value.newArticlesCount) {
      totalNewArticlesCount += result.value.newArticlesCount
    }
  })

  const totalTime = Date.now() - startTime
  console.log(
    `同步刷新完成: 成功 ${successCount}, 失败 ${failedCount}, 新增文章 ${totalNewArticlesCount}, 耗时 ${totalTime}ms (userId=${userId})`
  )

  return {
    success: true,
    refreshedCount: successCount,
    newArticlesCount: totalNewArticlesCount,
    failedCount,
    totalTime,
  }
}

async function refreshSingleFeed(feed: Feed): Promise<{ success: true; feedId: string; newArticlesCount: number }> {
  const parsedFeed = await parseRSSWithTimeout(feed.url, 8000)

  const updateData: Record<string, unknown> = {
    lastRefreshedAt: new Date(),
  }

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

  const feedUpdatePromise =
    Object.keys(updateData).length > 1
      ? prisma.feed.update({
          where: { id: feed.id },
          data: updateData as Parameters<typeof prisma.feed.update>[0]["data"],
        })
      : Promise.resolve(feed)

  let newArticlesCount = 0
  if (parsedFeed.items && parsedFeed.items.length > 0) {
    const existingGuids = await prisma.article.findMany({
      where: { feedId: feed.id },
      select: { guid: true },
    })
    const existingGuidSet = new Set(existingGuids.map((a) => a.guid))

    let filterKeywords: string[] = []
    if (feed.filterKeywords) {
      try {
        filterKeywords = JSON.parse(feed.filterKeywords) as string[]
      } catch {
        // ignore
      }
    }

    const items = parsedFeed.items as ParsedFeedItem[]
    const newArticles = items
      .slice(0, 20)
      .map((item) => {
        const guid = item.guid || item.link || `${feed.id}-${item.pubDate || Date.now()}`
        return {
          feedId: feed.id,
          title: item.title || "无标题",
          link: item.link || "",
          content: item.content,
          contentSnippet: item.contentSnippet,
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          author: item.creator || item.author,
          guid,
        }
      })
      .filter((article) => !existingGuidSet.has(article.guid))
      .filter((article) => {
        if (filterKeywords.length === 0) return true
        const titleLower = (article.title || "").toLowerCase()
        const contentLower = (article.content || "").toLowerCase()
        const snippetLower = (article.contentSnippet || "").toLowerCase()
        for (const keyword of filterKeywords) {
          const keywordLower = keyword.toLowerCase()
          if (
            titleLower.includes(keywordLower) ||
            contentLower.includes(keywordLower) ||
            snippetLower.includes(keywordLower)
          ) {
            return false
          }
        }
        return true
      })

    if (newArticles.length > 0) {
      await prisma.article.createMany({
        data: newArticles,
        skipDuplicates: true,
      })
      newArticlesCount = newArticles.length
    }
  }

  await feedUpdatePromise

  return { success: true, feedId: feed.id, newArticlesCount }
}
