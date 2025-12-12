import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 标记文章为已读
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const article = await prisma.article.findUnique({
      where: { id },
    })

    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 })
    }

    // 检查是否已标记为已读
    const existingRead = await prisma.readArticle.findUnique({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: id,
        },
      },
    })

    if (existingRead) {
      return NextResponse.json({ success: true, alreadyRead: true })
    }

    await prisma.readArticle.create({
      data: {
        userId: user.id,
        articleId: id,
      },
    })

    // 更新用户最后活跃时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("标记已读失败:", error)
    return NextResponse.json({ error: "标记已读失败" }, { status: 500 })
  }
}

// 取消已读标记
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    await prisma.readArticle.deleteMany({
      where: {
        userId: user.id,
        articleId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("取消已读标记失败:", error)
    return NextResponse.json({ error: "取消已读标记失败" }, { status: 500 })
  }
}

