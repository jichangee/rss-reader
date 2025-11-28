import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { translateText } from "@/lib/translate"

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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        targetLanguage: true,
      },
    })

    if (!user) {
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
    // 注意：如果user.targetLanguage为null，使用默认值"zh"
    // 但应该确保用户设置中已经保存了目标语言
    const targetLanguage = user.targetLanguage || "zh"
    
    console.log(`[翻译API] 文章ID: ${id}, 用户目标语言设置: ${user.targetLanguage}, 实际使用: ${targetLanguage}`)

    if (!targetLanguage || targetLanguage.trim() === "") {
      return NextResponse.json({ error: "未设置目标语言" }, { status: 400 })
    }

    // 翻译标题、内容和摘要
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

    return NextResponse.json({
      success: true,
      targetLanguage, // 返回使用的目标语言，便于调试
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

