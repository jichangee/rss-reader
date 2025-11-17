import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { translateText } from "@/lib/translate"

// 获取所有文章（支持分页）
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const feedId = searchParams.get("feedId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const cursor = searchParams.get("cursor")
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        targetLanguage: true,
        feeds: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const feedIds = user.feeds.map((f) => f.id)

    const where: any = {
      feedId: feedId || { in: feedIds },
    }

    if (unreadOnly) {
      where.readBy = {
        none: {
          userId: user.id,
        },
      }
    }

    const articles = await prisma.article.findMany({
      where,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
      take: limit + 1, // 多取一个用来判断是否有下一页
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // 跳过 cursor 本身
      }),
    })

    const hasNextPage = articles.length > limit
    const returnArticles = hasNextPage ? articles.slice(0, limit) : articles
    const nextCursor = hasNextPage ? returnArticles[returnArticles.length - 1].id : null

    // 获取用户的目标语言设置
    const targetLanguage = user.targetLanguage || "zh"

    // 对需要翻译的文章进行翻译
    const translatedArticles = await Promise.all(
      returnArticles.map(async (article) => {
        // 如果订阅启用了翻译，则翻译标题和内容
        if (article.feed.enableTranslation && targetLanguage) {
          const [translatedTitle, translatedContent, translatedSnippet] = await Promise.all([
            translateText({
              text: article.title,
              targetLanguage,
            }),
            article.content
              ? translateText({
                  text: article.content,
                  targetLanguage,
                })
              : Promise.resolve(article.content),
            article.contentSnippet
              ? translateText({
                  text: article.contentSnippet,
                  targetLanguage,
                })
              : Promise.resolve(article.contentSnippet),
          ])

          return {
            ...article,
            title: translatedTitle,
            content: translatedContent,
            contentSnippet: translatedSnippet,
          }
        }

        return article
      })
    )

    return NextResponse.json({
      articles: translatedArticles,
      nextCursor,
      hasNextPage,
    })
  } catch (error) {
    console.error("获取文章失败:", error)
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 })
  }
}

