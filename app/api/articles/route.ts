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
      include: { feeds: true },
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

    const articles = await prisma.article.findMany({
      where,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
      take: limit + 1, // 多取一个用来判断是否有下一页
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // 跳过 cursor 本身
      }),
    })

    const hasNextPage = articles.length > limit
    const returnArticles = hasNextPage ? articles.slice(0, limit) : articles
    const nextCursor = hasNextPage ? returnArticles[returnArticles.length - 1].id : null

    return NextResponse.json({
      articles: returnArticles,
      nextCursor,
      hasNextPage,
    })
  } catch (error) {
    console.error("获取文章失败:", error)
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 })
  }
}

