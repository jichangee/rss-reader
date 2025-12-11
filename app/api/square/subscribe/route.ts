import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

/**
 * 快速订阅Feed
 * POST /api/square/subscribe
 * 
 * Body:
 * {
 *   feedUrl: string  // RSS订阅地址
 * }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    // 获取当前用户
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const body = await request.json()
    const { feedUrl } = body

    if (!feedUrl || typeof feedUrl !== "string") {
      return NextResponse.json({ error: "请提供有效的订阅地址" }, { status: 400 })
    }

    // 检查是否已经订阅
    const existingFeed = await prisma.feed.findUnique({
      where: {
        userId_url: {
          userId: user.id,
          url: feedUrl
        }
      }
    })

    if (existingFeed) {
      return NextResponse.json({ 
        success: true, 
        feed: existingFeed,
        message: "您已经订阅过此RSS源"
      })
    }

    // 解析RSS源
    let parsedFeed
    try {
      parsedFeed = await parseRSSWithTimeout(feedUrl, 10000)
    } catch (parseError) {
      console.error("解析RSS失败:", parseError)
      return NextResponse.json(
        { error: "无法解析RSS源，请检查地址是否正确" },
        { status: 400 }
      )
    }

    if (!parsedFeed) {
      return NextResponse.json(
        { error: "RSS源解析失败" },
        { status: 400 }
      )
    }

    // 创建订阅
    const feed = await prisma.feed.create({
      data: {
        url: feedUrl,
        title: parsedFeed.title || "未命名订阅",
        description: parsedFeed.description || null,
        link: parsedFeed.link || null,
        imageUrl: parsedFeed.image?.url || null,
        userId: user.id,
        lastRefreshedAt: new Date()
      }
    })

    // 获取最新的文章（最多20篇）
    if (parsedFeed.items && parsedFeed.items.length > 0) {
      const articles = parsedFeed.items.slice(0, 20).map((item: any) => ({
        feedId: feed.id,
        title: item.title || "无标题",
        link: item.link || "",
        content: item.content,
        contentSnippet: item.contentSnippet,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        author: item.creator || item.author,
        guid: item.guid || item.link || `${feed.id}-${item.pubDate || Date.now()}`
      }))

      await prisma.article.createMany({
        data: articles,
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      success: true,
      feed,
      message: "订阅成功！"
    })
  } catch (error) {
    console.error("订阅失败:", error)
    return NextResponse.json(
      {
        error: "订阅失败",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
