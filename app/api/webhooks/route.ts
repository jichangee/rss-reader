import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取用户的所有 webhook
export async function GET() {
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

    const webhooks = await prisma.webhook.findMany({
      where: { userId: user.id },
      include: {
        feeds: {
          include: {
            feed: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // 格式化返回数据
    const formattedWebhooks = webhooks.map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      customFields: webhook.customFields,
      remote: webhook.remote,
      enabled: webhook.enabled,
      feedCount: webhook.feeds.length,
      feeds: webhook.feeds.map(fw => ({
        id: fw.feed.id,
        title: fw.feed.title,
      })),
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }))

    return NextResponse.json(formattedWebhooks)
  } catch (error) {
    console.error("获取 Webhook 列表失败:", error)
    return NextResponse.json({ error: "获取 Webhook 列表失败" }, { status: 500 })
  }
}

// 创建新的 webhook
export async function POST(request: Request) {
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

    const { name, url, method, customFields, remote, enabled } = await request.json()

    // 验证输入
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Webhook 名称不能为空" }, { status: 400 })
    }

    if (!url || !url.trim()) {
      return NextResponse.json({ error: "Webhook URL 不能为空" }, { status: 400 })
    }

    // 验证 URL 格式
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Webhook URL 格式无效" }, { status: 400 })
    }

    // 验证 method
    const validMethod = method === 'GET' ? 'GET' : 'POST'

    // 验证 customFields JSON 格式
    let customFieldsJson: string | null = null
    if (customFields) {
      try {
        const parsed = JSON.parse(customFields)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 验证数组格式
          const validFields = parsed.filter((item: any) => 
            item.name && item.value !== undefined
          )
          if (validFields.length > 0) {
            customFieldsJson = JSON.stringify(validFields)
          }
        }
      } catch {
        // JSON 格式错误，忽略
      }
    }

    // 如果没有自定义字段，使用默认值
    if (!customFieldsJson) {
      customFieldsJson = JSON.stringify([{ name: 'url', value: '{link}' }])
    }

    const webhook = await prisma.webhook.create({
      data: {
        userId: user.id,
        name: name.trim(),
        url: url.trim(),
        method: validMethod,
        customFields: customFieldsJson,
        remote: remote !== false, // 默认为 true
        enabled: enabled !== false, // 默认为 true
      },
    })

    return NextResponse.json(webhook)
  } catch (error) {
    console.error("创建 Webhook 失败:", error)
    return NextResponse.json({ error: "创建 Webhook 失败" }, { status: 500 })
  }
}

