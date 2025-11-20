import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 批量标记文章为已读
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const body = await request.json()
    const { articleIds } = body

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: "文章ID列表不能为空" }, { status: 400 })
    }

    // 验证所有文章是否存在
    const articles = await prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true },
    })

    if (articles.length !== articleIds.length) {
      return NextResponse.json({ error: "部分文章不存在" }, { status: 404 })
    }

    // 获取已经标记为已读的文章
    const existingReads = await prisma.readArticle.findMany({
      where: {
        userId: user.id,
        articleId: { in: articleIds },
      },
      select: { articleId: true },
    })

    const existingReadIds = new Set(existingReads.map((r) => r.articleId))
    const newReadIds = articleIds.filter((id) => !existingReadIds.has(id))

    // 批量创建未读的标记
    if (newReadIds.length > 0) {
      await prisma.readArticle.createMany({
        data: newReadIds.map((articleId) => ({
          userId: user.id,
          articleId,
        })),
        skipDuplicates: true, // 避免并发问题
      })
    }

    return NextResponse.json({
      success: true,
      markedCount: newReadIds.length,
      alreadyReadCount: existingReadIds.size,
    })
  } catch (error) {
    console.error("批量标记已读失败:", error)
    return NextResponse.json({ error: "批量标记已读失败" }, { status: 500 })
  }
}

