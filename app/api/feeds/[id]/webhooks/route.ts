import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取 Feed 关联的所有 webhook
export async function GET(
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
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { id } = await params

    // 验证 Feed 是否存在且属于当前用户
    const feed = await prisma.feed.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    // 获取关联的 webhook
    const feedWebhooks = await prisma.feedWebhook.findMany({
      where: { feedId: id },
      include: {
        webhook: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const webhooks = feedWebhooks.map(fw => ({
      id: fw.webhook.id,
      name: fw.webhook.name,
      url: fw.webhook.url,
      method: fw.webhook.method,
      customFields: fw.webhook.customFields,
      remote: fw.webhook.remote,
      enabled: fw.webhook.enabled,
    }))

    return NextResponse.json(webhooks)
  } catch (error) {
    console.error("获取 Feed Webhook 列表失败:", error)
    return NextResponse.json({ error: "获取 Feed Webhook 列表失败" }, { status: 500 })
  }
}

// 为 Feed 添加 webhook
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
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { id } = await params
    const { webhookId } = await request.json()

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID 不能为空" }, { status: 400 })
    }

    // 验证 Feed 是否存在且属于当前用户
    const feed = await prisma.feed.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    // 验证 Webhook 是否存在且属于当前用户
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: user.id,
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 })
    }

    // 检查关联是否已存在
    const existing = await prisma.feedWebhook.findUnique({
      where: {
        feedId_webhookId: {
          feedId: id,
          webhookId: webhookId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: "该 Webhook 已关联到此订阅" }, { status: 400 })
    }

    // 创建关联
    const feedWebhook = await prisma.feedWebhook.create({
      data: {
        feedId: id,
        webhookId: webhookId,
      },
      include: {
        webhook: true,
      },
    })

    return NextResponse.json({
      id: feedWebhook.webhook.id,
      name: feedWebhook.webhook.name,
      url: feedWebhook.webhook.url,
      method: feedWebhook.webhook.method,
      customFields: feedWebhook.webhook.customFields,
      remote: feedWebhook.webhook.remote,
      enabled: feedWebhook.webhook.enabled,
    })
  } catch (error) {
    console.error("添加 Feed Webhook 失败:", error)
    return NextResponse.json({ error: "添加 Feed Webhook 失败" }, { status: 500 })
  }
}

// 移除 Feed 的 webhook
export async function DELETE(
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
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get("webhookId")

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID 不能为空" }, { status: 400 })
    }

    // 验证 Feed 是否存在且属于当前用户
    const feed = await prisma.feed.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!feed) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 })
    }

    // 验证关联是否存在
    const feedWebhook = await prisma.feedWebhook.findUnique({
      where: {
        feedId_webhookId: {
          feedId: id,
          webhookId: webhookId,
        },
      },
    })

    if (!feedWebhook) {
      return NextResponse.json({ error: "该 Webhook 未关联到此订阅" }, { status: 404 })
    }

    // 删除关联
    await prisma.feedWebhook.delete({
      where: {
        feedId_webhookId: {
          feedId: id,
          webhookId: webhookId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("移除 Feed Webhook 失败:", error)
    return NextResponse.json({ error: "移除 Feed Webhook 失败" }, { status: 500 })
  }
}

