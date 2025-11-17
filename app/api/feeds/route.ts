import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 获取用户的所有订阅
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        feeds: {
          include: {
            articles: {
              orderBy: { pubDate: "desc" },
              take: 10,
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 为每个 feed 计算未读文章数
    const feedsWithUnreadCount = await Promise.all(
      user.feeds.map(async (feed) => {
        const unreadCount = await prisma.article.count({
          where: {
            feedId: feed.id,
            readBy: {
              none: {
                userId: user.id,
              },
            },
          },
        })

        return {
          ...feed,
          unreadCount,
        }
      })
    )

    return NextResponse.json(feedsWithUnreadCount)
  } catch (error) {
    console.error("获取订阅失败:", error)
    return NextResponse.json({ error: "获取订阅失败" }, { status: 500 })
  }
}

// 添加新的RSS订阅
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { url, enableTranslation = false } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "RSS链接不能为空" }, { status: 400 })
    }

    // 解析RSS feed (10秒超时)
    let feed
    try {
      feed = await parseRSSWithTimeout(url, 10000)
    } catch (error) {
      console.error("解析RSS失败:", error)
      const errorMessage = error instanceof Error && error.message === 'RSS解析超时' 
        ? "RSS解析超时，请稍后重试" 
        : "无效的RSS链接"
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 检查是否已订阅
    const existingFeed = await prisma.feed.findUnique({
      where: {
        userId_url: {
          userId: user.id,
          url: url,
        },
      },
    })

    if (existingFeed) {
      return NextResponse.json({ error: "已订阅此RSS" }, { status: 400 })
    }

    // 创建订阅
    const newFeed = await prisma.feed.create({
      data: {
        url,
        title: feed.title || "未命名订阅",
        description: feed.description,
        link: feed.link,
        imageUrl: feed.image?.url,
        enableTranslation: enableTranslation === true,
        userId: user.id,
      },
    })

    // 保存文章
    if (feed.items && feed.items.length > 0) {
      const articles = feed.items.slice(0, 20).map((item: any) => ({
        feedId: newFeed.id,
        title: item.title || "无标题",
        link: item.link || "",
        content: item.content,
        contentSnippet: item.contentSnippet,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        author: item.creator || item.author,
        guid: item.guid || item.link || `${newFeed.id}-${Date.now()}`,
      }))

      await prisma.article.createMany({
        data: articles,
        skipDuplicates: true,
      })
    }

    const feedWithArticles = await prisma.feed.findUnique({
      where: { id: newFeed.id },
      include: {
        articles: {
          orderBy: { pubDate: "desc" },
          take: 10,
        },
      },
    })

    // 计算未读文章数
    const unreadCount = await prisma.article.count({
      where: {
        feedId: newFeed.id,
        readBy: {
          none: {
            userId: user.id,
          },
        },
      },
    })

    return NextResponse.json({
      ...feedWithArticles,
      unreadCount,
    })
  } catch (error) {
    console.error("添加订阅失败:", error)
    return NextResponse.json({ error: "添加订阅失败" }, { status: 500 })
  }
}

