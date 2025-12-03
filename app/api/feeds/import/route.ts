import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRSSWithTimeout } from "@/lib/rss-parser"
import { FeedStatus } from "@/lib/feed-refresh-service"

// 从OPML文件导入订阅
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "请选择OPML文件" }, { status: 400 })
    }

    // 读取文件内容
    const text = await file.text()

    // 解析OPML文件，提取RSS链接
    const urls = parseOPML(text)

    if (urls.length === 0) {
      return NextResponse.json({ error: "OPML文件中没有找到有效的RSS链接" }, { status: 400 })
    }

    // 限制导入数量
    if (urls.length > 50) {
      return NextResponse.json({ error: "单次最多导入50个订阅" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    type SuccessResult = {
      success: boolean
      feed: {
        id: string
        url: string
        title: string
        description: string | null
        link: string | null
        imageUrl: string | null
        enableTranslation: boolean
        userId: string
        createdAt: Date
        updatedAt: Date
        unreadCount: number
      }
      url: string
    }
    const results: SuccessResult[] = []
    const errors: Array<{ url: string; error: string }> = []

    // 批量处理订阅（限制并发数）
    const batchSize = 5
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
          let parseResult
          try {
            parseResult = await parseRSSWithTimeout(trimmedUrl, 10000)
          } catch (error) {
            const errorMessage = error instanceof Error && error.message === 'RSS解析超时' 
              ? "RSS解析超时，请稍后重试" 
              : "无效的RSS链接"
            throw new Error(errorMessage)
          }
          const feed = parseResult.feed

          // 创建订阅（设置初始状态和下次刷新时间）
          const now = new Date()
          const newFeed = await prisma.feed.create({
            data: {
              url: trimmedUrl,
              title: feed.title || "未命名订阅",
              description: feed.description,
              link: feed.link,
              imageUrl: feed.image?.url,
              enableTranslation: false, // 导入时默认不启用翻译
              userId: user.id,
              status: FeedStatus.ACTIVE, // 初始状态为 ACTIVE
              errorCount: 0,
              // 设置下次刷新时间为 15 分钟后（允许立即刷新）
              nextFetchAt: new Date(now.getTime() + 15 * 60 * 1000),
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
          if (result.value && result.value.success) {
            results.push(result.value)
          } else {
            errors.push({
              url,
              error: "添加失败",
            })
          }
        } else {
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
    console.error("导入订阅失败:", error)
    return NextResponse.json({ error: "导入订阅失败" }, { status: 500 })
  }
}

// 解析OPML文件，提取RSS链接
function parseOPML(opmlText: string): string[] {
  const urls: string[] = []
  
  try {
    // 使用正则表达式提取xmlUrl属性
    const xmlUrlRegex = /xmlUrl=["']([^"']+)["']/gi
    let match
    
    while ((match = xmlUrlRegex.exec(opmlText)) !== null) {
      const url = match[1]
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        urls.push(url)
      }
    }

    // 如果没有找到xmlUrl，尝试查找type="rss"的outline标签中的url属性
    if (urls.length === 0) {
      const rssRegex = /<outline[^>]*type=["']rss["'][^>]*url=["']([^"']+)["']/gi
      while ((match = rssRegex.exec(opmlText)) !== null) {
        const url = match[1]
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          urls.push(url)
        }
      }
    }
  } catch (error) {
    console.error("解析OPML失败:", error)
  }

  return urls
}

