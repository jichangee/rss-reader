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
    const cursor = searchParams.get("cursor")
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        targetLanguage: true,
        feeds: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const feedIds = user.feeds.map((f) => f.id)

    const where: any = {
      feedId: feedId || { in: feedIds },
    }

    if (unreadOnly) {
      where.readBy = {
        none: {
          userId: user.id,
        },
      }
    }

    // 先获取所有符合条件的文章ID（用于获取稍后读文章）
    const allArticleIds = await prisma.article.findMany({
      where: {
        feedId: feedId || { in: feedIds },
      },
      select: { id: true },
    })

    const articleIds = allArticleIds.map(a => a.id)

    // 获取用户的所有稍后读文章ID（不受 unreadOnly 限制）
    const readLaterArticles = await prisma.readLater.findMany({
      where: {
        userId: user.id,
        articleId: { in: articleIds },
      },
      select: { articleId: true },
      orderBy: { addedAt: "desc" },
    })

    const readLaterArticleIds = new Set(readLaterArticles.map(rl => rl.articleId))

    // 分别获取稍后读文章和其他文章
    // 稍后读文章应该始终显示，不受 unreadOnly 限制
    const readLaterWhere = {
      feedId: feedId || { in: feedIds },
      id: { in: Array.from(readLaterArticleIds) },
    }

    const otherWhere = {
      ...where,
      id: { notIn: Array.from(readLaterArticleIds) },
    }

    // 获取稍后读文章
    const readLaterArticlesData = readLaterArticleIds.size > 0 ? await prisma.article.findMany({
      where: readLaterWhere,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
    }) : []

    // 计算还需要获取多少其他文章
    const remainingLimit = limit + 1 - readLaterArticlesData.length
    const otherArticles = remainingLimit > 0 ? await prisma.article.findMany({
      where: otherWhere,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
      take: remainingLimit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // 跳过 cursor 本身
      }),
    }) : []

    // 合并结果：稍后读文章在前，其他文章在后
    const articles = [...readLaterArticlesData, ...otherArticles]

    const hasNextPage = articles.length > limit
    const returnArticles = hasNextPage ? articles.slice(0, limit) : articles
    const nextCursor = hasNextPage ? returnArticles[returnArticles.length - 1].id : null

    // 为每篇文章添加 isReadLater 标记
    // 注意：翻译功能已移至前端按需翻译，不再在此处进行翻译
    const articlesWithReadLater = returnArticles.map(article => ({
      ...article,
      isReadLater: article.readLaterBy && article.readLaterBy.length > 0,
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

