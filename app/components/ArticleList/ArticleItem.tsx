"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Bookmark, BookmarkCheck, User, Calendar } from "lucide-react"
import type { ArticleItemProps } from "./types"

export default function ArticleItem({
  article,
  isReadLater,
  hideImagesAndVideos,
  expandedMedia,
  onToggleReadLater,
  onMarkAsRead,
  onImageClick,
  onToggleMediaExpansion,
  contentRef,
}: ArticleItemProps) {
  const handleTitleClick = () => {
    if (article.readBy.length === 0) {
      onMarkAsRead(article.id)
    }
  }

  const handleReadLaterClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await onToggleReadLater(article.id)
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
          ) : null}
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
        <div 
          ref={contentRef}
          className="telegram-article-content prose prose-sm sm:prose-base dark:prose-invert max-w-none mb-4"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
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
        
        <button
          onClick={handleReadLaterClick}
          className={`rounded-lg p-2 transition-colors flex-shrink-0 ${
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
    </article>
  )
}

