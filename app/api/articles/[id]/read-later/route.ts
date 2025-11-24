import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 添加文章到稍后读
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

    // 检查是否已经在稍后读中
    const existingReadLater = await prisma.readLater.findUnique({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: id,
        },
      },
    })

    if (existingReadLater) {
      return NextResponse.json({ success: true, alreadyAdded: true })
    }

    await prisma.readLater.create({
      data: {
        userId: user.id,
        articleId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("添加稍后读失败:", error)
    return NextResponse.json({ error: "添加稍后读失败" }, { status: 500 })
  }
}

// 从稍后读中移除文章
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

    await prisma.readLater.deleteMany({
      where: {
        userId: user.id,
        articleId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("移除稍后读失败:", error)
    return NextResponse.json({ error: "移除稍后读失败" }, { status: 500 })
  }
}

