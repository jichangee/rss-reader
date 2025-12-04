"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Bookmark, BookmarkCheck, User, Calendar, Image, Video, ChevronDown, ChevronUp, Rss, ExternalLink } from "lucide-react"
import type { ArticleItemProps } from "./types"

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
  const contentElementRef = useRef<HTMLDivElement | null>(null)
  const [feedIconError, setFeedIconError] = useState(false)
  
  // 当 article 改变时重置图标错误状态
  useEffect(() => {
    setFeedIconError(false)
  }, [article.id])
  
  // 立即处理媒体元素的函数
  const processMediaImmediately = (contentDiv: HTMLDivElement) => {
    if (!contentDiv || !article.content) return
    
    const articleExpanded = expandedMedia
    
    // 处理图片
    const images = contentDiv.querySelectorAll('img')
    images.forEach((img, index) => {
      const shouldHide = hideImagesAndVideos && !articleExpanded
      
      if (shouldHide) {
        if (!img.dataset.hiddenByUs) {
          img.dataset.hiddenByUs = 'true'
          img.style.display = 'none'
        }
      } else {
        if (img.dataset.hiddenByUs === 'true') {
          delete img.dataset.hiddenByUs
          img.style.display = ''
        }
      }
    })
    
    // 处理视频
    const videos = contentDiv.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]')
    videos.forEach((video, index) => {
      const videoEl = video as HTMLElement
      const shouldHide = hideImagesAndVideos && !articleExpanded
      
      if (shouldHide) {
        if (!videoEl.dataset.hiddenByUs) {
          videoEl.dataset.hiddenByUs = 'true'
          videoEl.style.display = 'none'
          
          // 对于 video 元素，暂停播放并移除 src 以避免创建 WebMediaPlayer
          if (video.tagName === 'VIDEO') {
            const videoElement = video as HTMLVideoElement
            if (videoElement.src && !videoEl.dataset.originalSrc) {
              videoEl.dataset.originalSrc = videoElement.src
            }
            videoElement.pause()
            videoElement.src = ''
            videoElement.srcObject = null
          }
          // 对于 iframe 元素，移除 src 以避免创建 WebMediaPlayer
          else if (video.tagName === 'IFRAME') {
            const iframeElement = video as HTMLIFrameElement
            if (iframeElement.src && !videoEl.dataset.originalSrc) {
              videoEl.dataset.originalSrc = iframeElement.src
            }
            iframeElement.src = ''
          }
        }
      } else {
        if (videoEl.dataset.hiddenByUs === 'true') {
          delete videoEl.dataset.hiddenByUs
          videoEl.style.display = ''
          
          // 恢复视频的 src 属性
          if (video.tagName === 'VIDEO' && videoEl.dataset.originalSrc) {
            const videoElement = video as HTMLVideoElement
            videoElement.src = videoEl.dataset.originalSrc
            delete videoEl.dataset.originalSrc
          }
          // 恢复 iframe 的 src 属性
          else if (video.tagName === 'IFRAME' && videoEl.dataset.originalSrc) {
            const iframeElement = video as HTMLIFrameElement
            iframeElement.src = videoEl.dataset.originalSrc
            delete videoEl.dataset.originalSrc
          }
        }
      }
    })
  }
  
  // 合并 refs，并在设置时立即处理图片
  const setContentRef = (el: HTMLDivElement | null) => {
    contentElementRef.current = el
    contentRef(el)
    
    // 当 ref 被设置时，立即处理图片（防止闪现）
    if (el) {
      // 使用 requestAnimationFrame 确保 DOM 已经渲染
      requestAnimationFrame(() => {
        processMediaImmediately(el)
      })
    }
  }
  
  // 在内容或设置变化时处理图片
  useEffect(() => {
    const contentDiv = contentElementRef.current
    if (!contentDiv || !article.content) return
    
    const articleExpanded = expandedMedia
    
    // 处理所有图片和视频
    const processMedia = () => {
      // 处理图片
      const images = contentDiv.querySelectorAll('img')
      images.forEach((img, index) => {
        const shouldHide = hideImagesAndVideos && !articleExpanded
        
        if (shouldHide) {
          if (!img.dataset.hiddenByUs) {
            img.dataset.hiddenByUs = 'true'
            img.style.display = 'none'
          }
        } else {
          if (img.dataset.hiddenByUs === 'true') {
            delete img.dataset.hiddenByUs
            img.style.display = ''
          }
        }
      })
      
      // 处理视频
      const videos = contentDiv.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]')
      videos.forEach((video, index) => {
        const videoEl = video as HTMLElement
        const shouldHide = hideImagesAndVideos && !articleExpanded
        
        if (shouldHide) {
          if (!videoEl.dataset.hiddenByUs) {
            videoEl.dataset.hiddenByUs = 'true'
            videoEl.style.display = 'none'
            
            // 对于 video 元素，暂停播放并移除 src 以避免创建 WebMediaPlayer
            if (video.tagName === 'VIDEO') {
              const videoElement = video as HTMLVideoElement
              if (videoElement.src && !videoEl.dataset.originalSrc) {
                videoEl.dataset.originalSrc = videoElement.src
              }
              videoElement.pause()
              videoElement.src = ''
              videoElement.srcObject = null
            }
            // 对于 iframe 元素，移除 src 以避免创建 WebMediaPlayer
            else if (video.tagName === 'IFRAME') {
              const iframeElement = video as HTMLIFrameElement
              if (iframeElement.src && !videoEl.dataset.originalSrc) {
                videoEl.dataset.originalSrc = iframeElement.src
              }
              iframeElement.src = ''
            }
          }
        } else {
          if (videoEl.dataset.hiddenByUs === 'true') {
            delete videoEl.dataset.hiddenByUs
            videoEl.style.display = ''
            
            // 恢复视频的 src 属性
            if (video.tagName === 'VIDEO' && videoEl.dataset.originalSrc) {
              const videoElement = video as HTMLVideoElement
              videoElement.src = videoEl.dataset.originalSrc
              delete videoEl.dataset.originalSrc
            }
            // 恢复 iframe 的 src 属性
            else if (video.tagName === 'IFRAME' && videoEl.dataset.originalSrc) {
              const iframeElement = video as HTMLIFrameElement
              iframeElement.src = videoEl.dataset.originalSrc
              delete videoEl.dataset.originalSrc
            }
          }
        }
      })
    }
    
    // 立即执行一次
    processMedia()
    
    // 使用 MutationObserver 监听新添加的图片
    const observer = new MutationObserver(() => {
      processMedia()
    })
    
    observer.observe(contentDiv, {
      childList: true,
      subtree: true,
    })
    
    return () => {
      observer.disconnect()
    }
  }, [article.content, hideImagesAndVideos, expandedMedia])
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
          {article.feed.imageUrl && !feedIconError ? (
            <img
              src={article.feed.imageUrl}
              alt=""
              className="h-5 w-5 rounded-full flex-shrink-0"
              onError={() => setFeedIconError(true)}
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
            ref={setContentRef}
            className="telegram-article-content prose prose-sm sm:prose-base dark:prose-invert max-w-none mb-4"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
          
          {/* 统一的媒体展开/折叠按钮（当有多个媒体时） */}
          {hideImagesAndVideos && mediaCount > 1 && (
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
                  <span>折叠所有图片和视频 ({mediaCount})</span>
                </>
              ) : (
                <>
                  <Image className="w-5 h-5" />
                  <span>展开所有图片和视频 ({mediaCount})</span>
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

