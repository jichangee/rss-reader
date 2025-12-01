import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { translateText, TranslationConfig } from "@/lib/translate"

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

    const userRaw = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        feeds: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 类型断言，因为 Prisma 类型可能还未更新
    const user = userRaw as typeof userRaw & {
      id: string
      targetLanguage?: string | null
      translationProvider?: string | null
      googleTranslateApiKey?: string | null
      niutransApiKey?: string | null
      microsoftTranslateApiKey?: string | null
      microsoftTranslateRegion?: string | null
      feeds: Array<{ id: string }>
    }

    const feedIds = user.feeds?.map((f) => f.id) || []

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

    // 先获取所有符合条件的文章ID（用于获取稍后读文章）
    const allArticleIds = await prisma.article.findMany({
      where: {
        feedId: feedId || { in: feedIds },
      },
      select: { id: true },
    })

    const articleIds = allArticleIds.map(a => a.id)

    // 获取用户的所有稍后读文章ID（不受 unreadOnly 限制）
    const readLaterArticles = await prisma.readLater.findMany({
      where: {
        userId: user.id,
        articleId: { in: articleIds },
      },
      select: { articleId: true },
      orderBy: { addedAt: "desc" },
    })

    const readLaterArticleIds = new Set(readLaterArticles.map(rl => rl.articleId))

    // 分别获取稍后读文章和其他文章
    // 稍后读文章应该始终显示，不受 unreadOnly 限制
    const readLaterWhere = {
      feedId: feedId || { in: feedIds },
      id: { in: Array.from(readLaterArticleIds) },
    }

    const otherWhere = {
      ...where,
      id: { notIn: Array.from(readLaterArticleIds) },
    }

    // 获取稍后读文章
    const readLaterArticlesData = readLaterArticleIds.size > 0 ? await prisma.article.findMany({
      where: readLaterWhere,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
    }) : []

    // 计算还需要获取多少其他文章
    const remainingLimit = limit + 1 - readLaterArticlesData.length
    const otherArticles = remainingLimit > 0 ? await prisma.article.findMany({
      where: otherWhere,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: { pubDate: "desc" },
      take: remainingLimit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // 跳过 cursor 本身
      }),
    }) : []

    // 合并结果：稍后读文章在前，其他文章在后
    const articles = [...readLaterArticlesData, ...otherArticles]

    const hasNextPage = articles.length > limit
    const returnArticles = hasNextPage ? articles.slice(0, limit) : articles
    const nextCursor = hasNextPage ? returnArticles[returnArticles.length - 1].id : null

    // 获取用户的翻译配置
    const targetLanguage = user.targetLanguage || "zh"
    const translationProvider = (user.translationProvider || "google") as "google" | "niutrans" | "microsoft"
    const translationConfig: TranslationConfig = {
      provider: translationProvider,
      googleApiKey: user.googleTranslateApiKey || undefined,
      niutransApiKey: user.niutransApiKey || undefined,
      microsoftApiKey: user.microsoftTranslateApiKey || undefined,
      microsoftRegion: user.microsoftTranslateRegion || undefined,
    }

    // 为每篇文章添加 isReadLater 标记，并对启用了翻译的文章进行翻译
    const articlesWithReadLater = await Promise.all(
      returnArticles.map(async (article) => {
        const baseArticle = {
          ...article,
          isReadLater: article.readLaterBy && article.readLaterBy.length > 0,
        }

        // 如果该 feed 启用了翻译，且用户设置了目标语言，则进行翻译
        if (article.feed.enableTranslation && targetLanguage && targetLanguage.trim() !== "") {
          try {
            // 并行翻译标题、内容和摘要
            const [translatedTitle, translatedContent, translatedSnippet] = await Promise.all([
              translateText({
                text: article.title,
                targetLanguage,
                config: translationConfig,
              }),
              article.content
                ? translateText({
                    text: article.content,
                    targetLanguage,
                    config: translationConfig,
                  })
                : Promise.resolve(article.content),
              article.contentSnippet
                ? translateText({
                    text: article.contentSnippet,
                    targetLanguage,
                    config: translationConfig,
                  })
                : Promise.resolve(article.contentSnippet),
            ])

            return {
              ...baseArticle,
              title: translatedTitle,
              content: translatedContent,
              contentSnippet: translatedSnippet,
              translated: true, // 标记已翻译
            }
          } catch (error) {
            console.error(`翻译文章 ${article.id} 失败:`, error)
            // 翻译失败时返回原文
            return baseArticle
          }
        }

        return baseArticle
      })
    )

    return NextResponse.json({
      articles: articlesWithReadLater,
      nextCursor,
      hasNextPage,
    })
  } catch (error) {
    console.error("获取文章失败:", error)
    return NextResponse.json({ error: "获取文章失败" }, { status: 500 })
  }
}

