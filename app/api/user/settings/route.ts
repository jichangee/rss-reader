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
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    return NextResponse.json({
      targetLanguage: user.targetLanguage || "zh",
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

    const { targetLanguage } = await request.json()

    if (!targetLanguage) {
      return NextResponse.json({ error: "目标语言不能为空" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        targetLanguage,
      },
      select: {
        targetLanguage: true,
      },
    })

    return NextResponse.json({
      targetLanguage: user.targetLanguage,
    })
  } catch (error) {
    console.error("更新用户设置失败:", error)
    return NextResponse.json({ error: "更新用户设置失败" }, { status: 500 })
  }
}

