"use client"

import { useEffect, useState, useRef } from "react"
import { Loader2, Bookmark, BookmarkCheck, CheckCircle2, Plus, ExternalLink, TrendingUp, Rss, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import ArticleDrawer from "./ArticleDrawer"
import { toast } from "sonner"

interface Article {
  id: string
  title: string
  link: string
  contentSnippet: string | null
  pubDate: Date | null
  author: string | null
  feed: {
    id: string
    title: string
    url: string
    imageUrl: string | null
  }
  hotness: {
    readLaterCount: number
    readCount: number
    uniqueUsers: number
    hotScore: number
  }
  isSubscribed: boolean
  isReadLater: boolean
  isRead: boolean
}

interface HotFeed {
  id: string
  title: string
  url: string
  description: string | null
  link: string | null
  imageUrl: string | null
  stats: {
    totalHotScore: number
    totalReadLaterCount: number
    totalReadCount: number
    uniqueUsers: number
    articleCount: number
    subscriberCount: number
  }
  isSubscribed: boolean
}

type TabType = 'trending' | 'feeds' | 'recommended'

interface SquareViewProps {
  onSubscribe?: () => void
}

export default function SquareView({ onSubscribe }: SquareViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trending')
  const [articles, setArticles] = useState<Article[]>([])
  const [hotFeeds, setHotFeeds] = useState<HotFeed[]>([])
  const [recommendReason, setRecommendReason] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  
  const observerTarget = useRef<HTMLDivElement>(null)

  // 加载热门文章
  const loadTrendingArticles = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      const response = await fetch(`/api/square/trending?page=${pageNum}&limit=20&days=30`)
      
      if (!response.ok) {
        throw new Error("加载失败")
      }

      const data = await response.json()
      
      if (append) {
        setArticles(prev => [...prev, ...data.articles])
      } else {
        setArticles(data.articles)
      }
      
      setHasMore(data.pagination.hasMore)
      setPage(pageNum)
    } catch (error) {
      console.error("加载热门文章失败:", error)
      toast.error("加载失败，请稍后重试")
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }

  // 加载热门RSS源
  const loadHotFeeds = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/square/hot-feeds?limit=20&days=30`)
      
      if (!response.ok) {
        throw new Error("加载失败")
      }

      const data = await response.json()
      setHotFeeds(data.feeds)
    } catch (error) {
      console.error("加载热门RSS源失败:", error)
      toast.error("加载失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  // 加载个性化推荐
  const loadRecommended = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      const response = await fetch(`/api/square/recommended?page=${pageNum}&limit=20`)
      
      if (!response.ok) {
        throw new Error("加载失败")
      }

      const data = await response.json()
      
      if (append) {
        setArticles(prev => [...prev, ...data.articles])
      } else {
        setArticles(data.articles)
        setRecommendReason(data.reason || "")
      }
      
      setHasMore(data.pagination.hasMore)
      setPage(pageNum)
    } catch (error) {
      console.error("加载推荐失败:", error)
      toast.error("加载失败，请稍后重试")
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Tab切换时加载对应数据
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    setArticles([])
    setHotFeeds([])

    if (activeTab === 'trending') {
      loadTrendingArticles(1, false)
    } else if (activeTab === 'feeds') {
      loadHotFeeds()
    } else if (activeTab === 'recommended') {
      loadRecommended(1, false)
    }
  }, [activeTab])

  // 无限滚动
  useEffect(() => {
    if (activeTab === 'feeds') return // 热门RSS源不需要分页

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loading) {
          if (activeTab === 'trending') {
            loadTrendingArticles(page + 1, true)
          } else if (activeTab === 'recommended') {
            loadRecommended(page + 1, true)
          }
        }
      },
      { threshold: 0.1 }
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
  }, [hasMore, isLoadingMore, loading, page, activeTab])

  // 订阅Feed
  const handleSubscribeFeed = async (feedUrl: string) => {
    const loadingKey = `subscribe-${feedUrl}`
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }))

    try {
      const response = await fetch("/api/square/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUrl })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || "订阅成功！")
        
        // 更新订阅状态
        if (activeTab === 'feeds') {
          setHotFeeds(prev => prev.map(f => 
            f.url === feedUrl ? { ...f, isSubscribed: true } : f
          ))
        } else {
          setArticles(prev => prev.map(a => 
            a.feed.url === feedUrl ? { ...a, isSubscribed: true } : a
          ))
        }

        if (onSubscribe) {
          onSubscribe()
        }
      } else {
        toast.error(data.error || "订阅失败")
      }
    } catch (error) {
      console.error("订阅失败:", error)
      toast.error("订阅失败，请稍后重试")
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  // 加入稍后读
  const handleReadLater = async (article: Article) => {
    const loadingKey = `readlater-${article.id}`
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }))

    try {
      const response = await fetch(`/api/articles/${article.id}/read-later`, {
        method: "POST"
      })

      if (response.ok) {
        toast.success("已加入稍后读")
        setArticles(prev => prev.map(a => 
          a.id === article.id ? { ...a, isReadLater: true } : a
        ))
      } else {
        const data = await response.json()
        toast.error(data.error || "操作失败")
      }
    } catch (error) {
      console.error("加入稍后读失败:", error)
      toast.error("操作失败，请稍后重试")
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  // 标记已读
  const handleMarkRead = async (article: Article) => {
    const loadingKey = `read-${article.id}`
    setActionLoading(prev => ({ ...prev, [loadingKey]: true }))

    try {
      const response = await fetch(`/api/articles/${article.id}/read`, {
        method: "POST"
      })

      if (response.ok) {
        toast.success("已标记为已读")
        setArticles(prev => prev.map(a => 
          a.id === article.id ? { ...a, isRead: true } : a
        ))
      } else {
        const data = await response.json()
        toast.error(data.error || "操作失败")
      }
    } catch (error) {
      console.error("标记已读失败:", error)
      toast.error("操作失败，请稍后重试")
    } finally {
      setActionLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  // Tab按钮组件
  const TabButton = ({ tab, icon: Icon, label }: { tab: TabType; icon: any; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === tab
          ? "bg-orange-600 text-white"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )

  if (loading && (articles.length === 0 && hotFeeds.length === 0)) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🔥 社区广场</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">发现热门内容</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">🔥 社区广场</h1>
        
        {/* Tab切换 */}
        <div className="flex space-x-2">
          <TabButton tab="trending" icon={TrendingUp} label="热门文章" />
          <TabButton tab="feeds" icon={Rss} label="热门RSS源" />
          <TabButton tab="recommended" icon={Sparkles} label="为你推荐" />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'feeds' ? (
          // 热门RSS源列表
          <div className="p-4 space-y-4">
            {hotFeeds.length === 0 ? (
              <div className="flex h-full items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">暂无热门RSS源</p>
                </div>
              </div>
            ) : (
              hotFeeds.map((feed, index) => (
                <div
                  key={feed.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start space-x-3">
                    {/* 排名 */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? "bg-yellow-500 text-white" :
                      index === 1 ? "bg-gray-400 text-white" :
                      index === 2 ? "bg-orange-600 text-white" :
                      "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Feed标题和图标 */}
                      <div className="flex items-center space-x-2 mb-2">
                        {feed.imageUrl ? (
                          <img src={feed.imageUrl} alt="" className="h-6 w-6 rounded" />
                        ) : (
                          <Rss className="h-6 w-6 text-gray-400" />
                        )}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {feed.title}
                        </h3>
                      </div>

                      {/* Feed描述 */}
                      {feed.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                          {feed.description}
                        </p>
                      )}

                      {/* 统计信息 */}
                      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>📝 {feed.stats.articleCount}篇文章</span>
                        <span>👥 {feed.stats.subscriberCount}人订阅</span>
                        <span>🔖 {feed.stats.totalReadLaterCount}次收藏</span>
                        <span>👁️ {feed.stats.totalReadCount}次阅读</span>
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          🔥 {feed.stats.totalHotScore.toFixed(1)}
                        </span>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center space-x-2">
                        {feed.isSubscribed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="text-green-600 border-green-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>已订阅</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSubscribeFeed(feed.url)}
                            disabled={actionLoading[`subscribe-${feed.url}`]}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {actionLoading[`subscribe-${feed.url}`] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            <span>订阅</span>
                          </Button>
                        )}
                        {feed.link && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(feed.link || feed.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // 文章列表（热门文章或推荐）
          <>
            {articles.length === 0 ? (
              <div className="flex h-full items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">暂无内容</p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {activeTab === 'recommended' && recommendReason && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center space-x-2">
                      <Sparkles className="h-4 w-4" />
                      <span>{recommendReason}</span>
                    </p>
                  </div>
                )}

                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow"
                  >
                    <h3 
                      className="text-lg font-semibold text-gray-900 dark:text-white mb-2 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
                      onClick={() => setSelectedArticle(article)}
                    >
                      {article.title}
                    </h3>

                    {article.contentSnippet && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {article.contentSnippet}
                      </p>
                    )}

                    <div className="flex items-center space-x-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                      {article.feed.imageUrl ? (
                        <img src={article.feed.imageUrl} alt="" className="h-4 w-4 rounded" />
                      ) : (
                        <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" />
                      )}
                      <span className="font-medium">{article.feed.title}</span>
                      {article.author && (
                        <>
                          <span>·</span>
                          <span>{article.author}</span>
                        </>
                      )}
                      {article.pubDate && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(article.pubDate).toLocaleDateString("zh-CN", {
                              timeZone: "Asia/Shanghai",
                            })}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>🔖 {article.hotness.readLaterCount}人收藏</span>
                      <span>👁️ {article.hotness.readCount}次阅读</span>
                      <span>👥 影响{article.hotness.uniqueUsers}位用户</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        🔥 热度 {article.hotness.hotScore.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {article.isSubscribed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="text-green-600 border-green-600"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>已订阅</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSubscribeFeed(article.feed.url)}
                          disabled={actionLoading[`subscribe-${article.feed.url}`]}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {actionLoading[`subscribe-${article.feed.url}`] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          <span>订阅此源</span>
                        </Button>
                      )}

                      {article.isReadLater ? (
                        <Button size="sm" variant="outline" disabled>
                          <BookmarkCheck className="h-4 w-4" />
                          <span>已收藏</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReadLater(article)}
                          disabled={actionLoading[`readlater-${article.id}`]}
                        >
                          {actionLoading[`readlater-${article.id}`] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                          <span>稍后读</span>
                        </Button>
                      )}

                      {article.isRead ? (
                        <Button size="sm" variant="ghost" disabled>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>已读</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkRead(article)}
                          disabled={actionLoading[`read-${article.id}`]}
                        >
                          {actionLoading[`read-${article.id}`] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>已读</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(article.link, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div ref={observerTarget} className="flex justify-center py-4">
                    {isLoadingMore && (
                      <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                    )}
                  </div>
                )}

                {!hasMore && articles.length > 0 && (
                  <div className="text-center py-4 text-sm text-gray-400">
                    已经到底了
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedArticle && (
        <ArticleDrawer
          article={{
            id: selectedArticle.id,
            title: selectedArticle.title,
            link: selectedArticle.link,
            content: undefined,
            contentSnippet: selectedArticle.contentSnippet || undefined,
            pubDate: selectedArticle.pubDate ? selectedArticle.pubDate.toString() : undefined,
            author: selectedArticle.author || undefined,
            feed: {
              title: selectedArticle.feed.title,
              imageUrl: selectedArticle.feed.imageUrl || undefined,
            },
            readBy: [],
            isReadLater: selectedArticle.isReadLater,
          }}
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  )
}
