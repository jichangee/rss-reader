"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Bookmark, BookmarkCheck, User, Calendar, Image, ChevronDown, ChevronUp, Rss, ExternalLink } from "lucide-react"
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
  contentRef,
}: ArticleItemProps) {
  // 计算是否应该隐藏媒体
  const shouldHideMedia = hideImagesAndVideos && !expandedMedia
  
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

