"use client"

import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Loader2, BookOpen, CheckCheck, Clock, Bookmark, BookmarkCheck, X, ExternalLink, User, Calendar, RotateCw } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
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
  isRefreshing?: boolean
  onRefresh?: () => void
  newArticlesCount?: number
  onRefreshAndReload?: () => void
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
  isRefreshing = false,
  onRefresh,
  newArticlesCount = 0,
  onRefreshAndReload,
}: ArticleListProps) {
  const [showCleanupMenu, setShowCleanupMenu] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [readLaterArticles, setReadLaterArticles] = useState<Set<string>>(new Set())
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
  const [expandedMedia, setExpandedMedia] = useState<Map<string, Set<string>>>(new Map()) // articleId -> Set<mediaId>
  const observerTarget = useRef<HTMLDivElement>(null)
  const pendingReadIds = useRef<Set<string>>(new Set())
  const processedReadIds = useRef<Set<string>>(new Set()) // 跟踪已处理过的文章ID
  const batchSubmitTimer = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const articleContentRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const articleRefs = useRef<Map<string, HTMLElement>>(new Map())
  const scrollObserverRef = useRef<IntersectionObserver | null>(null) // 保存观察器引用
  const { toasts, success, error, info, removeToast } = useToast()

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

  // 初始化稍后读状态，并同步已读状态
  useEffect(() => {
    const readLaterSet = new Set<string>()
    articles.forEach(article => {
      if (article.isReadLater) {
        readLaterSet.add(article.id)
      }
      // 如果文章已读，从待提交队列中移除并标记为已处理
      if (article.readBy.length > 0) {
        pendingReadIds.current.delete(article.id)
        processedReadIds.current.add(article.id)
      }
    })
    setReadLaterArticles(readLaterSet)
  }, [articles])

  // 批量提交已读文章
  const submitBatchRead = useCallback(() => {
    if (pendingReadIds.current.size > 0) {
      const idsToSubmit = Array.from(pendingReadIds.current)
      // 标记为已处理
      idsToSubmit.forEach(id => processedReadIds.current.add(id))
      pendingReadIds.current.clear()
      onMarkAsReadBatch(idsToSubmit)
    }
  }, [onMarkAsReadBatch])

  // 添加文章到待标记队列
  const addToPendingRead = useCallback((articleId: string, article?: Article) => {
    // 检查是否已经处理过
    if (processedReadIds.current.has(articleId)) {
      return
    }
    
    // 检查是否已经在待提交队列中
    if (pendingReadIds.current.has(articleId)) {
      return
    }
    
    // 如果提供了文章对象，检查是否已读
    if (article && article.readBy.length > 0) {
      processedReadIds.current.add(articleId)
      return
    }
    
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
      { 
        threshold: 0.1,
        // 使用 rootMargin 提前触发：当元素距离视口底部还有 33% 时就触发加载
        rootMargin: '0px 0px 33% 0px'
      }
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

    // 清理之前的观察器
    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 当文章滚动出视口上方时（isIntersecting 变为 false，且 boundingClientRect.top < 0）
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            const articleId = entry.target.getAttribute("data-id")
            if (articleId) {
              // 检查是否已经处理过
              if (processedReadIds.current.has(articleId)) {
                observer.unobserve(entry.target)
                return
              }
              
              // 查找对应的文章对象
              const article = articles.find(a => a.id === articleId)
              
              // 检查文章是否已读
              if (article && article.readBy.length > 0) {
                processedReadIds.current.add(articleId)
                observer.unobserve(entry.target)
                return
              }
              
              // 添加到批量提交队列
              addToPendingRead(articleId, article)
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

    scrollObserverRef.current = observer

    // 只观察未读且未处理过的文章
    const unreadArticles = articles.filter(a => 
      a.readBy.length === 0 && !processedReadIds.current.has(a.id)
    )
    
    unreadArticles.forEach((article) => {
      const element = document.querySelector(`article[data-id="${article.id}"]`)
      if (element && !processedReadIds.current.has(article.id)) {
        observer.observe(element)
      }
    })

    return () => {
      if (scrollObserverRef.current) {
        scrollObserverRef.current.disconnect()
        scrollObserverRef.current = null
      }
    }
  }, [articles, markReadOnScroll, addToPendingRead])

  const handleTitleClick = (article: Article) => {
    // 如果是未读文章，标记为已读
    if (article.readBy.length === 0) {
      // 从待提交队列中移除（如果存在）
      pendingReadIds.current.delete(article.id)
      // 标记为已处理
      processedReadIds.current.add(article.id)
      onMarkAsRead(article.id)
    }
  }

  // 处理图片点击放大
  const handleImageClick = (src: string) => {
    setPreviewImage(src)
  }

  // 关闭图片预览
  const closeImagePreview = () => {
    setPreviewImage(null)
  }

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

  // 处理文章内容中的图片和视频
  useEffect(() => {
    const processMediaElements = (contentDiv: HTMLDivElement, articleId: string) => {
      if (!contentDiv || contentDiv.children.length === 0) return
      
      const articleExpanded = expandedMedia.get(articleId) || new Set<string>()
      
      // 处理图片
      const images = contentDiv.querySelectorAll('img')
      images.forEach((img, index) => {
        const mediaId = `img-${index}`
        const isExpanded = articleExpanded.has(mediaId)
        const shouldHide = hideImagesAndVideos && !isExpanded
        
        // 检查是否已经有包装器
        let wrapper = img.parentElement
        if (wrapper && wrapper.classList.contains('media-wrapper')) {
          // 已经存在包装器，直接使用
        } else {
          // 创建包装器
          wrapper = document.createElement('div')
          wrapper.className = 'media-wrapper relative'
          img.parentNode?.insertBefore(wrapper, img)
          wrapper.appendChild(img)
        }

        // 检查当前状态，避免不必要的 DOM 操作
        // 使用 data 属性来跟踪我们设置的隐藏状态，避免与 CSS 样式冲突
        const wasHiddenByUs = img.dataset.hiddenByUs === 'true'
        const shouldBeHidden = shouldHide && !wasHiddenByUs
        const shouldBeShown = !shouldHide && wasHiddenByUs

        if (shouldHide) {
          // 只在需要隐藏且当前未隐藏时才操作
          if (shouldBeHidden) {
            img.style.display = 'none'
            img.dataset.hiddenByUs = 'true'
            if (wrapper) {
              wrapper.style.display = 'block'
            }
          }
          
          // 检查是否已经有展开按钮
          let toggleBtn = wrapper?.querySelector('.media-toggle-btn') as HTMLElement
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
              toggleMediaExpansion(articleId, mediaId)
            }
            wrapper?.appendChild(toggleBtn)
          }
        } else {
          // 只在需要显示且当前已隐藏时才操作
          if (shouldBeShown) {
            img.style.display = ''
            delete img.dataset.hiddenByUs
            if (wrapper) {
              wrapper.style.display = ''
            }
          }
          
          // 移除展开按钮
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
          
          // 如果展开，添加折叠按钮
          if (isExpanded) {
            let collapseBtn = wrapper?.querySelector('.media-collapse-btn') as HTMLElement
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
                toggleMediaExpansion(articleId, mediaId)
              }
              wrapper?.appendChild(collapseBtn)
            }
          } else {
            const collapseBtn = wrapper?.querySelector('.media-collapse-btn')
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
        const isExpanded = articleExpanded.has(mediaId)
        const shouldHide = hideImagesAndVideos && !isExpanded
        
        // 检查是否已经有包装器
        let wrapper = video.parentElement
        if (wrapper && wrapper.classList.contains('media-wrapper')) {
          // 已经存在包装器，直接使用
        } else {
          // 创建包装器
          wrapper = document.createElement('div')
          wrapper.className = 'media-wrapper relative'
          video.parentNode?.insertBefore(wrapper, video)
          wrapper.appendChild(video)
        }

        // 检查当前状态，避免不必要的 DOM 操作
        // 使用 data 属性来跟踪我们设置的隐藏状态，避免与 CSS 样式冲突
        const wasHiddenByUs = video.dataset.hiddenByUs === 'true'
        const shouldBeHidden = shouldHide && !wasHiddenByUs
        const shouldBeShown = !shouldHide && wasHiddenByUs

        if (shouldHide) {
          // 只在需要隐藏且当前未隐藏时才操作
          if (shouldBeHidden) {
            video.style.display = 'none'
            video.dataset.hiddenByUs = 'true'
            if (wrapper) {
              wrapper.style.display = 'block'
            }
          }
          
          // 检查是否已经有展开按钮
          let toggleBtn = wrapper?.querySelector('.media-toggle-btn') as HTMLElement
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
              toggleMediaExpansion(articleId, mediaId)
            }
            wrapper?.appendChild(toggleBtn)
          }
        } else {
          // 只在需要显示且当前已隐藏时才操作
          if (shouldBeShown) {
            video.style.display = ''
            delete video.dataset.hiddenByUs
            if (wrapper) {
              wrapper.style.display = ''
            }
          }
          
          // 移除展开按钮
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
          
          // 如果展开，添加折叠按钮
          if (isExpanded) {
            let collapseBtn = wrapper?.querySelector('.media-collapse-btn') as HTMLElement
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
                toggleMediaExpansion(articleId, mediaId)
              }
              wrapper?.appendChild(collapseBtn)
            }
          } else {
            const collapseBtn = wrapper?.querySelector('.media-collapse-btn')
            if (collapseBtn) {
              collapseBtn.remove()
            }
          }
        }
      })
    }

    // 为所有图片添加样式
    const updateImageStyles = () => {
      articleContentRefs.current.forEach((contentDiv, articleId) => {
        if (!contentDiv) return
        processMediaElements(contentDiv, articleId)
        
        const images = contentDiv.querySelectorAll('img')
        images.forEach((img) => {
          img.style.cursor = 'pointer'
          img.style.userSelect = 'none'
        })
      })
    }

    // 为每个内容容器添加点击事件监听器
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 检查点击的是图片，或者是链接内的图片
      const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img')
      
      if (img && img instanceof HTMLImageElement) {
        e.preventDefault()
        e.stopPropagation()
        handleImageClick(img.src)
      }
    }

    // 初始设置样式 - 延迟处理确保 DOM 完全渲染
    const timeoutId = setTimeout(() => {
      updateImageStyles()
    }, 300)

    // 为每个内容容器添加事件监听器和 MutationObserver
    const cleanupFunctions: Array<() => void> = []
    
    // 防抖处理函数
    let updateTimer: NodeJS.Timeout | null = null
    const debouncedUpdateImageStyles = () => {
      if (updateTimer) {
        clearTimeout(updateTimer)
      }
      updateTimer = setTimeout(() => {
        updateImageStyles()
      }, 100)
    }
    
    articleContentRefs.current.forEach((contentDiv) => {
      if (!contentDiv) return
      
      // 添加点击事件监听器
      contentDiv.addEventListener('click', handleContainerClick, true)
      cleanupFunctions.push(() => {
        contentDiv.removeEventListener('click', handleContainerClick, true)
      })
      
      // 添加 MutationObserver 监听 DOM 变化，使用防抖
      const observer = new MutationObserver(() => {
        debouncedUpdateImageStyles()
      })
      
      observer.observe(contentDiv, {
        childList: true,
        subtree: true,
      })
      
      cleanupFunctions.push(() => {
        observer.disconnect()
      })
    })
    
    // 清理防抖定时器
    cleanupFunctions.push(() => {
      if (updateTimer) {
        clearTimeout(updateTimer)
      }
    })

    return () => {
      clearTimeout(timeoutId)
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [articles, handleImageClick, hideImagesAndVideos, expandedMedia, toggleMediaExpansion])

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
          
          {/* 新文章通知栏 */}
          {newArticlesCount > 0 && (
            <div className="sticky top-8 z-10 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 mb-4 flex items-center justify-between">
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
        </div>
        
        {/* 新文章通知栏 */}
        {newArticlesCount > 0 && (
          <div className="sticky top-8 z-10 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 mb-4 flex items-center justify-between">
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
            return (
              <article
                key={article.id}
                data-id={article.id}
                data-article-id={article.id}
                ref={(el) => {
                  if (el) {
                    articleRefs.current.set(article.id, el)
                  } else {
                    articleRefs.current.delete(article.id)
                  }
                }}
                className={`telegram-card rounded-2xl bg-white p-5 sm:p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-gray-800 dark:shadow-gray-900/10`}
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
                  {readLaterArticles.has(article.id) && (
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
                  onClick={() => handleTitleClick(article)}
                  className="block mb-3 group"
                >
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 break-words transition-colors leading-snug">
                    {article.title}
                  </h3>
                </a>

                {/* 文章完整内容 */}
                {article.content && (
                  <div 
                    ref={(el) => {
                      if (el) articleContentRefs.current.set(article.id, el)
                    }}
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
                    onClick={(e) => handleToggleReadLater(article.id, e)}
                    className={`rounded-lg p-2 transition-colors flex-shrink-0 ${
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

        {/* 没有更多内容时显示已读当前列表按钮 */}
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

        {/* 全部已读提示 */}
        {!hasMore && articles.length > 0 && unreadCount === 0 && (
          <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">已全部阅读完毕</p>
          </div>
        )}
      </div>
      
      {/* 图片预览 Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
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
    </div>
  )
}
