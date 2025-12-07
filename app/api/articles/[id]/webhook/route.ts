import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取字段值的辅助函数
function getFieldValue(field: string, article: any): string | null {
  switch (field) {
    case 'link':
      return article.link
    case 'title':
      return article.title
    case 'content':
      return article.content || null
    case 'contentSnippet':
      return article.contentSnippet || null
    case 'guid':
      return article.guid
    case 'author':
      return article.author || null
    case 'pubDate':
      return article.pubDate ? new Date(article.pubDate).toISOString() : null
    case 'feedUrl':
      return article.feed.url
    case 'feedTitle':
      return article.feed.title
    case 'feedDescription':
      return article.feed.description || null
    case 'articleId':
      return article.id
    default:
      return null
  }
}

// 解析自定义字段配置
interface CustomFieldConfig {
  name: string
  value: string  // 值：可以是固定值或包含变量（如 {link}, {title}）
  type?: 'field' | 'custom' | 'fixed'  // 向后兼容：旧格式的类型字段
  field?: string  // 向后兼容：旧格式的字段名
}

function parseCustomFields(customFieldsJson: string | null): CustomFieldConfig[] | null {
  if (!customFieldsJson) return null
  
  try {
    const parsed = JSON.parse(customFieldsJson)
    
    if (Array.isArray(parsed)) {
      // 新格式：数组，每个元素包含 name, value
      const result: CustomFieldConfig[] = []
      for (const item of parsed) {
        if (item.name && item.value !== undefined) {
          // 新格式（只有 name 和 value）
          result.push({
            name: item.name,
            value: item.value
          })
        } else if (item.name && item.field) {
          // 旧格式：向后兼容（有 field 字段）
          result.push({
            name: item.name,
            value: `{${item.field}}`  // 转换为变量格式
          })
        } else if (item.name && item.type) {
          // 旧格式：向后兼容（有 type 字段）
          result.push({
            name: item.name,
            value: item.value || ''
          })
        }
      }
      return result.length > 0 ? result : null
    } else if (typeof parsed === 'object' && parsed !== null) {
      // 旧格式：对象格式转换为数组
      const result: CustomFieldConfig[] = []
      for (const [name, value] of Object.entries(parsed)) {
        // 如果值是字段名（如 'link'），转换为变量格式
        const fieldValue = typeof value === 'string' 
          ? (WEBHOOK_FIELD_OPTIONS.find(opt => opt.value === value) ? `{${value}}` : value)
          : `{${value}}`
        result.push({
          name,
          value: fieldValue
        })
      }
      return result.length > 0 ? result : null
    }
    
    return null
  } catch {
    return null
  }
}

// Webhook 可发送的字段选项（用于向后兼容）
const WEBHOOK_FIELD_OPTIONS = [
  { value: 'link', label: '文章链接' },
  { value: 'title', label: '文章标题' },
  { value: 'content', label: '文章内容' },
  { value: 'contentSnippet', label: '文章摘要' },
  { value: 'guid', label: '文章 GUID' },
  { value: 'author', label: '作者' },
  { value: 'pubDate', label: '发布日期' },
  { value: 'articleId', label: '文章 ID' },
  { value: 'feedUrl', label: '订阅源 URL' },
  { value: 'feedTitle', label: '订阅源标题' },
  { value: 'feedDescription', label: '订阅源描述' },
]

// 替换自定义值中的变量
function replaceVariables(template: string, article: any): string {
  let result = template
  
  // 替换所有变量 {fieldName}
  const variableRegex = /\{(\w+)\}/g
  result = result.replace(variableRegex, (match, fieldName) => {
    const fieldValue = getFieldValue(fieldName, article)
    return fieldValue !== null ? fieldValue : match
  })
  
  return result
}

// 执行单个 Webhook 推送
async function executeWebhook(webhook: any, article: any): Promise<{
  webhookId: string
  webhookName: string
  success: boolean
  message?: string
  error?: string
  status?: number
}> {
  try {
    // 构建 payload
    const customFields = parseCustomFields(webhook.customFields)
    let payload: Record<string, string> = {}

    if (customFields && customFields.length > 0) {
      // 使用自定义字段映射
      for (const fieldConfig of customFields) {
        const { name, value } = fieldConfig
        
        if (!name.trim()) continue
        
        const fieldValue = replaceVariables(value, article)
        
        if (fieldValue !== null && fieldValue !== '') {
          payload[name] = fieldValue
        }
      }
      
      if (Object.keys(payload).length === 0) {
        return {
          webhookId: webhook.id,
          webhookName: webhook.name,
          success: false,
          error: "所有自定义字段值都为空"
        }
      }
    } else {
      // 默认配置
      const fieldValue = getFieldValue('link', article)
      if (!fieldValue) {
        return {
          webhookId: webhook.id,
          webhookName: webhook.name,
          success: false,
          error: "字段值为空"
        }
      }
      payload['url'] = fieldValue
    }

    const method = webhook.method || 'POST'
    let response: Response

    if (method === 'GET') {
      // GET 请求：将参数添加到 URL
      const url = new URL(webhook.url)
      for (const [key, value] of Object.entries(payload)) {
        url.searchParams.set(key, value)
      }
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'RSS-Reader-Webhook/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      })
    } else {
      // POST 请求：将参数放入请求体
      response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RSS-Reader-Webhook/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10秒超时
      })
    }

    if (response.ok) {
      return {
        webhookId: webhook.id,
        webhookName: webhook.name,
        success: true,
        message: "推送成功",
        status: response.status
      }
    } else {
      return {
        webhookId: webhook.id,
        webhookName: webhook.name,
        success: false,
        error: `推送失败: HTTP ${response.status}`,
        status: response.status
      }
    }
  } catch (fetchError) {
    console.error(`Webhook ${webhook.id} 请求失败:`, fetchError)
    const errorMessage = fetchError instanceof Error ? fetchError.message : "未知错误"
    return {
      webhookId: webhook.id,
      webhookName: webhook.name,
      success: false,
      error: `推送失败: ${errorMessage}`
    }
  }
}

// 批量触发 Webhook 推送
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
        feed: {
          include: {
            webhooks: {
              include: {
                webhook: true,
              },
            },
          },
        },
      },
    })

    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 })
    }

    // 验证用户是否有权限访问该文章
    if (article.feed.userId !== user.id) {
      return NextResponse.json({ error: "无权限访问此文章" }, { status: 403 })
    }

    // 获取所有启用的 webhook
    const enabledWebhooks = article.feed.webhooks
      .map(fw => fw.webhook)
      .filter(wh => wh.enabled)

    if (enabledWebhooks.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: "该订阅未配置启用的 Webhook",
        results: []
      }, { status: 400 })
    }

    // 并行执行所有 webhook（一个失败不影响其他）
    const results = await Promise.all(
      enabledWebhooks.map(webhook => executeWebhook(webhook, article))
    )

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failCount === 0, // 全部成功才算成功
      message: `成功: ${successCount}, 失败: ${failCount}`,
      results: results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount
      }
    })
  } catch (error) {
    console.error("Webhook 处理失败:", error)
    return NextResponse.json({ error: "Webhook 处理失败" }, { status: 500 })
  }
}

