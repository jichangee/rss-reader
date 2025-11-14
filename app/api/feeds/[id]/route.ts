import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取单个订阅
export async function GET(
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

    const feed = await prisma.feed.findUnique({
      where: { id },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    if (feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限访问此订阅" }, { status: 403 })
    }

    return NextResponse.json(feed)
  } catch (error) {
    console.error("获取订阅失败:", error)
    return NextResponse.json({ error: "获取订阅失败" }, { status: 500 })
  }
}

// 更新订阅
export async function PUT(
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
    const { enableTranslation } = await request.json()

    const feed = await prisma.feed.findUnique({
      where: { id },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    if (feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限更新此订阅" }, { status: 403 })
    }

    const updatedFeed = await prisma.feed.update({
      where: { id },
      data: {
        enableTranslation: enableTranslation === true,
      },
    })

    return NextResponse.json(updatedFeed)
  } catch (error) {
    console.error("更新订阅失败:", error)
    return NextResponse.json({ error: "更新订阅失败" }, { status: 500 })
  }
}

// 删除订阅
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

    const feed = await prisma.feed.findUnique({
      where: { id },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    if (feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限删除此订阅" }, { status: 403 })
    }

    await prisma.feed.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除订阅失败:", error)
    return NextResponse.json({ error: "删除订阅失败" }, { status: 500 })
  }
}

