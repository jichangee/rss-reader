import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取所有文章（支持分页）
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get("feedId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const readLaterOnly = searchParams.get("readLaterOnly") === "true"
    const cursor = searchParams.get("cursor")
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const sortBy = searchParams.get("sortBy") || "default" // "default" | "oldest"

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        feeds: { select: { id: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const feedIds = user.feeds.map((feed) => feed.id)

    // 获取用户的所有稍后读文章ID
    const readLaterRecords = await prisma.readLater.findMany({
      where: {
        userId: user.id,
      },
      select: { articleId: true },
      orderBy: { addedAt: "desc" },
    })
    const readLaterArticleIds = new Set(readLaterRecords.map(rl => rl.articleId))

    // 构建查询条件
    const where: any = {
      feedId: feedId || { in: feedIds },
    }

    if (readLaterOnly) {
      // 稍后读模式：只获取稍后读文章
      where.id = { in: Array.from(readLaterArticleIds) }
    } else {
      // 普通模式：排除稍后读文章
      if (readLaterArticleIds.size > 0) {
        where.id = { notIn: Array.from(readLaterArticleIds) }
      }
    }

    if (unreadOnly && !readLaterOnly) {
      where.readBy = {
        none: {
          userId: user.id,
        },
      }
    }

    // 获取文章
    const articles = await prisma.article.findMany({
      where,
      include: {
        feed: {
          include: {
            webhooks: {
              include: {
                webhook: {
                  select: {
                    id: true,
                    name: true,
                    url: true,
                    method: true,
                    customFields: true,
                    remote: true,
                    enabled: true,
                  },
                },
              },
            },
          },
        },
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: readLaterOnly 
        ? { readLaterBy: { _count: "desc" } } // 稍后读按添加时间排序（通过关联表）
        : sortBy === "oldest"
        ? { pubDate: "asc" } // 按时间从旧到新
        : { pubDate: "desc" }, // 默认排序：按时间从新到旧
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    // 如果是稍后读模式，按添加时间重新排序
    let sortedArticles = articles
    if (readLaterOnly && articles.length > 0) {
      // 获取稍后读记录的添加时间
      const readLaterWithTime = await prisma.readLater.findMany({
        where: {
          userId: user.id,
          articleId: { in: articles.map(a => a.id) },
        },
        select: { articleId: true, addedAt: true },
      })
      const addedAtMap = new Map(readLaterWithTime.map(r => [r.articleId, r.addedAt]))
      
      // 按添加时间降序排序
      sortedArticles = [...articles].sort((a, b) => {
        const timeA = addedAtMap.get(a.id)?.getTime() || 0
        const timeB = addedAtMap.get(b.id)?.getTime() || 0
        return timeB - timeA
      })
    }

    const hasNextPage = sortedArticles.length > limit
    const returnArticles = hasNextPage ? sortedArticles.slice(0, limit) : sortedArticles
    const nextCursor = hasNextPage ? returnArticles[returnArticles.length - 1].id : null

    // 为每篇文章添加 isReadLater 标记，并格式化 webhooks
    const articlesWithReadLater = returnArticles.map((article) => ({
      ...article,
      isReadLater: readLaterArticleIds.has(article.id),
      feed: {
        ...article.feed,
        webhooks: article.feed.webhooks?.map((fw: any) => fw.webhook) || [],
      },
    }))

    return NextResponse.json({
      articles: articlesWithReadLater,
      nextCursor,
      hasNextPage,
    })
  } catch (error) {
    console.error("获取文章失败:", error)
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 })
  }
}

