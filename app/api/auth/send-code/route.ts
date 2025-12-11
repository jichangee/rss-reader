import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendVerificationCode, generateVerificationCode } from "@/lib/email"

/**
 * 发送邮箱验证码
 * POST /api/auth/send-code
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    // 验证邮箱格式
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: "请提供有效的邮箱地址" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 })
    }

    // 检查最近5分钟内是否已发送验证码
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentCode = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        createdAt: {
          gte: fiveMinutesAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (recentCode) {
      const remainingSeconds = Math.ceil((recentCode.createdAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000)
      return NextResponse.json(
        { error: `请等待${remainingSeconds}秒后再试` },
        { status: 429 }
      )
    }

    // 生成6位验证码
    const code = generateVerificationCode()

    // 保存验证码到数据库
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期
    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt
      }
    })

    // 发送邮件
    const result = await sendVerificationCode(email, code)

    if (!result.success) {
      // 发送失败，删除验证码记录
      await prisma.emailVerificationCode.deleteMany({
        where: { email, code }
      })
      return NextResponse.json(
        { error: "发送邮件失败，请稍后重试" },
        { status: 500 }
      )
    }

    console.log(`验证码已发送到 ${email}`)

    return NextResponse.json({
      success: true,
      message: "验证码已发送，请查收邮件"
    })
  } catch (error) {
    console.error("发送验证码失败:", error)
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    )
  }
}
