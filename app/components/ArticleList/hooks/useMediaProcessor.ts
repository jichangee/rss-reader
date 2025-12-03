import { useEffect, useRef, useCallback } from "react"

interface UseMediaProcessorProps {
  articles: Array<{ id: string }>
  hideImagesAndVideos: boolean
  expandedMedia: Map<string, Set<string>>
  onToggleMediaExpansion: (articleId: string, mediaId: string) => void
  onImageClick: (src: string) => void
}

export function useMediaProcessor({
  articles,
  hideImagesAndVideos,
  expandedMedia,
  onToggleMediaExpansion,
  onImageClick,
}: UseMediaProcessorProps) {
  const articleContentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const processMediaElements = useCallback((contentDiv: HTMLDivElement, articleId: string) => {
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
      const wasHiddenByUs = img.dataset.hiddenByUs === 'true'
      const shouldBeHidden = shouldHide && !wasHiddenByUs
      const shouldBeShown = !shouldHide && wasHiddenByUs

      if (shouldHide) {
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
            onToggleMediaExpansion(articleId, mediaId)
          }
          wrapper?.appendChild(toggleBtn)
        }
      } else {
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
              onToggleMediaExpansion(articleId, mediaId)
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
      const wasHiddenByUs = video.dataset.hiddenByUs === 'true'
      const shouldBeHidden = shouldHide && !wasHiddenByUs
      const shouldBeShown = !shouldHide && wasHiddenByUs

      if (shouldHide) {
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
            onToggleMediaExpansion(articleId, mediaId)
          }
          wrapper?.appendChild(toggleBtn)
        }
      } else {
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
              onToggleMediaExpansion(articleId, mediaId)
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
  }, [hideImagesAndVideos, expandedMedia, onToggleMediaExpansion])

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

    const timeoutId = setTimeout(() => {
      updateImageStyles()
    }, 300)

    const cleanupFunctions: Array<() => void> = []
    
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
      
      contentDiv.addEventListener('click', handleContainerClick, true)
      cleanupFunctions.push(() => {
        contentDiv.removeEventListener('click', handleContainerClick, true)
      })
      
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
    
    cleanupFunctions.push(() => {
      if (updateTimer) {
        clearTimeout(updateTimer)
      }
    })

    return () => {
      clearTimeout(timeoutId)
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [articles, processMediaElements, onImageClick])

  return { articleContentRefs }
}

