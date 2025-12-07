"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, BookOpen, CheckCheck, RotateCw } from "lucide-react"
import { ToastContainer, useToast } from "../Toast"
import ArticleItem from "./ArticleItem"
import ImagePreviewModal from "./ImagePreviewModal"
import CleanupMenu from "./CleanupMenu"
import { useMediaProcessor, countMediaFromHtml } from "./hooks/useMediaProcessor"
import { useScrollToRead } from "./hooks/useScrollToRead"
import { useInfiniteScroll } from "./hooks/useInfiniteScroll"
import type { ArticleListProps, Article } from "./types"

export default function ArticleList({
  articles,
  loading,
  hasMore,
  onMarkAsRead,
  onMarkAsReadBatch,
  onLoadMore,
  onMarkAllAsRead,
  onMarkOlderAsRead,
  markReadOnScroll = false,
  isRefreshing = false,
  onRefresh,
  isReadLaterView = false,
  onReadLaterChange,
}: ArticleListProps) {
  const [readLaterArticles, setReadLaterArticles] = useState<Set<string>>(new Set())
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
  // 改为文章级别的展开状态：Set<articleId> 表示哪些文章的所有媒体是展开的
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set())
  // 保留旧的 expandedMedia 用于向后兼容，但现在改为文章级别
  const [expandedMedia, setExpandedMedia] = useState<Map<string, Set<string>>>(new Map())
  const { toasts, success, error, removeToast } = useToast()

  // 加载用户设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/user/settings")
        if (res.ok) {
          const data = await res.json()
          setHideImagesAndVideos(data.hideImagesAndVideos ?? false)
        }
      } catch (error) {
        console.error("加载设置失败:", error)
      }
    }
    loadSettings()
  }, [])

  // 追踪是否已完成首次初始化
  const isReadLaterInitializedRef = useRef(false)

  // 初始化稍后读状态（只在第一次进入页面时执行）
  useEffect(() => {
    // 如果已经初始化过，不再从后端数据更新稍后读状态
    if (isReadLaterInitializedRef.current) {
      return
    }
    
    // 首次初始化
    const readLaterSet = new Set<string>()
    articles.forEach(article => {
      if (article.isReadLater) {
        readLaterSet.add(article.id)
      }
    })
    setReadLaterArticles(readLaterSet)
    
    // 标记为已初始化（只有在有文章数据时才标记）
    if (articles.length > 0) {
      isReadLaterInitializedRef.current = true
    }
  }, [articles])

  // 处理文章所有媒体元素的统一展开/折叠
  const toggleArticleMediaExpansion = useCallback((articleId: string) => {
    setExpandedArticles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(articleId)) {
        newSet.delete(articleId)
      } else {
        newSet.add(articleId)
      }
      return newSet
    })
    // 同步更新 expandedMedia 以保持兼容性
    setExpandedMedia((prev) => {
      const newMap = new Map(prev)
      const articleExpanded = newMap.get(articleId) || new Set<string>()
      const newSet = new Set(articleExpanded)
      const isExpanded = !expandedArticles.has(articleId)
      
      // 获取该文章的所有媒体ID（这里需要从DOM中获取，但为了简化，我们使用一个标记）
      // 实际使用时，useMediaProcessor 会处理具体的媒体元素
      if (isExpanded) {
        // 展开：添加所有媒体ID（使用特殊标记 'all' 表示全部）
        newSet.add('all')
      } else {
        // 折叠：清除所有媒体ID
        newSet.clear()
      }
      newMap.set(articleId, newSet)
      return newMap
    })
  }, [expandedArticles])

  // 保留旧的单个媒体展开/折叠函数以保持兼容性（但现在不再使用）
  const toggleMediaExpansion = useCallback((articleId: string, mediaId: string) => {
    // 现在统一使用文章级别的展开/折叠
    toggleArticleMediaExpansion(articleId)
  }, [toggleArticleMediaExpansion])

  // 处理图片点击放大
  const handleImageClick = useCallback((src: string) => {
    setPreviewImage(src)
  }, [])

  // 关闭图片预览
  const closeImagePreview = useCallback(() => {
    setPreviewImage(null)
  }, [])

  // 处理稍后读
  const handleToggleReadLater = useCallback(async (articleId: string) => {
    const isReadLater = readLaterArticles.has(articleId)
    
    try {
      if (isReadLater) {
        const res = await fetch(`/api/articles/${articleId}/read-later`, {
          method: "DELETE",
        })
        
        if (res.ok) {
          setReadLaterArticles(prev => {
            const newSet = new Set(prev)
            newSet.delete(articleId)
            return newSet
          })
          success("已从稍后读移除")
          // 通知父组件稍后读状态变化
          onReadLaterChange?.(articleId, false)
        } else {
          error("操作失败，请重试")
        }
      } else {
        const res = await fetch(`/api/articles/${articleId}/read-later`, {
          method: "POST",
        })
        
        if (res.ok) {
          setReadLaterArticles(prev => new Set(prev).add(articleId))
          success("已添加到稍后读")
          // 通知父组件稍后读状态变化
          onReadLaterChange?.(articleId, true)
        } else {
          error("操作失败，请重试")
        }
      }
    } catch (err) {
      console.error("稍后读操作失败:", err)
      error("操作失败，请重试")
    }
  }, [readLaterArticles, success, error, onReadLaterChange])

  // 处理标题点击标记已读
  const handleTitleClick = useCallback((articleId: string) => {
    onMarkAsRead(articleId)
  }, [onMarkAsRead])

  // 使用自定义 hooks
  const { articleContentRefs } = useMediaProcessor({
    articles,
    hideImagesAndVideos,
    expandedArticles,
    onToggleMediaExpansion: toggleArticleMediaExpansion,
    onImageClick: handleImageClick,
  })

  const { markAsRead } = useScrollToRead({
    articles,
    markReadOnScroll,
    onMarkAsReadBatch,
  })

  const { observerTarget } = useInfiniteScroll({
    hasMore,
    loading,
    onLoadMore,
  })

  // 处理标题点击（结合标记已读）
  const handleArticleTitleClick = useCallback((article: Article) => {
    if (article.readBy.length === 0) {
      markAsRead(article.id)
      onMarkAsRead(article.id)
    }
  }, [markAsRead, onMarkAsRead])

  // 获取字段值的辅助函数（客户端）
  const getFieldValue = (field: string, article: Article): string | null => {
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
        return article.id
      case 'author':
        return article.author || null
      case 'pubDate':
        return article.pubDate ? new Date(article.pubDate).toISOString() : null
      case 'feedUrl':
        return article.feed.url || null
      case 'feedTitle':
        return article.feed.title
      case 'feedDescription':
        return null
      case 'articleId':
        return article.id
      default:
        return null
    }
  }

  // 替换自定义值中的变量（客户端）
  const replaceVariables = (template: string, article: Article): string => {
    let result = template
    const variableRegex = /\{(\w+)\}/g
    result = result.replace(variableRegex, (match, fieldName) => {
      const fieldValue = getFieldValue(fieldName, article)
      return fieldValue !== null ? fieldValue : match
    })
    return result
  }

  // 解析自定义字段配置（客户端）
  const parseCustomFields = (customFieldsJson: string | null): Array<{name: string, value: string}> | null => {
    if (!customFieldsJson) return null
    try {
      const parsed = JSON.parse(customFieldsJson)
      if (Array.isArray(parsed)) {
        return parsed.filter((item: any) => item.name && item.value !== undefined)
      }
      return null
    } catch {
      return null
    }
  }

  // 客户端执行单个 Webhook
  const executeWebhookClient = async (webhook: any, article: Article): Promise<{
    webhookId: string
    webhookName: string
    success: boolean
    message?: string
    error?: string
    status?: number
  }> => {
    try {
      const customFields = parseCustomFields(webhook.customFields)
      let payload: Record<string, string> = {}

      if (customFields && customFields.length > 0) {
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
        const url = new URL(webhook.url)
        for (const [key, value] of Object.entries(payload)) {
          url.searchParams.set(key, value)
        }
        response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'RSS-Reader-Webhook/1.0',
          },
          signal: AbortSignal.timeout(10000),
        })
      } else {
        response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RSS-Reader-Webhook/1.0',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
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
      const errorMessage = fetchError instanceof Error ? fetchError.message : "未知错误"
      return {
        webhookId: webhook.id,
        webhookName: webhook.name,
        success: false,
        error: `推送失败: ${errorMessage}`
      }
    }
  }

  // 处理 Webhook 推送（批量触发，根据remote属性决定执行位置）
  const handleWebhookPush = useCallback(async (articleId: string) => {
    try {
      // 找到对应的文章
      const article = articles.find(a => a.id === articleId)
      if (!article || !article.feed.webhooks) {
        error("文章不存在或未配置 Webhook")
        return { success: false, error: "文章不存在或未配置 Webhook" }
      }

      // 获取所有启用的 webhook
      const enabledWebhooks = article.feed.webhooks.filter((wh: any) => wh.enabled)
      if (enabledWebhooks.length === 0) {
        error("该订阅未配置启用的 Webhook")
        return { success: false, error: "该订阅未配置启用的 Webhook" }
      }

      // 分离远程和本地 webhook
      const remoteWebhooks = enabledWebhooks.filter((wh: any) => wh.remote !== false)
      const localWebhooks = enabledWebhooks.filter((wh: any) => wh.remote === false)

      const results: Array<{
        webhookId: string
        webhookName: string
        success: boolean
        message?: string
        error?: string
        status?: number
      }> = []

      // 执行远程 webhook（通过服务端API）
      if (remoteWebhooks.length > 0) {
        try {
          const res = await fetch(`/api/articles/${articleId}/webhook`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ webhookIds: remoteWebhooks.map((wh: any) => wh.id) }),
          })
          
          const data = await res.json()
          if (data.results) {
            results.push(...data.results)
          }
        } catch (err) {
          console.error("远程 Webhook 推送失败:", err)
          // 为每个远程webhook添加失败结果
          remoteWebhooks.forEach((wh: any) => {
            results.push({
              webhookId: wh.id,
              webhookName: wh.name,
              success: false,
              error: "远程推送失败"
            })
          })
        }
      }

      // 执行本地 webhook（客户端直接请求）
      if (localWebhooks.length > 0) {
        const localResults = await Promise.all(
          localWebhooks.map((webhook: any) => executeWebhookClient(webhook, article))
        )
        results.push(...localResults)
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      if (failCount === 0) {
        const message = `推送成功: ${successCount}/${results.length}`
        success(message)
        return { success: true, message, results }
      } else {
        const errorMsg = `推送完成: 成功 ${successCount}，失败 ${failCount}/${results.length}`
        error(errorMsg)
        return { success: false, error: errorMsg, results }
      }
    } catch (err) {
      console.error("Webhook 推送失败:", err)
      error("推送失败，请重试")
      return { success: false, error: "推送失败" }
    }
  }, [articles, success, error])

  // 只有在没有数据时才显示全屏 loading，有数据时保留列表
  if (loading && articles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isReadLaterView ? "稍后读" : "最新文章"}
            </h2>
            <div className="flex items-center space-x-2">
              {onRefresh && !isReadLaterView && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
                  title="刷新订阅"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isRefreshing ? "刷新中..." : "刷新"}
                  </span>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400 py-20">
            <BookOpen className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">{isReadLaterView ? "暂无稍后读文章" : "暂无文章"}</p>
            <p className="mt-2 text-sm">{isReadLaterView ? "点击文章的书签按钮添加到稍后读" : "添加订阅以获取最新内容"}</p>
          </div>
        </div>
      </div>
    )
  }

  const unreadCount = articles.filter(a => a.readBy.length === 0).length

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isReadLaterView ? "稍后读" : "最新文章"}
            </h2>
            <div className="flex items-center space-x-2">
              {onRefresh && !isReadLaterView && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
                  title="刷新订阅"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isRefreshing ? "刷新中..." : "刷新"}
                  </span>
                </button>
              )}
              {onMarkOlderAsRead && !isReadLaterView && (
                <CleanupMenu onMarkOlderAsRead={onMarkOlderAsRead} />
              )}
            </div>
          </div>
        
        <div className="space-y-6">
          {articles.map((article) => {
            const isArticleMediaExpanded = expandedArticles.has(article.id)
            // 直接从 HTML 内容计算媒体数量，不需要 DOM 查询
            const mediaCount = countMediaFromHtml(article.content)
            return (
              <ArticleItem
                key={article.id}
                article={article}
                isReadLater={readLaterArticles.has(article.id)}
                hideImagesAndVideos={hideImagesAndVideos}
                expandedMedia={isArticleMediaExpanded}
                mediaCount={mediaCount}
                onToggleReadLater={handleToggleReadLater}
                onMarkAsRead={handleTitleClick}
                onImageClick={handleImageClick}
                onToggleMediaExpansion={() => toggleArticleMediaExpansion(article.id)}
                onWebhookPush={handleWebhookPush}
                contentRef={(el) => {
                  if (el) {
                    articleContentRefs.current.set(article.id, el)
                  } else {
                    articleContentRefs.current.delete(article.id)
                  }
                }}
              />
            )
          })}
        </div>

        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        {!hasMore && articles.length > 0 && unreadCount > 0 && !isReadLaterView && (
          <div className="flex justify-center py-8">
            <button
              onClick={onMarkAllAsRead}
              disabled={isRefreshing}
              className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCheck className="h-5 w-5" />
              )}
              <span>{isRefreshing ? "处理中..." : "已读当前列表"}</span>
            </button>
          </div>
        )}

        {!hasMore && articles.length > 0 && (unreadCount === 0 || isReadLaterView) && (
          <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">{isReadLaterView ? "已到底部" : "已全部阅读完毕"}</p>
          </div>
        )}
      </div>
      
      <ImagePreviewModal imageSrc={previewImage} onClose={closeImagePreview} />
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

