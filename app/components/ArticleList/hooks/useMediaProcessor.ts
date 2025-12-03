import { useEffect, useRef, useCallback, useState } from "react"

interface UseMediaProcessorProps {
  articles: Array<{ id: string }>
  hideImagesAndVideos: boolean
  expandedArticles: Set<string>
  onToggleMediaExpansion: (articleId: string) => void
  onImageClick: (src: string) => void
}

export function useMediaProcessor({
  articles,
  hideImagesAndVideos,
  expandedArticles,
  onToggleMediaExpansion,
  onImageClick,
}: UseMediaProcessorProps) {
  const articleContentRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [articleMediaCounts, setArticleMediaCounts] = useState<Map<string, number>>(new Map())

  const processMediaElements = useCallback((contentDiv: HTMLDivElement, articleId: string) => {
    if (!contentDiv || contentDiv.children.length === 0) return
    
    const isArticleExpanded = expandedArticles.has(articleId)
    
    // 统计媒体数量
    const images = contentDiv.querySelectorAll('img')
    const videos = contentDiv.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]')
    const totalMediaCount = images.length + videos.length
    
    // 更新媒体数量
    setArticleMediaCounts((prev) => {
      const newMap = new Map(prev)
      if (totalMediaCount > 0) {
        newMap.set(articleId, totalMediaCount)
      }
      return newMap
    })
    
    // 如果只有0或1个媒体，不需要统一按钮，使用原来的逻辑
    const needsUnifiedButton = totalMediaCount > 1
    
    // 处理图片
    images.forEach((img, index) => {
      const mediaId = `img-${index}`
      // 如果 hideImagesAndVideos 为 true，则根据 isArticleExpanded 决定是否隐藏
      const shouldHide = hideImagesAndVideos && !isArticleExpanded
      
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
      const wasHiddenByUs = img.dataset.hiddenByUs === 'true'
      const shouldBeHidden = shouldHide && !wasHiddenByUs
      const shouldBeShown = !shouldHide && wasHiddenByUs

      if (shouldHide) {
        // 立即设置隐藏属性，防止闪现
        if (shouldBeHidden) {
          img.dataset.hiddenByUs = 'true'
          img.style.display = 'none'
          if (wrapper) {
            wrapper.style.display = 'block'
          }
        }
        
        // 如果只有1个媒体，显示单个展开按钮；如果多个媒体，不在这里显示（在ArticleItem中显示统一按钮）
        if (!needsUnifiedButton) {
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
              onToggleMediaExpansion(articleId)
            }
            wrapper?.appendChild(toggleBtn)
          }
        } else {
          // 多个媒体时，移除单个按钮（统一按钮在ArticleItem中）
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
        }
      } else {
        if (shouldBeShown) {
          delete img.dataset.hiddenByUs
          img.style.display = ''
          if (wrapper) {
            wrapper.style.display = ''
          }
        }
        
        // 移除展开按钮
        const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
        if (toggleBtn) {
          toggleBtn.remove()
        }
        
        // 如果展开且只有1个媒体，添加折叠按钮
        if (isArticleExpanded && !needsUnifiedButton) {
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
              onToggleMediaExpansion(articleId)
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
    videos.forEach((videoElement, index) => {
      const video = videoElement as HTMLElement
      const mediaId = `video-${index}`
      // 如果 hideImagesAndVideos 为 true，则根据 isArticleExpanded 决定是否隐藏
      const shouldHide = hideImagesAndVideos && !isArticleExpanded
      
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
      const wasHiddenByUs = video.dataset.hiddenByUs === 'true'
      const shouldBeHidden = shouldHide && !wasHiddenByUs
      const shouldBeShown = !shouldHide && wasHiddenByUs

      if (shouldHide) {
        // 立即设置隐藏属性，防止闪现
        if (shouldBeHidden) {
          video.dataset.hiddenByUs = 'true'
          video.style.display = 'none'
          if (wrapper) {
            wrapper.style.display = 'block'
          }
          
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
        }
        
        // 如果只有1个媒体，显示单个展开按钮；如果多个媒体，不在这里显示（在ArticleItem中显示统一按钮）
        if (!needsUnifiedButton) {
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
              onToggleMediaExpansion(articleId)
            }
            wrapper?.appendChild(toggleBtn)
          }
        } else {
          // 多个媒体时，移除单个按钮（统一按钮在ArticleItem中）
          const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
          if (toggleBtn) {
            toggleBtn.remove()
          }
        }
      } else {
        if (shouldBeShown) {
          delete video.dataset.hiddenByUs
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
        }
        
        // 移除展开按钮
        const toggleBtn = wrapper?.querySelector('.media-toggle-btn')
        if (toggleBtn) {
          toggleBtn.remove()
        }
        
        // 如果展开且只有1个媒体，添加折叠按钮
        if (isArticleExpanded && !needsUnifiedButton) {
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
              onToggleMediaExpansion(articleId)
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
  }, [hideImagesAndVideos, expandedArticles, onToggleMediaExpansion])

  useEffect(() => {
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

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img')
      
      if (img && img instanceof HTMLImageElement) {
        e.preventDefault()
        e.stopPropagation()
        onImageClick(img.src)
      }
    }

    // 立即执行一次，不延迟，防止图片闪现
    updateImageStyles()

    const cleanupFunctions: Array<() => void> = []
    
    let updateTimer: NodeJS.Timeout | null = null
    const debouncedUpdateImageStyles = () => {
      if (updateTimer) {
        clearTimeout(updateTimer)
      }
      updateTimer = setTimeout(() => {
        updateImageStyles()
      }, 50) // 减少延迟时间
    }
    
    articleContentRefs.current.forEach((contentDiv) => {
      if (!contentDiv) return
      
      contentDiv.addEventListener('click', handleContainerClick, true)
      cleanupFunctions.push(() => {
        contentDiv.removeEventListener('click', handleContainerClick, true)
      })
      
      const observer = new MutationObserver((mutations) => {
        // 检查是否有新的图片或视频添加
        const hasNewMedia = mutations.some(mutation => {
          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement
              return element.tagName === 'IMG' || 
                     element.tagName === 'VIDEO' || 
                     element.tagName === 'IFRAME' ||
                     element.querySelector('img, video, iframe') !== null
            }
            return false
          })
        })
        
        if (hasNewMedia) {
          // 有新媒体元素时立即处理，不延迟
          updateImageStyles()
        } else {
          // 其他变化使用防抖
          debouncedUpdateImageStyles()
        }
      })
      
      observer.observe(contentDiv, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-hidden-by-us', 'style']
      })
      
      cleanupFunctions.push(() => {
        observer.disconnect()
      })
    })
    
    cleanupFunctions.push(() => {
      if (updateTimer) {
        clearTimeout(updateTimer)
      }
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [articles, processMediaElements, onImageClick])

  return { articleContentRefs, articleMediaCounts }
}

