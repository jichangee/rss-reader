import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取单个 webhook 详情
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

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        feeds: {
          include: {
            feed: {
              select: {
                id: true,
                title: true,
                url: true,
              },
            },
          },
        },
      },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 })
    }

    return NextResponse.json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      customFields: webhook.customFields,
      remote: webhook.remote,
      enabled: webhook.enabled,
      feeds: webhook.feeds.map(fw => ({
        id: fw.feed.id,
        title: fw.feed.title,
        url: fw.feed.url,
      })),
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    })
  } catch (error) {
    console.error("获取 Webhook 详情失败:", error)
    return NextResponse.json({ error: "获取 Webhook 详情失败" }, { status: 500 })
  }
}

// 更新 webhook
export async function PUT(
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
    const { name, url, method, customFields, remote, enabled } = await request.json()

    // 验证 webhook 是否存在且属于当前用户
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 })
    }

    const updateData: any = {}

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Webhook 名称不能为空" }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    if (url !== undefined) {
      if (!url || !url.trim()) {
        return NextResponse.json({ error: "Webhook URL 不能为空" }, { status: 400 })
      }
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: "Webhook URL 格式无效" }, { status: 400 })
      }
      updateData.url = url.trim()
    }

    if (method !== undefined) {
      updateData.method = method === 'GET' ? 'GET' : 'POST'
    }

    if (customFields !== undefined) {
      if (customFields === null || customFields === '') {
        updateData.customFields = null
      } else {
        try {
          const parsed = JSON.parse(customFields)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validFields = parsed.filter((item: any) => 
              item.name && item.value !== undefined
            )
            if (validFields.length > 0) {
              updateData.customFields = JSON.stringify(validFields)
            } else {
              updateData.customFields = null
            }
          } else {
            updateData.customFields = null
          }
        } catch {
          updateData.customFields = null
        }
      }
    }

    if (remote !== undefined) {
      updateData.remote = remote === true
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled === true
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(webhook)
  } catch (error) {
    console.error("更新 Webhook 失败:", error)
    return NextResponse.json({ error: "更新 Webhook 失败" }, { status: 500 })
  }
}

// 删除 webhook
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

    // 验证 webhook 是否存在且属于当前用户
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook 不存在" }, { status: 404 })
    }

    // 删除 webhook（关联的 FeedWebhook 会通过 CASCADE 自动删除）
    await prisma.webhook.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除 Webhook 失败:", error)
    return NextResponse.json({ error: "删除 Webhook 失败" }, { status: 500 })
  }
}

