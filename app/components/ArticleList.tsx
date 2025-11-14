"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ExternalLink, Loader2, BookOpen, CheckCheck } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import ArticleDrawer from "./ArticleDrawer"

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
}

interface ArticleListProps {
  articles: Article[]
  loading: boolean
  hasMore: boolean
  onMarkAsRead: (articleId: string) => void
  onLoadMore: () => void
  onMarkAllAsRead: () => void
}

export default function ArticleList({
  articles,
  loading,
  hasMore,
  onMarkAsRead,
  onLoadMore,
  onMarkAllAsRead,
}: ArticleListProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

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

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    // 延迟清空选中的文章，等待动画完成
    setTimeout(() => setSelectedArticle(null), 300)
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
        <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          最新文章
        </h2>
        <div className="space-y-4">
          {articles.map((article) => {
            const isRead = article.readBy.length > 0
            return (
              <article
                key={article.id}
                className={`rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md dark:bg-gray-800 dark:border-gray-700 ${
                  isRead ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-2">
                      {article.feed.imageUrl ? (
                        <img
                          src={article.feed.imageUrl}
                          alt=""
                          className="h-4 w-4 rounded"
                        />
                      ) : null}
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {article.feed.title}
                      </span>
                      {!isRead && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                          新
                        </span>
                      )}
                    </div>
                    <h3
                      className="mb-2 cursor-pointer text-xl font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                      onClick={() => handleArticleClick(article)}
                    >
                      {article.title}
                    </h3>
                    {article.contentSnippet && (
                      <p className="mb-3 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                        {article.contentSnippet}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      {article.author && (
                        <span className="flex items-center">
                          <span className="mr-1">作者:</span>
                          {article.author}
                        </span>
                      )}
                      {article.pubDate && (
                        <span>
                          {format(new Date(article.pubDate), "yyyy年MM月dd日 HH:mm", {
                            locale: zhCN,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleExternalLinkClick(article, e)}
                    className="ml-4 flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    title="在新标签页中打开"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </button>
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
    </div>
  )
}

