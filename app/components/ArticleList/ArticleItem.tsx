"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Bookmark, BookmarkCheck, User, Calendar, Image, ChevronDown, ChevronUp, Rss, ExternalLink, Send, Loader2 } from "lucide-react"
import type { ArticleItemProps } from "./types"

// 清理和修复图片 URL
const cleanImageUrl = (url: string): string => {
  if (!url) return url
  
  // 移除各种引号字符（包括中文引号、英文引号等）
  let cleaned = url
    .replace(/["""""'']/g, '') // 移除各种引号
    .replace(/^\s+|\s+$/g, '') // 移除首尾空格
    .trim()
  
  // 修复 https:/ 或 http:/ 为 https:// 或 http://
  cleaned = cleaned.replace(/^(https?):\/(?!\/)/, '$1://')
  
  // 如果 URL 不完整（缺少协议），尝试修复
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned
  } else if (cleaned.startsWith('/') && !cleaned.startsWith('//')) {
    // 相对路径，保持原样（浏览器会自动处理）
  } else if (!cleaned.match(/^https?:\/\//) && cleaned.includes('://')) {
    // 如果包含 :// 但没有协议，可能是格式错误
    cleaned = cleaned.replace(/^([^:]+):\/\//, 'https://')
  }
  
  return cleaned
}

// 处理 HTML 内容中的媒体元素（在渲染前预处理）
const processHtmlContent = (html: string | undefined, shouldHide: boolean): string => {
  if (!html) return ''
  
  let processedHtml = html
  
  // 修复图片 URL 中的问题
  processedHtml = processedHtml.replace(
    /<img([^>]*)\s+src=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      const cleanedSrc = cleanImageUrl(src)
      return `<img${before} src="${cleanedSrc}"${after}>`
    }
  )
  
  if (shouldHide) {
    // 隐藏 img 元素：添加 display:none 样式
    processedHtml = processedHtml.replace(
      /<img([^>]*)>/gi,
      (match, attrs) => {
        // 如果已有 style 属性，追加 display:none
        if (/style\s*=/i.test(attrs)) {
          return `<img${attrs.replace(/style\s*=\s*["']([^"']*)["']/i, 'style="$1;display:none"')}>`
        }
        return `<img${attrs} style="display:none">`
      }
    )
    
    // 隐藏 video 元素：添加 display:none 样式并移除 src
    processedHtml = processedHtml.replace(
      /<video([^>]*)>/gi,
      (match, attrs) => {
        let newAttrs = attrs
        // 保存原始 src 到 data-original-src，并移除 src
        newAttrs = newAttrs.replace(
          /\s+src\s*=\s*["']([^"']+)["']/gi,
          ' data-original-src="$1"'
        )
        // 添加 display:none 样式
        if (/style\s*=/i.test(newAttrs)) {
          newAttrs = newAttrs.replace(/style\s*=\s*["']([^"']*)["']/i, 'style="$1;display:none"')
        } else {
          newAttrs += ' style="display:none"'
        }
        return `<video${newAttrs}>`
      }
    )
    
    // 隐藏 iframe 元素：添加 display:none 样式并移除 src
    processedHtml = processedHtml.replace(
      /<iframe([^>]*)>/gi,
      (match, attrs) => {
        let newAttrs = attrs
        // 保存原始 src 到 data-original-src，并移除 src
        newAttrs = newAttrs.replace(
          /\s+src\s*=\s*["']([^"']+)["']/gi,
          ' data-original-src="$1"'
        )
        // 添加 display:none 样式
        if (/style\s*=/i.test(newAttrs)) {
          newAttrs = newAttrs.replace(/style\s*=\s*["']([^"']*)["']/i, 'style="$1;display:none"')
        } else {
          newAttrs += ' style="display:none"'
        }
        return `<iframe${newAttrs}>`
      }
    )
  }
  
  return processedHtml
}

export default function ArticleItem({
  article,
  isReadLater,
  hideImagesAndVideos,
  expandedMedia,
  mediaCount,
  onToggleReadLater,
  onMarkAsRead,
  onImageClick,
  onToggleMediaExpansion,
  onWebhookPush,
  contentRef,
}: ArticleItemProps) {
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  // 计算是否应该隐藏媒体
  const shouldHideMedia = hideImagesAndVideos && !expandedMedia
  
  // 检查是否配置了 Webhook
  const hasWebhook = Boolean(article.feed.webhookUrl)
  
  // 使用 useMemo 预处理 HTML 内容，避免每次渲染都重新处理
  const processedContent = useMemo(() => {
    return processHtmlContent(article.content, shouldHideMedia)
  }, [article.content, shouldHideMedia])

  const handleTitleClick = () => {
    if (article.readBy.length === 0) {
      onMarkAsRead(article.id)
    }
  }

  const handleReadLaterClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await onToggleReadLater(article.id)
  }

  // 获取字段值的辅助函数
  const getFieldValue = (field: string): string | null => {
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
        return article.id // 使用文章 ID 作为 GUID
      case 'author':
        return article.author || null
      case 'pubDate':
        return article.pubDate ? new Date(article.pubDate).toISOString() : null
      case 'feedUrl':
        return article.feed.url || null
      case 'feedTitle':
        return article.feed.title
      case 'feedDescription':
        return null // feed.description 不在类型中
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

  const parseCustomFields = (customFieldsJson: string | null): CustomFieldConfig[] | null => {
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
          const fieldValue = typeof value === 'string' ? `{${value}}` : `{${value}}`
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

  // 替换自定义值中的变量
  const replaceVariables = (template: string): string => {
    let result = template
    
    // 替换所有变量 {fieldName}
    const variableRegex = /\{(\w+)\}/g
    result = result.replace(variableRegex, (match, fieldName) => {
      const fieldValue = getFieldValue(fieldName)
      return fieldValue !== null ? fieldValue : match
    })
    
    return result
  }

  const handleWebhookClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (webhookLoading) return
    
    setWebhookLoading(true)
    setWebhookStatus('idle')
    
    try {
      const { webhookUrl, webhookMethod, webhookField, webhookParamName, webhookCustomFields, webhookRemote } = article.feed
      
      if (!webhookUrl) {
        setWebhookStatus('error')
        setTimeout(() => setWebhookStatus('idle'), 3000)
        return
      }

      const method = webhookMethod || 'POST'
      const isRemote = webhookRemote !== false // 默认为 true（服务器端）
      let payload: Record<string, string> = {}

      // 优先使用自定义字段配置
      const customFields = parseCustomFields(webhookCustomFields)
      
      if (customFields && customFields.length > 0) {
        // 使用自定义字段映射
        for (const fieldConfig of customFields) {
          const { name, value } = fieldConfig
          
          if (!name.trim()) continue
          
          // 统一处理：所有值都通过变量替换处理
          // 如果值中包含变量（如 {link}），则替换；否则直接使用
          const fieldValue = replaceVariables(value)
          
          if (fieldValue !== null && fieldValue !== '') {
            payload[name] = fieldValue
          }
        }
        
        if (Object.keys(payload).length === 0) {
          setWebhookStatus('error')
          setTimeout(() => setWebhookStatus('idle'), 3000)
          return
        }
      } else {
        // 向后兼容：使用单个字段配置
        const fieldValue = getFieldValue(webhookField || 'link')
        if (!fieldValue) {
          setWebhookStatus('error')
          setTimeout(() => setWebhookStatus('idle'), 3000)
          return
        }
        const paramName = webhookParamName || 'url'
        payload[paramName] = fieldValue
      }

      let result: { success: boolean; message?: string; error?: string }

      if (isRemote) {
        // 服务器端发起：调用 API
        if (!onWebhookPush) {
          setWebhookStatus('error')
          setTimeout(() => setWebhookStatus('idle'), 3000)
          return
        }
        result = await onWebhookPush(article.id)
      } else {
        // 客户端直接发起请求
        try {
          let response: Response
          
          if (method === 'GET') {
            // GET 请求：将参数添加到 URL
            const url = new URL(webhookUrl)
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
            response = await fetch(webhookUrl, {
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
            result = { success: true, message: '推送成功' }
          } else {
            result = { success: false, error: `推送失败: HTTP ${response.status}` }
          }
        } catch (fetchError) {
          const errorMessage = fetchError instanceof Error ? fetchError.message : '未知错误'
          result = { success: false, error: `推送失败: ${errorMessage}` }
        }
      }

      setWebhookStatus(result.success ? 'success' : 'error')
      // 3秒后重置状态
      setTimeout(() => setWebhookStatus('idle'), 3000)
    } catch {
      setWebhookStatus('error')
      setTimeout(() => setWebhookStatus('idle'), 3000)
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <article
      key={article.id}
      data-id={article.id}
      data-article-id={article.id}
      className="telegram-card rounded-2xl bg-white p-5 sm:p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-gray-800 dark:shadow-gray-900/10"
    >
      {/* 顶部：订阅源信息和标签 */}
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {article.feed.imageUrl ? (
            <img
              src={article.feed.imageUrl}
              alt=""
              className="h-5 w-5 rounded-full flex-shrink-0"
            />
          ) : (
            <Rss className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
            {article.feed.title}
          </span>
        </div>
        {isReadLater && (
          <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 flex-shrink-0 flex items-center gap-1">
            <BookmarkCheck className="h-3 w-3" />
            稍后读
          </span>
        )}
      </div>

      {/* 标题：可点击跳转 */}
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleTitleClick}
        className="block mb-3 group"
      >
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 break-words transition-colors leading-snug">
          {article.title}
        </h3>
      </a>

      {/* 文章完整内容 */}
      {article.content && (
        <>
          <div 
            ref={contentRef}
            className="telegram-article-content prose prose-sm sm:prose-base dark:prose-invert max-w-none mb-4"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
          
          {/* 统一的媒体展开/折叠按钮（当有媒体时） */}
          {hideImagesAndVideos && mediaCount > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleMediaExpansion()
              }}
              className="w-full py-3 px-4 mb-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {expandedMedia ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  <span>{mediaCount > 1 ? `折叠所有图片和视频 (${mediaCount})` : '折叠视频'}</span>
                </>
              ) : (
                <>
                  <Image className="w-5 h-5" />
                  <span>{mediaCount > 1 ? `展开所有图片和视频 (${mediaCount})` : '展开视频'}</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* 底部：元数据和操作按钮 */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
          {article.author && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{article.author}</span>
            </span>
          )}
          {article.pubDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300 flex-shrink-0">
              <Calendar className="h-3 w-3" />
              {format(new Date(article.pubDate), "yyyy年MM月dd日 HH:mm", {
                locale: zhCN,
              })}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg p-2 transition-colors text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="打开原文链接"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
          {/* Webhook 推送按钮：仅当配置了 Webhook 时显示 */}
          {hasWebhook && onWebhookPush && (
            <button
              onClick={handleWebhookClick}
              disabled={webhookLoading}
              className={`rounded-lg p-2 transition-colors ${
                webhookStatus === 'success'
                  ? "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
                  : webhookStatus === 'error'
                  ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              } ${webhookLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="推送到 Webhook"
            >
              {webhookLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={handleReadLaterClick}
            className={`rounded-lg p-2 transition-colors ${
              isReadLater
                ? "text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            }`}
            title={isReadLater ? "从稍后读移除" : "添加到稍后读"}
          >
            {isReadLater ? (
              <BookmarkCheck className="h-5 w-5" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

