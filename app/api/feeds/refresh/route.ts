import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 刷新所有订阅
export async function POST() {
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

    let successCount = 0
    let failCount = 0

    for (const feed of user.feeds) {
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
          },
        })

        // 添加新文章
        if (parsedFeed.items && parsedFeed.items.length > 0) {
          const articles = parsedFeed.items.slice(0, 20).map((item) => ({
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
      total: user.feeds.length 
    })
  } catch (error) {
    console.error("刷新订阅失败:", error)
    return NextResponse.json({ error: "刷新订阅失败" }, { status: 500 })
  }
}

