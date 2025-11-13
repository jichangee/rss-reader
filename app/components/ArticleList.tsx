"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ExternalLink, Loader2, BookOpen } from "lucide-react"

interface Article {
  id: string
  title: string
  link: string
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
  onMarkAsRead: (articleId: string) => void
}

export default function ArticleList({
  articles,
  loading,
  onMarkAsRead,
}: ArticleListProps) {
  const handleArticleClick = (article: Article) => {
    if (article.readBy.length === 0) {
      onMarkAsRead(article.id)
    }
    window.open(article.link, "_blank")
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
                    onClick={() => handleArticleClick(article)}
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
      </div>
    </div>
  )
}

