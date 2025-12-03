export interface Article {
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

export interface ArticleListProps {
  articles: Article[]
  loading: boolean
  hasMore: boolean
  onMarkAsRead: (articleId: string) => void
  onMarkAsReadBatch: (articleIds: string[]) => void
  onLoadMore: () => void
  onMarkAllAsRead: () => void
  onMarkOlderAsRead?: (range: '24h' | 'week') => Promise<{ success: boolean; count?: number; message?: string }>
  markReadOnScroll?: boolean
  isRefreshing?: boolean
  onRefresh?: () => void
  newArticlesCount?: number
  onRefreshAndReload?: () => void
}

export interface ArticleItemProps {
  article: Article
  isReadLater: boolean
  hideImagesAndVideos: boolean
  expandedMedia: boolean // 改为布尔值，表示该文章的所有媒体是否展开
  mediaCount: number // 媒体数量
  onToggleReadLater: (articleId: string) => Promise<void>
  onMarkAsRead: (articleId: string) => void
  onImageClick: (src: string) => void
  onToggleMediaExpansion: () => void // 不再需要 mediaId 参数
  contentRef: (el: HTMLDivElement | null) => void
}

