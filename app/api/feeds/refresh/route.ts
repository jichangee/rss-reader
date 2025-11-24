import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 刷新订阅
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取请求体中的 feedIds
    let feedIds: string[] | undefined
    try {
      const body = await req.json()
      feedIds = body.feedIds
    } catch (e) {
      // 忽略 JSON 解析错误，视为全量刷新
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { 
        feeds: {
          where: feedIds ? { id: { in: feedIds } } : undefined
        } 
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    let successCount = 0
    let failCount = 0
    let skippedCount = 0
    const minRefreshInterval = 5 * 60 * 1000 // 5分钟

    for (const feed of user.feeds) {
      // 检查刷新间隔
      if (feed.lastRefreshedAt && Date.now() - new Date(feed.lastRefreshedAt).getTime() < minRefreshInterval) {
        skippedCount++
        continue
      }

      try {
        const parsedFeed = await parseRSSWithTimeout(feed.url, 10000)
        
        // 更新feed信息
        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            title: parsedFeed.title || feed.title,
            description: parsedFeed.description || feed.description,
            link: parsedFeed.link || feed.link,
            imageUrl: parsedFeed.image?.url || feed.imageUrl,
            lastRefreshedAt: new Date(), // 更新刷新时间
          },
        })

        // 添加新文章
        if (parsedFeed.items && parsedFeed.items.length > 0) {
          const articles = parsedFeed.items.slice(0, 20).map((item: any) => ({
            feedId: feed.id,
            title: item.title || "无标题",
            link: item.link || "",
            content: item.content,
            contentSnippet: item.contentSnippet,
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            author: item.creator || item.author,
            guid: item.guid || item.link || `${feed.id}-${Date.now()}`,
          }))

          await prisma.article.createMany({
            data: articles,
            skipDuplicates: true,
          })
        }

        successCount++
      } catch (error) {
        console.error(`刷新订阅 ${feed.title} 失败:`, error)
        failCount++
      }
    }

    return NextResponse.json({ 
      success: true, 
      successCount, 
      failCount,
      skippedCount,
      total: user.feeds.length 
    })
  } catch (error) {
    console.error("刷新订阅失败:", error)
    return NextResponse.json({ error: "刷新订阅失败" }, { status: 500 })
  }
}

