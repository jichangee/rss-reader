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

    // 为每篇文章添加 isReadLater 标记
    const articlesWithReadLater = returnArticles.map((article) => ({
      ...article,
      isReadLater: article.readLaterBy && article.readLaterBy.length > 0,
    }))

    // 收集需要翻译的文章
    const articlesToTranslate = articlesWithReadLater.filter(
      (article) => article.feed.enableTranslation && targetLanguage && targetLanguage.trim() !== ""
    )
    
    // 如果有需要翻译的文章，批量翻译
    if (articlesToTranslate.length > 0) {
      try {
        // 使用特殊分隔符标记各部分，使用纯数字和特殊字符组合，避免被翻译
        const separators = {
          articleStart: (id: string) => `|||#0#${id}#0#|||`,
          articleEnd: (id: string) => `|||#4#${id}#4#|||`,
          title: "|||#1#|||",
          content: "|||#2#|||",
          snippet: "|||#3#|||",
        }

        // 构建合并文本，包含所有需要翻译的文章
        const combinedParts: string[] = []
        const articleMap = new Map<string, typeof articlesToTranslate[0]>()

        for (const article of articlesToTranslate) {
          articleMap.set(article.id, article)
          
          combinedParts.push(separators.articleStart(article.id))
          combinedParts.push(separators.title)
          combinedParts.push(article.title || "")
          
          if (article.content) {
            combinedParts.push(separators.content)
            combinedParts.push(article.content)
          }
          
          if (article.contentSnippet) {
            combinedParts.push(separators.snippet)
            combinedParts.push(article.contentSnippet)
          }
          
          combinedParts.push(separators.articleEnd(article.id))
        }

        const combinedText = combinedParts.join("\n\n")
        
        // 一次性翻译所有文章的内容
        const translatedCombined = await translateText({
          text: combinedText,
          targetLanguage,
          config: translationConfig,
        })

        // 解析翻译结果，按文章ID和字段类型分配
        const translations = new Map<
          string,
          { title?: string; content?: string; contentSnippet?: string }
        >()

        for (const article of articlesToTranslate) {
          const articleStartMarker = separators.articleStart(article.id)
          const articleEndMarker = separators.articleEnd(article.id)
          
          const startIndex = translatedCombined.indexOf(articleStartMarker)
          const endIndex = translatedCombined.indexOf(articleEndMarker)

          if (startIndex !== -1 && endIndex !== -1) {
            const articleText = translatedCombined.substring(
              startIndex + articleStartMarker.length,
              endIndex
            )

            const translation: { title?: string; content?: string; contentSnippet?: string } = {}

            // 提取标题
            const titleIndex = articleText.indexOf(separators.title)
            if (titleIndex !== -1) {
              const titleEnd = articleText.indexOf(separators.content, titleIndex)
              const contentEnd = articleText.indexOf(separators.snippet, titleIndex)
              const end = titleEnd !== -1 ? titleEnd : contentEnd !== -1 ? contentEnd : articleText.length
              
              translation.title = articleText
                .substring(titleIndex + separators.title.length, end)
                .replace(/^\n+|\n+$/g, "")
                .trim() || article.title
            } else {
              translation.title = article.title
            }

            // 提取内容
            const contentIndex = articleText.indexOf(separators.content)
            if (contentIndex !== -1) {
              const contentEnd = articleText.indexOf(separators.snippet, contentIndex)
              const end = contentEnd !== -1 ? contentEnd : articleText.length
              
              const translatedContent = articleText
                .substring(contentIndex + separators.content.length, end)
                .replace(/^\n+|\n+$/g, "")
                .trim()
              translation.content = translatedContent || article.content || undefined
            } else {
              translation.content = article.content || undefined
            }

            // 提取摘要
            const snippetIndex = articleText.indexOf(separators.snippet)
            if (snippetIndex !== -1) {
              const translatedSnippet = articleText
                .substring(snippetIndex + separators.snippet.length)
                .replace(/^\n+|\n+$/g, "")
                .trim()
              translation.contentSnippet = translatedSnippet || article.contentSnippet || undefined
            } else {
              translation.contentSnippet = article.contentSnippet || undefined
            }

            translations.set(article.id, translation)
          }
        }

        // 将翻译结果应用到文章
        for (let i = 0; i < articlesWithReadLater.length; i++) {
          const article = articlesWithReadLater[i]
          const translation = translations.get(article.id)
          
          if (translation) {
            articlesWithReadLater[i] = {
              ...article,
              title: translation.title ?? article.title,
              content: translation.content ?? article.content ?? undefined,
              contentSnippet: translation.contentSnippet ?? article.contentSnippet ?? undefined,
              translated: true,
            } as typeof article & { translated: boolean }
          }
        }
      } catch (error) {
        console.error("批量翻译文章失败:", error)
        // 翻译失败时返回原文，不影响其他功能
      }
    }

    // 自动移除已经在返回列表中的稍后读文章状态
    // 这样稍后读的文章只在第一次刷新时显示在第一个，之后就不会再显示了
    const articlesToRemoveReadLater = articlesWithReadLater
      .filter((article) => article.readLaterBy && article.readLaterBy.length > 0)
      .map((article) => article.id)

    if (articlesToRemoveReadLater.length > 0) {
      try {
        // 批量删除稍后读记录
        await prisma.readLater.deleteMany({
          where: {
            userId: user.id,
            articleId: { in: articlesToRemoveReadLater },
          },
        })

        // 更新文章的 isReadLater 标记
        articlesWithReadLater.forEach((article) => {
          if (articlesToRemoveReadLater.includes(article.id)) {
            article.isReadLater = false
            article.readLaterBy = []
          }
        })
      } catch (error) {
        console.error("自动移除稍后读状态失败:", error)
        // 失败时不影响返回结果，继续返回文章列表
      }
    }

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

