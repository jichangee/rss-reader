"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, BookOpen, CheckCheck, RotateCw } from "lucide-react"
import { ToastContainer, useToast } from "../Toast"
import ArticleItem from "./ArticleItem"
import ImagePreviewModal from "./ImagePreviewModal"
import CleanupMenu from "./CleanupMenu"
import { useMediaProcessor } from "./hooks/useMediaProcessor"
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
  newArticlesCount = 0,
  onRefreshAndReload,
}: ArticleListProps) {
  const [readLaterArticles, setReadLaterArticles] = useState<Set<string>>(new Set())
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
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

  // 处理媒体元素展开/折叠
  const toggleMediaExpansion = useCallback((articleId: string, mediaId: string) => {
    setExpandedMedia((prev) => {
      const newMap = new Map(prev)
      const articleExpanded = newMap.get(articleId) || new Set<string>()
      const newSet = new Set(articleExpanded)
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId)
      } else {
        newSet.add(mediaId)
      }
      newMap.set(articleId, newSet)
      return newMap
    })
  }, [])

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
        } else {
          error("操作失败，请重试")
        }
      }
    } catch (err) {
      console.error("稍后读操作失败:", err)
      error("操作失败，请重试")
    }
  }, [readLaterArticles, success, error])

  // 处理标题点击标记已读
  const handleTitleClick = useCallback((articleId: string) => {
    onMarkAsRead(articleId)
  }, [onMarkAsRead])

  // 使用自定义 hooks
  const { articleContentRefs } = useMediaProcessor({
    articles,
    hideImagesAndVideos,
    expandedMedia,
    onToggleMediaExpansion: toggleMediaExpansion,
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

  if (loading) {
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
              最新文章
            </h2>
            <div className="flex items-center space-x-2">
              {onRefresh && (
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
          
          {newArticlesCount > 0 && (
            <div className="sticky top-2 z-10 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                有 {newArticlesCount} 篇新文章
              </span>
              {onRefreshAndReload && (
                <button
                  onClick={onRefreshAndReload}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  查看新文章
                </button>
              )}
            </div>
          )}
          
          <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400 py-20">
            <BookOpen className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无文章</p>
            <p className="mt-2 text-sm">添加订阅以获取最新内容</p>
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
            最新文章
          </h2>
          <div className="flex items-center space-x-2">
            {onRefresh && (
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
            {onMarkOlderAsRead && (
              <CleanupMenu onMarkOlderAsRead={onMarkOlderAsRead} />
            )}
          </div>
        </div>
        
        {newArticlesCount > 0 && (
          <div className="sticky top-2 z-10 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-indigo-700 dark:text-indigo-300 font-medium">
              有 {newArticlesCount} 篇新文章
            </span>
            {onRefreshAndReload && (
              <button
                onClick={onRefreshAndReload}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                查看新文章
              </button>
            )}
          </div>
        )}
        
        <div className="space-y-6">
          {articles.map((article) => {
            const articleExpandedMedia = expandedMedia.get(article.id) || new Set<string>()
            return (
              <ArticleItem
                key={article.id}
                article={article}
                isReadLater={readLaterArticles.has(article.id)}
                hideImagesAndVideos={hideImagesAndVideos}
                expandedMedia={articleExpandedMedia}
                onToggleReadLater={handleToggleReadLater}
                onMarkAsRead={handleTitleClick}
                onImageClick={handleImageClick}
                onToggleMediaExpansion={(mediaId) => toggleMediaExpansion(article.id, mediaId)}
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

        {!hasMore && articles.length > 0 && unreadCount > 0 && (
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

        {!hasMore && articles.length > 0 && unreadCount === 0 && (
          <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">已全部阅读完毕</p>
          </div>
        )}
      </div>
      
      <ImagePreviewModal imageSrc={previewImage} onClose={closeImagePreview} />
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

