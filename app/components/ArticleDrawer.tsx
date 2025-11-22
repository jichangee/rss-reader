"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { X, ExternalLink, Calendar, User } from "lucide-react"
import { useEffect } from "react"

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

interface ArticleDrawerProps {
  article: Article | null
  isOpen: boolean
  onClose: () => void
}

export default function ArticleDrawer({ article, isOpen, onClose }: ArticleDrawerProps) {
  // 按ESC键关闭抽屉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!article) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ${
          isOpen ? "opacity-50" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full sm:w-2/3 lg:w-1/2 xl:w-2/5 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {article.feed.imageUrl && (
                <img
                  src={article.feed.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  {article.feed.title}
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title="在新标签页中打开"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 overflow-x-hidden">
            {/* 文章标题 */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight break-words">
              {article.title}
            </h1>

            {/* 元数据 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              {article.author && (
                <div className="flex items-center space-x-1 break-words min-w-0">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words">{article.author}</span>
                </div>
              )}
              {article.pubDate && (
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(article.pubDate), "yyyy年MM月dd日 HH:mm", {
                      locale: zhCN,
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* 文章内容 */}
            <div className="prose prose-sm sm:prose dark:prose-invert max-w-none break-words overflow-wrap-anywhere">
              {article.content ? (
                <div
                  dangerouslySetInnerHTML={{ __html: article.content }}
                  className="article-content text-gray-800 dark:text-gray-200 leading-relaxed break-words [&_*]:break-words [&_a]:break-all [&_pre]:overflow-x-auto [&_code]:break-words [&_img]:max-w-full [&_img]:h-auto"
                />
              ) : article.contentSnippet ? (
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed break-words">
                  {article.contentSnippet}
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  暂无内容预览，请点击上方按钮在新标签页中查看完整文章。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

