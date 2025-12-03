import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取用户设置
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        targetLanguage: true,
        translationProvider: true,
        googleTranslateApiKey: true,
        niutransApiKey: true,
        niutransApiSecret: true,
        microsoftTranslateApiKey: true,
        microsoftTranslateRegion: true,
        markReadOnScroll: true,
        autoRefreshOnLoad: true,
        hideImagesAndVideos: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    return NextResponse.json({
      targetLanguage: user.targetLanguage || "zh",
      translationProvider: user.translationProvider || "google",
      googleTranslateApiKey: user.googleTranslateApiKey || "",
      niutransApiKey: user.niutransApiKey || "",
      niutransApiSecret: user.niutransApiSecret || "",
      microsoftTranslateApiKey: user.microsoftTranslateApiKey || "",
      microsoftTranslateRegion: user.microsoftTranslateRegion || "global",
      markReadOnScroll: user.markReadOnScroll ?? false,
      autoRefreshOnLoad: user.autoRefreshOnLoad ?? true,
      hideImagesAndVideos: user.hideImagesAndVideos ?? false,
    })
  } catch (error) {
    console.error("获取用户设置失败:", error)
    return NextResponse.json({ error: "获取用户设置失败" }, { status: 500 })
  }
}

// 更新用户设置
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { 
      targetLanguage, 
      translationProvider,
      googleTranslateApiKey,
      niutransApiKey,
      niutransApiSecret,
      microsoftTranslateApiKey,
      microsoftTranslateRegion,
      markReadOnScroll, 
      autoRefreshOnLoad,
      hideImagesAndVideos
    } = await request.json()

    if (!targetLanguage) {
      return NextResponse.json({ error: "目标语言不能为空" }, { status: 400 })
    }

    // 构建更新数据对象
    const updateData: any = {
      targetLanguage,
      markReadOnScroll,
      autoRefreshOnLoad,
      hideImagesAndVideos,
    }

    // 如果提供了翻译服务配置，则更新
    if (translationProvider !== undefined) {
      updateData.translationProvider = translationProvider
    }
    if (googleTranslateApiKey !== undefined) {
      updateData.googleTranslateApiKey = googleTranslateApiKey || null
    }
    if (niutransApiKey !== undefined) {
      updateData.niutransApiKey = niutransApiKey || null
    }
    if (niutransApiSecret !== undefined) {
      updateData.niutransApiSecret = niutransApiSecret || null
    }
    if (microsoftTranslateApiKey !== undefined) {
      updateData.microsoftTranslateApiKey = microsoftTranslateApiKey || null
    }
    if (microsoftTranslateRegion !== undefined) {
      updateData.microsoftTranslateRegion = microsoftTranslateRegion || null
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        targetLanguage: true,
        translationProvider: true,
        googleTranslateApiKey: true,
        niutransApiKey: true,
        niutransApiSecret: true,
        microsoftTranslateApiKey: true,
        microsoftTranslateRegion: true,
        markReadOnScroll: true,
        autoRefreshOnLoad: true,
        hideImagesAndVideos: true,
      },
    })

    return NextResponse.json({
      targetLanguage: user.targetLanguage,
      translationProvider: user.translationProvider,
      googleTranslateApiKey: user.googleTranslateApiKey || "",
      niutransApiKey: user.niutransApiKey || "",
      niutransApiSecret: user.niutransApiSecret || "",
      microsoftTranslateApiKey: user.microsoftTranslateApiKey || "",
      microsoftTranslateRegion: user.microsoftTranslateRegion || "global",
      markReadOnScroll: user.markReadOnScroll,
      autoRefreshOnLoad: user.autoRefreshOnLoad,
      hideImagesAndVideos: user.hideImagesAndVideos,
    })
  } catch (error) {
    console.error("更新用户设置失败:", error)
    return NextResponse.json({ error: "更新用户设置失败" }, { status: 500 })
  }
}

