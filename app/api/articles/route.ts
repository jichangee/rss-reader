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
    const readLaterOnly = searchParams.get("readLaterOnly") === "true"
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

    // 获取用户的所有稍后读文章ID
    const readLaterRecords = await prisma.readLater.findMany({
      where: {
        userId: user.id,
      },
      select: { articleId: true },
      orderBy: { addedAt: "desc" },
    })
    const readLaterArticleIds = new Set(readLaterRecords.map(rl => rl.articleId))

    // 构建查询条件
    const where: any = {
      feedId: feedId || { in: feedIds },
    }

    if (readLaterOnly) {
      // 稍后读模式：只获取稍后读文章
      where.id = { in: Array.from(readLaterArticleIds) }
    } else {
      // 普通模式：排除稍后读文章
      if (readLaterArticleIds.size > 0) {
        where.id = { notIn: Array.from(readLaterArticleIds) }
      }
    }

    if (unreadOnly && !readLaterOnly) {
      where.readBy = {
        none: {
          userId: user.id,
        },
      }
    }

    // 获取文章
    const articles = await prisma.article.findMany({
      where,
      include: {
        feed: true,
        readBy: {
          where: { userId: user.id },
        },
        readLaterBy: {
          where: { userId: user.id },
        },
      },
      orderBy: readLaterOnly 
        ? { readLaterBy: { _count: "desc" } } // 稍后读按添加时间排序（通过关联表）
        : { pubDate: "desc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    // 如果是稍后读模式，按添加时间重新排序
    let sortedArticles = articles
    if (readLaterOnly && articles.length > 0) {
      // 获取稍后读记录的添加时间
      const readLaterWithTime = await prisma.readLater.findMany({
        where: {
          userId: user.id,
          articleId: { in: articles.map(a => a.id) },
        },
        select: { articleId: true, addedAt: true },
      })
      const addedAtMap = new Map(readLaterWithTime.map(r => [r.articleId, r.addedAt]))
      
      // 按添加时间降序排序
      sortedArticles = [...articles].sort((a, b) => {
        const timeA = addedAtMap.get(a.id)?.getTime() || 0
        const timeB = addedAtMap.get(b.id)?.getTime() || 0
        return timeB - timeA
      })
    }

    const hasNextPage = sortedArticles.length > limit
    const returnArticles = hasNextPage ? sortedArticles.slice(0, limit) : sortedArticles
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
      isReadLater: readLaterArticleIds.has(article.id),
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

