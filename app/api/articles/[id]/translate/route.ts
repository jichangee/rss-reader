import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { translateText, TranslationConfig } from "@/lib/translate"

// 翻译单篇文章
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const userRaw = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { id } = await params

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    })

    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 })
    }

    // 检查订阅是否启用了翻译
    if (!article.feed.enableTranslation) {
      return NextResponse.json({ error: "该订阅未启用翻译" }, { status: 400 })
    }

    // 获取用户的目标语言设置
    const targetLanguage = userRaw.targetLanguage || "zh"
    
    if (!targetLanguage || targetLanguage.trim() === "") {
      return NextResponse.json({ error: "未设置目标语言" }, { status: 400 })
    }

    // 构建翻译配置（仅使用Google翻译）
    const translationConfig: TranslationConfig = {
      provider: "google",
    }

    // 合并标题、内容和摘要，使用特殊分隔符标记各部分
    // 使用不易被翻译的标记，确保翻译后仍能识别
    const separators = {
      title: "|||TITLE|||",
      content: "|||CONTENT|||",
      snippet: "|||SNIPPET|||",
    }

    const parts: string[] = []
    
    // 构建合并文本，按顺序添加各部分
    parts.push(separators.title)
    parts.push(article.title || "")
    
    if (article.content) {
      parts.push(separators.content)
      parts.push(article.content)
    }
    
    if (article.contentSnippet) {
      parts.push(separators.snippet)
      parts.push(article.contentSnippet)
    }

    const combinedText = parts.join("\n\n")

    // 一次性翻译合并后的文本
    const translatedCombined = await translateText({
      text: combinedText,
      targetLanguage,
      config: translationConfig,
    })

    // 按分隔符拆分翻译结果
    let translatedTitle = article.title
    let translatedContent = article.content
    let translatedSnippet = article.contentSnippet

    // 查找各个分隔符的位置
    const titleIndex = translatedCombined.indexOf(separators.title)
    const contentIndex = translatedCombined.indexOf(separators.content)
    const snippetIndex = translatedCombined.indexOf(separators.snippet)

    // 提取标题部分
    if (titleIndex !== -1) {
      const titleEnd = contentIndex !== -1 ? contentIndex : snippetIndex !== -1 ? snippetIndex : translatedCombined.length
      translatedTitle = translatedCombined
        .substring(titleIndex + separators.title.length, titleEnd)
        .replace(/^\n+|\n+$/g, "")
        .trim()
    }

    // 提取内容部分
    if (contentIndex !== -1) {
      const contentEnd = snippetIndex !== -1 ? snippetIndex : translatedCombined.length
      translatedContent = translatedCombined
        .substring(contentIndex + separators.content.length, contentEnd)
        .replace(/^\n+|\n+$/g, "")
        .trim()
    }

    // 提取摘要部分
    if (snippetIndex !== -1) {
      translatedSnippet = translatedCombined
        .substring(snippetIndex + separators.snippet.length)
        .replace(/^\n+|\n+$/g, "")
        .trim()
    }

    return NextResponse.json({
      success: true,
      targetLanguage,
      translated: {
        title: translatedTitle,
        content: translatedContent,
        contentSnippet: translatedSnippet,
      },
    })
  } catch (error) {
    console.error("翻译文章失败:", error)
    return NextResponse.json({ error: "翻译文章失败" }, { status: 500 })
  }
}

