import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"

// 批量添加RSS订阅
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { urls, enableTranslation = false } = await request.json()

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "RSS链接列表不能为空" }, { status: 400 })
    }

    // 限制批量添加数量
    if (urls.length > 50) {
      return NextResponse.json({ error: "单次最多添加50个订阅" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const results = []
    const errors = []

    // 并行处理所有URL（但限制并发数）
    const batchSize = 5 // 每批处理5个
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (url: string) => {
          const trimmedUrl = url.trim()
          
          if (!trimmedUrl) {
            throw new Error("RSS链接不能为空")
          }

          // 检查是否已订阅
          const existingFeed = await prisma.feed.findUnique({
            where: {
              userId_url: {
                userId: user.id,
                url: trimmedUrl,
              },
            },
          })

          if (existingFeed) {
            throw new Error("已订阅此RSS")
          }

          // 解析RSS feed (10秒超时)
          let feed
          try {
            feed = await parseRSSWithTimeout(trimmedUrl, 10000)
          } catch (error) {
            const errorMessage = error instanceof Error && error.message === 'RSS解析超时' 
              ? "RSS解析超时，请稍后重试" 
              : "无效的RSS链接"
            throw new Error(errorMessage)
          }

          // 创建订阅
          const newFeed = await prisma.feed.create({
            data: {
              url: trimmedUrl,
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

          return {
            success: true,
            feed: {
              ...newFeed,
              unreadCount,
            },
            url: trimmedUrl,
          }
        })
      )

      // 处理批次结果
      batchResults.forEach((result, index) => {
        const url = batch[index]
        if (result.status === "fulfilled") {
          // Promise成功完成，result.value包含返回的对象
          if (result.value && result.value.success) {
            results.push(result.value)
          } else {
            errors.push({
              url,
              error: result.value?.error || "添加失败",
            })
          }
        } else {
          // Promise被拒绝，result.reason包含错误
          const errorMessage = result.reason instanceof Error 
            ? result.reason.message 
            : typeof result.reason === 'string' 
            ? result.reason 
            : "添加失败"
          errors.push({
            url,
            error: errorMessage,
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: urls.length,
        success: results.length,
        failed: errors.length,
      },
    })
  } catch (error) {
    console.error("批量添加订阅失败:", error)
    return NextResponse.json({ error: "批量添加订阅失败" }, { status: 500 })
  }
}

