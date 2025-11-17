import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

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
    const { title, url, enableTranslation } = await request.json()

    const feed = await prisma.feed.findUnique({
      where: { id },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    if (feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限更新此订阅" }, { status: 403 })
    }

    // 准备更新数据
    const updateData: {
      title?: string
      url?: string
      enableTranslation?: boolean
    } = {}

    // 如果提供了新的标题，则更新
    if (title !== undefined && title.trim()) {
      updateData.title = title.trim()
    }

    // 如果提供了新的URL，先验证它是否有效
    if (url !== undefined && url !== feed.url) {
      const newUrl = url.trim()
      if (!newUrl) {
        return NextResponse.json({ error: "RSS链接不能为空" }, { status: 400 })
      }

      // 验证新的URL是否可以解析
      try {
        const parsedFeed = await parseRSSWithTimeout(newUrl, 10000)
        updateData.url = newUrl
        // 如果URL改变了，可以选择同时更新从RSS获取的元数据
        if (!title) {
          updateData.title = parsedFeed.title || feed.title
        }
      } catch (error) {
        console.error("验证新RSS链接失败:", error)
        const errorMessage = error instanceof Error && error.message === 'RSS解析超时' 
          ? "RSS解析超时，请稍后重试" 
          : "无效的RSS链接"
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      // 检查新URL是否已被该用户订阅
      const existingFeed = await prisma.feed.findUnique({
        where: {
          userId_url: {
            userId: user.id,
            url: newUrl,
          },
        },
      })

      if (existingFeed && existingFeed.id !== id) {
        return NextResponse.json({ error: "该RSS链接已被订阅" }, { status: 400 })
      }
    }

    // 如果提供了翻译设置，则更新
    if (enableTranslation !== undefined) {
      updateData.enableTranslation = enableTranslation === true
    }

    // 如果没有任何更新，直接返回原数据
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(feed)
    }

    const updatedFeed = await prisma.feed.update({
      where: { id },
      data: updateData,
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

