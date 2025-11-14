import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 标记所有未读文章为已读
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { feeds: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get("feedId")

    const feedIds = user.feeds.map((f) => f.id)

    // 查找所有未读文章
    const unreadArticles = await prisma.article.findMany({
      where: {
        feedId: feedId || { in: feedIds },
        readBy: {
          none: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
      },
    })

    // 批量创建已读记录
    if (unreadArticles.length > 0) {
      await prisma.readArticle.createMany({
        data: unreadArticles.map((article) => ({
          userId: user.id,
          articleId: article.id,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ 
      success: true,
      count: unreadArticles.length 
    })
  } catch (error) {
    console.error("标记全部已读失败:", error)
    return NextResponse.json({ error: "标记全部已读失败" }, { status: 500 })
  }
}

