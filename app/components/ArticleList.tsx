"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ExternalLink, Loader2, BookOpen, CheckCheck, Clock, Bookmark, BookmarkCheck } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import ArticleDrawer from "./ArticleDrawer"
import { ToastContainer, useToast } from "./Toast"

interface Article {
  id: string
  title: string
  link: string
  content?: string
  contentSnippet?: string
  pubDate?: string
  author?: string
  feed: {
    title: string
    imageUrl?: string
  }
  readBy: any[]
  isReadLater?: boolean
}

interface ArticleListProps {
  articles: Article[]
  loading: boolean
  hasMore: boolean
  onMarkAsRead: (articleId: string) => void
  onMarkAsReadBatch: (articleIds: string[]) => void
  onLoadMore: () => void
  onMarkAllAsRead: () => void
  onMarkOlderAsRead?: (range: '24h' | 'week') => Promise<{ success: boolean; count?: number; message?: string }> // 返回 Promise，包含操作结果
  markReadOnScroll?: boolean
}

export default function ArticleList({
  articles,
  loading,
  hasMore,
  onMarkAsRead,
  onMarkAsReadBatch,
  onLoadMore,
  onMarkAllAsRead,
  onMarkOlderAsRead, // 解构
  markReadOnScroll = false,
}: ArticleListProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showCleanupMenu, setShowCleanupMenu] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [readLaterArticles, setReadLaterArticles] = useState<Set<string>>(new Set())
  const observerTarget = useRef<HTMLDivElement>(null)
  const pendingReadIds = useRef<Set<string>>(new Set())
  const batchSubmitTimer = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { toasts, success, error, info, removeToast } = useToast()

  // 初始化稍后读状态
  useEffect(() => {
    const readLaterSet = new Set<string>()
    articles.forEach(article => {
      if (article.isReadLater) {
        readLaterSet.add(article.id)
      }
    })
    setReadLaterArticles(readLaterSet)
  }, [articles])

  // 批量提交已读文章
  const submitBatchRead = useCallback(() => {
    if (pendingReadIds.current.size > 0) {
      const idsToSubmit = Array.from(pendingReadIds.current)
      pendingReadIds.current.clear()
      onMarkAsReadBatch(idsToSubmit)
    }
  }, [onMarkAsReadBatch])

  // 添加文章到待标记队列
  const addToPendingRead = useCallback((articleId: string) => {
    pendingReadIds.current.add(articleId)
    
    // 清除旧的定时器
    if (batchSubmitTimer.current) {
      clearTimeout(batchSubmitTimer.current)
    }
    
    // 设置新的定时器，2秒后批量提交
    batchSubmitTimer.current = setTimeout(() => {
      submitBatchRead()
    }, 2000)
  }, [submitBatchRead])

  // 组件卸载时清理定时器并提交剩余的已读标记
  useEffect(() => {
    return () => {
      if (batchSubmitTimer.current) {
        clearTimeout(batchSubmitTimer.current)
      }
      submitBatchRead()
    }
  }, [submitBatchRead])

  // 无限滚动逻辑
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, onLoadMore])

  // 滚动标记已读逻辑
  useEffect(() => {
    if (!markReadOnScroll) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 当文章滚动出视口上方时（isIntersecting 变为 false，且 boundingClientRect.top < 0）
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            const articleId = entry.target.getAttribute("data-id")
            if (articleId) {
              // 添加到批量提交队列
              addToPendingRead(articleId)
              // 停止观察已处理的文章
              observer.unobserve(entry.target)
            }
          }
        })
      },
      {
        threshold: 0,
      }
    )

    // 只观察未读文章
    const unreadArticles = articles.filter(a => a.readBy.length === 0)
    unreadArticles.forEach((article) => {
      const element = document.querySelector(`article[data-id="${article.id}"]`)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [articles, markReadOnScroll, addToPendingRead])

  const handleArticleClick = (article: Article) => {
    // 打开抽屉
    setSelectedArticle(article)
    setIsDrawerOpen(true)
    
    // 如果是未读文章，标记为已读
    if (article.readBy.length === 0) {
      onMarkAsRead(article.id)
    }
  }

  const handleExternalLinkClick = (article: Article, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // 如果是未读文章，标记为已读
    if (article.readBy.length === 0) {
      onMarkAsRead(article.id)
    }
    
    window.open(article.link, "_blank")
  }

  const handleToggleReadLater = async (articleId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const isReadLater = readLaterArticles.has(articleId)
    
    try {
      if (isReadLater) {
        // 移除稍后读
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
        } else {
          error("操作失败，请重试")
        }
      } else {
        // 添加到稍后读
        const res = await fetch(`/api/articles/${articleId}/read-later`, {
          method: "POST",
        })
        
        if (res.ok) {
          setReadLaterArticles(prev => new Set(prev).add(articleId))
          success("已添加到稍后读")
        } else {
          error("操作失败，请重试")
        }
      }
    } catch (err) {
      console.error("稍后读操作失败:", err)
      error("操作失败，请重试")
    }
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    // 延迟清空选中的文章，等待动画完成
    setTimeout(() => setSelectedArticle(null), 300)
  }

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCleanupMenu(false)
      }
    }

    if (showCleanupMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showCleanupMenu])

  const handleCleanupClick = async (range: '24h' | 'week') => {
    setShowCleanupMenu(false)
    
    // 使用轻提示确认，而不是阻塞的 confirm
    // 直接执行清理操作，通过 loading 状态和结果提示来反馈
    setIsCleaningUp(true)
    try {
      const result = await onMarkOlderAsRead?.(range)
      if (result) {
        if (result.success) {
          if (result.count && result.count > 0) {
            success(`已将 ${result.count} 篇旧文章标记为已读`)
          } else {
            info("没有符合条件的旧文章")
          }
        } else {
          error(result.message || "操作失败，请重试")
        }
      }
    } catch (err) {
      console.error("清理旧文章失败:", err)
      error("操作失败，请重试")
    } finally {
      setIsCleaningUp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <BookOpen className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">暂无文章</p>
        <p className="mt-2 text-sm">添加订阅或刷新以获取最新内容</p>
      </div>
    )
  }

  const unreadCount = articles.filter(a => a.readBy.length === 0).length

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            最新文章
          </h2>
          {onMarkOlderAsRead && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowCleanupMenu(!showCleanupMenu)}
                disabled={isCleaningUp}
                className="flex items-center space-x-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
                title="清理旧文章"
              >
                {isCleaningUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isCleaningUp ? "清理中..." : "清理旧文章"}
                </span>
              </button>
              
              {showCleanupMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl dark:bg-gray-800 dark:shadow-gray-900/30 z-50">
                  <div className="py-1" role="menu">
                    <button
                      onClick={() => handleCleanupClick('24h')}
                      disabled={isCleaningUp}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
                      role="menuitem"
                    >
                      24小时之前
                    </button>
                    <button
                      onClick={() => handleCleanupClick('week')}
                      disabled={isCleaningUp}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
                      role="menuitem"
                    >
                      本周之前
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-5">
          {articles.map((article) => {
            const isRead = article.readBy.length > 0
            return (
              <article
                key={article.id}
                data-id={article.id}
                className={`rounded-xl bg-white p-6 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 dark:bg-gray-800 dark:shadow-gray-900/20 ${
                  (isRead && !readLaterArticles.has(article.id)) ? "opacity-60 shadow-sm hover:shadow-md" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center space-x-2 flex-wrap">
                      {article.feed.imageUrl ? (
                        <img
                          src={article.feed.imageUrl}
                          alt=""
                          className="h-4 w-4 rounded flex-shrink-0"
                        />
                      ) : null}
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 break-words">
                        {article.feed.title}
                      </span>
                      {!isRead && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 flex-shrink-0">
                          新
                        </span>
                      )}
                      {readLaterArticles.has(article.id) && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 flex-shrink-0 flex items-center gap-1">
                          <BookmarkCheck className="h-3 w-3" />
                          稍后读
                        </span>
                      )}
                    </div>
                    <h3
                      className="mb-2 cursor-pointer text-xl font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400 break-words"
                      onClick={() => handleArticleClick(article)}
                    >
                      {article.title}
                    </h3>
                    {article.contentSnippet && (
                      <p className="mb-3 line-clamp-3 text-sm text-gray-600 dark:text-gray-400 break-words">
                        {article.contentSnippet}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                      {article.author && (
                        <span className="flex items-center break-words">
                          <span className="mr-1 flex-shrink-0">作者:</span>
                          <span className="break-words">{article.author}</span>
                        </span>
                      )}
                      {article.pubDate && (
                        <span className="flex-shrink-0">
                          {format(new Date(article.pubDate), "yyyy年MM月dd日 HH:mm", {
                            locale: zhCN,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:flex-shrink-0 self-start sm:self-auto">
                    <button
                      onClick={(e) => handleToggleReadLater(article.id, e)}
                      className={`flex-shrink-0 rounded-lg p-2 transition-colors ${
                        readLaterArticles.has(article.id)
                          ? "text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      }`}
                      title={readLaterArticles.has(article.id) ? "从稍后读移除" : "添加到稍后读"}
                    >
                      {readLaterArticles.has(article.id) ? (
                        <BookmarkCheck className="h-5 w-5" />
                      ) : (
                        <Bookmark className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleExternalLinkClick(article, e)}
                      className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      title="在新标签页中打开"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* 滚动加载触发器 */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        {/* 没有更多内容时显示全部已读按钮 */}
        {!hasMore && articles.length > 0 && unreadCount > 0 && (
          <div className="flex justify-center py-8">
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <CheckCheck className="h-5 w-5" />
              <span>全部已读</span>
            </button>
          </div>
        )}

        {/* 全部已读提示 */}
        {!hasMore && articles.length > 0 && unreadCount === 0 && (
          <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">已全部阅读完毕</p>
          </div>
        )}
      </div>
      
      {/* 文章详情抽屉 */}
      <ArticleDrawer
        article={selectedArticle}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
      
      {/* Toast 提示 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

