import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 触发 Webhook 推送
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

    // 获取文章和关联的 Feed
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    })

    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 })
    }

    // 验证用户是否有权限访问该文章
    if (article.feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限访问此文章" }, { status: 403 })
    }

    // 检查 Feed 是否配置了 Webhook
    const { webhookUrl, webhookMethod, webhookField, webhookParamName } = article.feed

    if (!webhookUrl) {
      return NextResponse.json({ error: "该订阅未配置 Webhook" }, { status: 400 })
    }

    // 根据配置获取要发送的字段值
    let fieldValue: string | null = null
    switch (webhookField || 'link') {
      case 'link':
        fieldValue = article.link
        break
      case 'title':
        fieldValue = article.title
        break
      case 'content':
        fieldValue = article.content
        break
      case 'guid':
        fieldValue = article.guid
        break
      case 'author':
        fieldValue = article.author
        break
      case 'feedUrl':
        fieldValue = article.feed.url
        break
      case 'feedTitle':
        fieldValue = article.feed.title
        break
      default:
        fieldValue = article.link
    }

    if (!fieldValue) {
      return NextResponse.json({ error: "字段值为空" }, { status: 400 })
    }

    const paramName = webhookParamName || 'url'
    const method = webhookMethod || 'POST'

    let response: Response

    try {
      if (method === 'GET') {
        // GET 请求：将参数添加到 URL
        const url = new URL(webhookUrl)
        url.searchParams.set(paramName, fieldValue)
        response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'RSS-Reader-Webhook/1.0',
          },
          signal: AbortSignal.timeout(10000), // 10秒超时
        })
      } else {
        // POST 请求：将参数放入请求体
        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RSS-Reader-Webhook/1.0',
          },
          body: JSON.stringify({
            [paramName]: fieldValue,
          }),
          signal: AbortSignal.timeout(10000), // 10秒超时
        })
      }

      if (response.ok) {
        return NextResponse.json({ 
          success: true, 
          message: "推送成功",
          status: response.status 
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `推送失败: HTTP ${response.status}`,
          status: response.status 
        }, { status: 200 }) // 返回 200 但 success 为 false
      }
    } catch (fetchError) {
      console.error("Webhook 请求失败:", fetchError)
      const errorMessage = fetchError instanceof Error ? fetchError.message : "未知错误"
      return NextResponse.json({ 
        success: false, 
        error: `推送失败: ${errorMessage}` 
      }, { status: 200 })
    }
  } catch (error) {
    console.error("Webhook 处理失败:", error)
    return NextResponse.json({ error: "Webhook 处理失败" }, { status: 500 })
  }
}

