import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取播放列表
export async function GET(request: NextRequest) {
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

    // 获取播放列表，按最后播放时间倒序
    const playlistItems = await prisma.playlistItem.findMany({
      where: { userId: user.id },
      orderBy: { lastPlayedAt: "desc" },
      take: 50, // 限制返回最近50条
    })

    return NextResponse.json({ playlistItems })
  } catch (error) {
    console.error("获取播放列表失败:", error)
    return NextResponse.json(
      { error: "获取播放列表失败" },
      { status: 500 }
    )
  }
}

// 保存或更新播放进度
export async function POST(request: NextRequest) {
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
    const { videoId, videoUrl, title, thumbnail, duration, currentTime, articleId } = body

    if (!videoId || !videoUrl) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 使用 upsert 更新或创建播放记录
    const playlistItem = await prisma.playlistItem.upsert({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId: videoId,
        },
      },
      update: {
        currentTime: currentTime || 0,
        duration: duration || 0,
        title: title,
        thumbnail: thumbnail,
        lastPlayedAt: new Date(),
      },
      create: {
        userId: user.id,
        videoId: videoId,
        videoUrl: videoUrl,
        title: title,
        thumbnail: thumbnail,
        duration: duration || 0,
        currentTime: currentTime || 0,
        articleId: articleId,
      },
    })

    return NextResponse.json({ playlistItem })
  } catch (error) {
    console.error("保存播放进度失败:", error)
    return NextResponse.json(
      { error: "保存播放进度失败" },
      { status: 500 }
    )
  }
}

// 删除播放列表项
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get("videoId")

    if (!videoId) {
      return NextResponse.json(
        { error: "缺少videoId参数" },
        { status: 400 }
      )
    }

    await prisma.playlistItem.delete({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId: videoId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除播放列表项失败:", error)
    return NextResponse.json(
      { error: "删除播放列表项失败" },
      { status: 500 }
    )
  }
}

