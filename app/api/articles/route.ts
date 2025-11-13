import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取所有文章
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get("feedId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"

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
      take: 50,
    })

    return NextResponse.json(articles)
  } catch (error) {
    console.error("获取文章失败:", error)
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 })
  }
}

