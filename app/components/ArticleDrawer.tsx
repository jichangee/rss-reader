import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { X, ExternalLink, Calendar, User, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Rss } from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
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
    enableTranslation?: boolean
  }
  readBy: any[]
  isReadLater?: boolean
}

interface ArticleDrawerProps {
  article: Article | null
  isOpen: boolean
  onClose: () => void
}

export default function ArticleDrawer({ article, isOpen, onClose }: ArticleDrawerProps) {
  const [isReadLater, setIsReadLater] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
  const [expandedMedia, setExpandedMedia] = useState<Set<string>>(new Set())
  const [feedIconError, setFeedIconError] = useState(false)
  const articleContentRef = useRef<HTMLDivElement>(null)
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
    if (isOpen) {
      loadSettings()
      setExpandedMedia(new Set()) // 重置展开状态
    }
  }, [isOpen, article?.id]) // 添加 article?.id 依赖，确保切换文章时重新加载设置

  // 当设置加载完成后，如果内容已经渲染，强制重新处理媒体元素
  useEffect(() => {
    if (!isOpen || !articleContentRef.current) return
    
    // 使用 requestAnimationFrame 确保在下一个渲染周期处理
    const rafId = requestAnimationFrame(() => {
      if (articleContentRef.current) {
        // 触发重新处理 - 通过更新 expandedMedia 来触发（即使值不变，也会触发依赖更新）
        // 这里我们直接调用处理函数会更直接，但由于 processMediaElements 在另一个 useEffect 中
        // 我们通过确保依赖项正确来触发重新处理
      }
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [hideImagesAndVideos, isOpen])

  // 初始化稍后读状态
  useEffect(() => {
    if (article) {
      setIsReadLater(article.isReadLater || false)
      setFeedIconError(false) // 重置图标错误状态
    }
  }, [article])

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

  // 清理和修复图片 URL
  const cleanImageUrl = useCallback((url: string): string => {
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
  }, [])

  // 处理图片点击放大
  const handleImageClick = useCallback((src: string) => {
    setPreviewImage(src)
  }, [])

  // 关闭图片预览
  const closeImagePreview = useCallback(() => {
    setPreviewImage(null)
  }, [])

  // 处理媒体元素展开/折叠
  const toggleMediaExpansion = useCallback((mediaId: string) => {
    setExpandedMedia((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId)
      } else {
        newSet.add(mediaId)
      }
      return newSet
    })
  }, [])

  // 处理图片和视频的隐藏/显示
  useEffect(() => {
    if (!articleContentRef.current || !isOpen) return

    const contentDiv = articleContentRef.current

    const processMediaElements = () => {
      // 确保 DOM 已经渲染
      if (!contentDiv || contentDiv.children.length === 0) {
        return
      }
      
      // 处理图片
      const images = contentDiv.querySelectorAll('img')
      images.forEach((img, index) => {
        // 清理和修复图片 URL
        if (img.src) {
          const cleanedUrl = cleanImageUrl(img.src)
          if (cleanedUrl !== img.src) {
            img.src = cleanedUrl
          }
        }
        
        const mediaId = `img-${index}`
        const isExpanded = expandedMedia.has(mediaId)
        
        // 检查是否已经有包装器
        let wrapper = img.parentElement
        // 如果父元素已经是 media-wrapper，直接使用；否则创建新的包装器
        if (wrapper && wrapper.classList.contains('media-wrapper')) {
          // 已经存在包装器，直接使用
        } else {
          // 创建包装器
          wrapper = document.createElement('div')
          wrapper.className = 'media-wrapper relative'
          img.parentNode?.insertBefore(wrapper, img)
          wrapper.appendChild(img)
        }

        if (hideImagesAndVideos && !isExpanded) {
          // 隐藏图片
          img.style.display = 'none'
          wrapper.style.display = 'block'
          
          // 检查是否已经有展开按钮
          let toggleBtn = wrapper.querySelector('.media-toggle-btn') as HTMLElement
          if (!toggleBtn) {
            toggleBtn = document.createElement('button')
            toggleBtn.className = 'media-toggle-btn w-full py-3 px-4 mb-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-sm text-gray-700 dark:text-gray-300'
            toggleBtn.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <span>点击展开图片</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            `
            toggleBtn.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleMediaExpansion(mediaId)
            }
            wrapper.appendChild(toggleBtn)
          }
        } else {
          // 显示图片
          img.style.display = ''
          if (wrapper) {
            wrapper.style.display = ''
          }
          
          // 移除展开按钮
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
          
          // 如果展开，添加折叠按钮
          if (isExpanded) {
            let collapseBtn = wrapper.querySelector('.media-collapse-btn') as HTMLElement
            if (!collapseBtn) {
              collapseBtn = document.createElement('button')
              collapseBtn.className = 'media-collapse-btn w-full py-2 px-4 mt-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-xs text-gray-600 dark:text-gray-400'
              collapseBtn.innerHTML = `
                <span>点击折叠图片</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
              `
              collapseBtn.onclick = (e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleMediaExpansion(mediaId)
              }
              wrapper.appendChild(collapseBtn)
            }
          } else {
            const collapseBtn = wrapper.querySelector('.media-collapse-btn')
            if (collapseBtn) {
              collapseBtn.remove()
            }
          }
        }
      })

      // 处理视频
      const videos = contentDiv.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]')
      videos.forEach((videoElement, index) => {
        const video = videoElement as HTMLElement
        const mediaId = `video-${index}`
        const isExpanded = expandedMedia.has(mediaId)
        
        // 检查是否已经有包装器
        let wrapper = video.parentElement
        // 如果父元素已经是 media-wrapper，直接使用；否则创建新的包装器
        if (wrapper && wrapper.classList.contains('media-wrapper')) {
          // 已经存在包装器，直接使用
        } else {
          // 创建包装器
          wrapper = document.createElement('div')
          wrapper.className = 'media-wrapper relative'
          video.parentNode?.insertBefore(wrapper, video)
          wrapper.appendChild(video)
        }

        if (hideImagesAndVideos && !isExpanded) {
          // 隐藏视频
          video.style.display = 'none'
          wrapper.style.display = 'block'
          
          // 对于 video 元素，暂停播放并移除 src 以避免创建 WebMediaPlayer
          if (video.tagName === 'VIDEO') {
            const videoEl = video as HTMLVideoElement
            if (videoEl.src && !video.dataset.originalSrc) {
              video.dataset.originalSrc = videoEl.src
            }
            videoEl.pause()
            videoEl.src = ''
            videoEl.srcObject = null
          }
          // 对于 iframe 元素，移除 src 以避免创建 WebMediaPlayer
          else if (video.tagName === 'IFRAME') {
            const iframeEl = video as HTMLIFrameElement
            if (iframeEl.src && !video.dataset.originalSrc) {
              video.dataset.originalSrc = iframeEl.src
            }
            iframeEl.src = ''
          }
          
          // 检查是否已经有展开按钮
          let toggleBtn = wrapper.querySelector('.media-toggle-btn') as HTMLElement
          if (!toggleBtn) {
            toggleBtn = document.createElement('button')
            toggleBtn.className = 'media-toggle-btn w-full py-3 px-4 mb-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-sm text-gray-700 dark:text-gray-300'
            toggleBtn.innerHTML = `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span>点击展开视频</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            `
            toggleBtn.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleMediaExpansion(mediaId)
            }
            wrapper.appendChild(toggleBtn)
          }
        } else {
          // 显示视频
          video.style.display = ''
          if (wrapper) {
            wrapper.style.display = ''
          }
          
          // 恢复视频的 src 属性
          if (video.tagName === 'VIDEO' && video.dataset.originalSrc) {
            const videoEl = video as HTMLVideoElement
            videoEl.src = video.dataset.originalSrc
            delete video.dataset.originalSrc
          }
          // 恢复 iframe 的 src 属性
          else if (video.tagName === 'IFRAME' && video.dataset.originalSrc) {
            const iframeEl = video as HTMLIFrameElement
            iframeEl.src = video.dataset.originalSrc
            delete video.dataset.originalSrc
          }
          
          // 移除展开按钮
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
          
          // 如果展开，添加折叠按钮
          if (isExpanded) {
            let collapseBtn = wrapper.querySelector('.media-collapse-btn') as HTMLElement
            if (!collapseBtn) {
              collapseBtn = document.createElement('button')
              collapseBtn.className = 'media-collapse-btn w-full py-2 px-4 mt-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 text-xs text-gray-600 dark:text-gray-400'
              collapseBtn.innerHTML = `
                <span>点击折叠视频</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
              `
              collapseBtn.onclick = (e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleMediaExpansion(mediaId)
              }
              wrapper.appendChild(collapseBtn)
            }
          } else {
            const collapseBtn = wrapper.querySelector('.media-collapse-btn')
            if (collapseBtn) {
              collapseBtn.remove()
            }
          }
        }
      })
    }

    // 初始处理 - 使用 setTimeout 确保 DOM 完全渲染
    // 增加延迟时间，确保内容完全渲染和设置加载完成
    const timeoutId = setTimeout(() => {
      processMediaElements()
    }, 300)
    
    // 如果设置已经加载，也立即处理一次（延迟更短）
    const quickTimeoutId = hideImagesAndVideos !== undefined 
      ? setTimeout(() => {
          processMediaElements()
        }, 50)
      : null

    // 使用事件委托，监听整个容器的点击事件（用于图片预览）
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是展开/折叠按钮，不处理
      if (target.closest('.media-toggle-btn') || target.closest('.media-collapse-btn')) {
        return
      }
      
      // 检查点击的是图片，或者是链接内的图片
      const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img')
      
      if (img && img instanceof HTMLImageElement) {
        e.preventDefault()
        e.stopPropagation()
        handleImageClick(img.src)
      }
    }

    // 为所有图片添加样式
    const updateImageStyles = () => {
      const images = contentDiv.querySelectorAll('img')
      images.forEach((img) => {
        img.style.cursor = 'pointer'
        img.style.userSelect = 'none'
      })
    }

    // 初始设置样式
    updateImageStyles()

    // 监听容器点击事件
    contentDiv.addEventListener('click', handleContainerClick, true)

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      updateImageStyles()
      // 延迟处理，确保 DOM 完全更新
      setTimeout(() => {
        processMediaElements()
      }, 50)
    })

    observer.observe(contentDiv, {
      childList: true,
      subtree: true,
    })

    return () => {
      clearTimeout(timeoutId)
      if (quickTimeoutId) {
        clearTimeout(quickTimeoutId)
      }
      contentDiv.removeEventListener('click', handleContainerClick, true)
      observer.disconnect()
    }
  }, [article?.id, article?.content, handleImageClick, isOpen, hideImagesAndVideos, expandedMedia, toggleMediaExpansion])

  // 按ESC键关闭图片预览
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewImage) {
        closeImagePreview()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [previewImage, closeImagePreview])

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
              {article.feed.imageUrl && !feedIconError ? (
                <img
                  src={article.feed.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded flex-shrink-0"
                  onError={() => setFeedIconError(true)}
                />
              ) : (
                <Rss className="h-8 w-8 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                  {article.feed.title}
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={async () => {
                  if (!article) return
                  
                  try {
                    if (isReadLater) {
                      // 移除稍后读
                      const res = await fetch(`/api/articles/${article.id}/read-later`, {
                        method: "DELETE",
                      })
                      
                      if (res.ok) {
                        setIsReadLater(false)
                        success("已从稍后读移除")
                      } else {
                        error("操作失败，请重试")
                      }
                    } else {
                      // 添加到稍后读
                      const res = await fetch(`/api/articles/${article.id}/read-later`, {
                        method: "POST",
                      })
                      
                      if (res.ok) {
                        setIsReadLater(true)
                        success("已添加到稍后读")
                      } else {
                        error("操作失败，请重试")
                      }
                    }
                  } catch (err) {
                    console.error("稍后读操作失败:", err)
                    error("操作失败，请重试")
                  }
                }}
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
              <button
                onClick={() => {
                  if (article?.link) {
                    window.open(article.link, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title="在新标签页中打开"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
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
                  ref={articleContentRef}
                  dangerouslySetInnerHTML={{ __html: article.content || "" }}
                  className="article-content text-gray-800 dark:text-gray-200 leading-relaxed break-words [&_*]:break-words [&_a]:break-all [&_pre]:overflow-x-auto [&_code]:break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:cursor-pointer"
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
      
      {/* 图片预览 Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeImagePreview}
        >
          <button
            onClick={closeImagePreview}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="关闭预览"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewImage}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      
      {/* Toast 提示 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}

