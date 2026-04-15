import type { Article, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { refreshFeedsForUserId } from "@/lib/refresh-user-feeds"

const CACHE_TTL_MS = 4 * 60 * 60 * 1000
const WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_ARTICLES = 500

export type PublicArticleExportItem = {
  id: string
  title: string
  link: string
  pubDate: string | null
  author: string | null
  preview: string | null
  feedTitle: string
}

export type PublicArticleExportPayload = {
  displayName: string
  generatedAt: string
  articleCount: number
  articles: PublicArticleExportItem[]
}

function formatZhDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("zh-CN", { hour12: false })
}

function singleLineHeading(text: string): string {
  return text.replace(/\r?\n/g, " ").trim() || "无标题"
}

/** 将导出数据格式化为 Markdown 文本（页面可直接原样展示） */
export function formatPublicExportAsMarkdown(data: PublicArticleExportPayload): string {
  const lines: string[] = []
  lines.push(`- 生成时间: ${formatZhDateTime(data.generatedAt)}`)
  lines.push(`- 篇数: ${data.articleCount}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  if (data.articles.length === 0) {
    lines.push("*最近 24 小时内没有符合条件的文章。*")
    return lines.join("\n")
  }

  data.articles.forEach((a, index) => {
    lines.push(`## ${index + 1}. ${singleLineHeading(a.title)}`)
    lines.push("")
    lines.push(`- **订阅**: ${a.feedTitle}`)
    if (a.author) lines.push(`- **作者**: ${a.author}`)
    if (a.pubDate) lines.push(`- **时间**: ${formatZhDateTime(a.pubDate)}`)
    if (a.link) lines.push(`- **链接**: ${a.link}`)
    lines.push("")
    if (a.preview?.trim()) {
      lines.push(a.preview.trim())
      lines.push("")
    }
    lines.push("---")
    lines.push("")
  })

  return lines.join("\n")
}

type CacheEntry = {
  fetchedAt: number
  payload: PublicArticleExportPayload
}

const cacheByUserId = new Map<string, CacheEntry>()

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function previewFromArticle(a: Pick<Article, "content" | "contentSnippet">): string | null {
  const snippet = a.contentSnippet?.trim()
  if (snippet) return snippet
  if (a.content?.trim()) return stripHtml(a.content)
  return null
}

/** 路径参数为 User.id（cuid） */
async function resolveUserFromExportPathId(pathId: string): Promise<User | null> {
  const id = decodeURIComponent(pathId).trim()
  if (!id) return null
  return prisma.user.findUnique({ where: { id } })
}

async function buildPayload(user: User): Promise<PublicArticleExportPayload> {
  const feeds = await prisma.feed.findMany({
    where: { userId: user.id },
    select: { id: true },
  })
  const feedIds = feeds.map((f) => f.id)

  if (feedIds.length === 0) {
    return {
      displayName: user.name?.trim() || user.email,
      generatedAt: new Date().toISOString(),
      articleCount: 0,
      articles: [],
    }
  }

  const readLater = await prisma.readLater.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  })
  const readLaterIds = readLater.map((r) => r.articleId)

  const cutoff = new Date(Date.now() - WINDOW_MS)

  const articles = await prisma.article.findMany({
    where: {
      feedId: { in: feedIds },
      pubDate: { gte: cutoff },
      ...(readLaterIds.length > 0 ? { id: { notIn: readLaterIds } } : {}),
    },
    orderBy: { pubDate: "desc" },
    take: MAX_ARTICLES,
    include: {
      feed: {
        select: { title: true },
      },
    },
  })

  const items: PublicArticleExportItem[] = articles.map((a) => ({
    id: a.id,
    title: a.title,
    link: a.link,
    pubDate: a.pubDate ? a.pubDate.toISOString() : null,
    author: a.author,
    preview: previewFromArticle(a),
    feedTitle: a.feed.title,
  }))

  return {
    displayName: user.name?.trim() || user.email,
    generatedAt: new Date().toISOString(),
    articleCount: items.length,
    articles: items,
  }
}

/**
 * 缓存命中：直接返回内存缓存。
 * 缓存未命中或过期：先对该用户执行一次强制 RSS 刷新（与站内刷新逻辑一致），再查库生成导出内容。
 * 缓存仅在请求到达本进程时更新（无定时任务）。
 */
export async function getPublicArticleExport(userId: string): Promise<PublicArticleExportPayload | null> {
  const user = await resolveUserFromExportPathId(userId)
  if (!user) return null

  const now = Date.now()
  const hit = cacheByUserId.get(user.id)
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.payload
  }

  try {
    await refreshFeedsForUserId(user.id, { forceRefresh: true })
  } catch (e) {
    console.error("[public export] 订阅刷新失败，将使用已有数据库数据:", e)
  }

  const payload = await buildPayload(user)
  cacheByUserId.set(user.id, { fetchedAt: now, payload })
  return payload
}
