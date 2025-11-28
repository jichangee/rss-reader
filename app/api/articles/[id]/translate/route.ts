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

    // 注意：需要先运行数据库迁移以添加新字段
    // npx prisma migrate dev --name add_translation_providers
    // 或使用: npx prisma db push
    const userRaw = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!userRaw) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 类型断言，因为 Prisma 类型可能还未更新
    const user = userRaw as typeof userRaw & {
      translationProvider?: string | null
      googleTranslateApiKey?: string | null
      niutransApiKey?: string | null
      microsoftTranslateApiKey?: string | null
      microsoftTranslateRegion?: string | null
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
    const targetLanguage = user.targetLanguage || "zh"
    
    if (!targetLanguage || targetLanguage.trim() === "") {
      return NextResponse.json({ error: "未设置目标语言" }, { status: 400 })
    }

    // 构建翻译配置
    const translationProvider = (user.translationProvider || "google") as "google" | "niutrans" | "microsoft"
    const translationConfig: TranslationConfig = {
      provider: translationProvider,
      googleApiKey: user.googleTranslateApiKey || undefined,
      niutransApiKey: user.niutransApiKey || undefined,
      microsoftApiKey: user.microsoftTranslateApiKey || undefined,
      microsoftRegion: user.microsoftTranslateRegion || undefined,
    }

    // 检查是否配置了相应的 API Key
    if (translationProvider === "google" && !translationConfig.googleApiKey) {
      return NextResponse.json({ error: "未配置 Google 翻译 API Key" }, { status: 400 })
    }
    if (translationProvider === "niutrans" && !translationConfig.niutransApiKey) {
      return NextResponse.json({ error: "未配置小牛翻译 API Key" }, { status: 400 })
    }
    if (translationProvider === "microsoft" && !translationConfig.microsoftApiKey) {
      return NextResponse.json({ error: "未配置微软翻译 API Key" }, { status: 400 })
    }

    // 翻译标题、内容和摘要
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

    // 记录翻译结果
    
    return NextResponse.json({
      success: true,
      targetLanguage, // 返回使用的目标语言，便于调试
      userTargetLanguage: user.targetLanguage, // 返回数据库中的原始值
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

