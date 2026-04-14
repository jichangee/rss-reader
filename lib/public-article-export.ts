import type { Article, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

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
 * 首次访问或缓存超过 4 小时时查库；否则返回内存缓存。
 * 仅在请求到达本进程时刷新（无后台定时任务）。
 */
export async function getPublicArticleExport(userId: string): Promise<PublicArticleExportPayload | null> {
  const user = await resolveUserFromExportPathId(userId)
  if (!user) return null

  const now = Date.now()
  const hit = cacheByUserId.get(user.id)
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.payload
  }

  const payload = await buildPayload(user)
  cacheByUserId.set(user.id, { fetchedAt: now, payload })
  return payload
}
