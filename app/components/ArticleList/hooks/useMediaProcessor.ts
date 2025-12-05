import { useEffect, useRef, useCallback } from "react"

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

  // 设置图片点击事件
  useEffect(() => {
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img')
      
      if (img && img instanceof HTMLImageElement) {
        e.preventDefault()
        e.stopPropagation()
        onImageClick(img.src)
      }
    }

    // 为每个文章内容添加点击事件
    articleContentRefs.current.forEach((contentDiv) => {
      if (!contentDiv) return
      contentDiv.addEventListener('click', handleContainerClick, true)
    })

    return () => {
      articleContentRefs.current.forEach((contentDiv) => {
        if (!contentDiv) return
        contentDiv.removeEventListener('click', handleContainerClick, true)
      })
    }
  }, [articles, onImageClick])

  return { articleContentRefs }
}

// 从 HTML 字符串中统计媒体数量（使用正则表达式，不需要 DOM 解析）
export function countMediaFromHtml(html: string | undefined | null): number {
  if (!html) return 0
  
  // 匹配 img 标签
  const imgMatches = html.match(/<img\s+[^>]*>/gi) || []
  
  // 匹配 video 标签
  const videoMatches = html.match(/<video\s+[^>]*>/gi) || []
  
  // 匹配 iframe 标签（视频嵌入）
  const iframeMatches = html.match(/<iframe\s+[^>]*>/gi) || []
  
  return imgMatches.length + videoMatches.length + iframeMatches.length
}
