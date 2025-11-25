/**
 * YouTube 工具函数
 * 用于检测、解析和处理 YouTube 视频链接
 */

/**
 * 从各种 YouTube URL 格式中提取视频 ID
 * 支持的格式：
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    
    // youtu.be 短链接
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0]
    }
    
    // youtube.com 各种格式
    if (urlObj.hostname.includes('youtube.com')) {
      // watch?v=VIDEO_ID
      const vParam = urlObj.searchParams.get('v')
      if (vParam) return vParam
      
      // embed/VIDEO_ID 或 v/VIDEO_ID
      const pathMatch = urlObj.pathname.match(/\/(embed|v)\/([^/?]+)/)
      if (pathMatch) return pathMatch[2]
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * 检测是否为 YouTube 链接
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be'
  } catch {
    return false
  }
}

/**
 * 检测当前平台
 */
export function detectPlatform(): 'ios' | 'other' {
  if (typeof window === 'undefined') return 'other'
  
  const userAgent = window.navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  
  return isIOS ? 'ios' : 'other'
}

/**
 * 从 HTML 内容中提取所有 YouTube 链接
 */
export function extractYouTubeLinks(html: string): string[] {
  const links: string[] = []
  
  // 匹配 href 属性中的 YouTube 链接
  const hrefRegex = /href=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']/gi
  let match
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1]
    if (isYouTubeUrl(url)) {
      links.push(url)
    }
  }
  
  // 也匹配纯文本中的 YouTube 链接
  const textRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s<>"]*)/gi
  
  while ((match = textRegex.exec(html)) !== null) {
    const url = match[1]
    if (isYouTubeUrl(url) && !links.includes(url)) {
      links.push(url)
    }
  }
  
  return links
}

/**
 * 从链接中提取第一个 YouTube 视频信息
 */
export function extractFirstYouTubeVideo(html: string): { url: string; videoId: string } | null {
  const links = extractYouTubeLinks(html)
  
  for (const url of links) {
    const videoId = extractVideoId(url)
    if (videoId) {
      return { url, videoId }
    }
  }
  
  return null
}
