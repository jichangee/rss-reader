import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 验证邮箱验证码
 * POST /api/auth/verify-code
 */
export async function POST(request: Request) {
  try {
    const { email, code } = await request.json()

    // 验证输入
    if (!email || !code) {
      return NextResponse.json({ error: "请提供邮箱和验证码" }, { status: 400 })
    }

    // 查找验证码记录
    const verificationCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        code,
        used: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!verificationCode) {
      return NextResponse.json({ error: "验证码不正确" }, { status: 400 })
    }

    // 检查是否过期
    if (new Date() > verificationCode.expiresAt) {
      return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 })
    }

    // 标记验证码为已使用
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true }
    })

    // 检查用户是否存在，不存在则创建
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0], // 使用邮箱前缀作为默认名称
        }
      })
      console.log(`新用户创建: ${email}`)
    }

    console.log(`用户验证成功: ${email}`)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error("验证码验证失败:", error)
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    )
  }
}
