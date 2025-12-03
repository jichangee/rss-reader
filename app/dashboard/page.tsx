"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"
import ArticleList from "@/app/components/ArticleList"
import AddFeedModal from "@/app/components/AddFeedModal"
import EditFeedModal from "@/app/components/EditFeedModal"
import { Loader2, Menu } from "lucide-react"

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [feeds, setFeeds] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [editingFeed, setEditingFeed] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedsLoading, setFeedsLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(() => {
    // 从 localStorage 读取保存的"仅未读"设置
    // 如果首次进入（没有保存的值），默认开启仅未读功能
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("unreadOnly")
      if (saved === null) {
        // 首次进入，默认开启并保存
        localStorage.setItem("unreadOnly", "true")
        return true
      }
      return saved === "true"
    }
    return true // 服务端渲染时默认开启
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [markReadOnScroll, setMarkReadOnScroll] = useState(false)
  const [autoRefreshOnLoad, setAutoRefreshOnLoad] = useState<boolean | null>(null)
  const [isRefreshingAfterMarkAllRead, setIsRefreshingAfterMarkAllRead] = useState(false)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const [newArticlesCount, setNewArticlesCount] = useState(0)
  const hasInitialLoadRef = useRef(false)
  const selectedFeedRef = useRef<string | null>(null)
  const unreadOnlyRef = useRef<boolean>(true)
  
  // 同步 ref 值
  useEffect(() => {
    selectedFeedRef.current = selectedFeed
    unreadOnlyRef.current = unreadOnly
  }, [selectedFeed, unreadOnly])

  // 从 URL 读取选中的订阅
  useEffect(() => {
    if (!isInitialized) {
      const feedId = searchParams.get("feed")
      if (feedId) {
        setSelectedFeed(feedId)
      }
      setIsInitialized(true)
    }
  }, [searchParams, isInitialized])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // 初始化：加载设置
  useEffect(() => {
    if (status === "authenticated") {
      const initializeDashboard = async () => {
        // 先加载设置
        await loadSettings()
      }
      initializeDashboard()
    }
  }, [status])

  // 首次加载：加载订阅和文章
  useEffect(() => {
    if (status === "authenticated" && autoRefreshOnLoad !== null && isInitialized && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true

      const performInitialLoad = async () => {
        // 加载现有数据
        await loadArticles(selectedFeed || undefined, unreadOnly)
        await loadFeeds()
      }

      performInitialLoad()
    }
  }, [status, autoRefreshOnLoad, isInitialized])

  const loadFeeds = async () => {
    try {
      setFeedsLoading(true)
      const res = await fetch("/api/feeds")
      if (res.ok) {
        const data = await res.json()
        setFeeds(data)
      }
    } catch (error) {
      console.error("加载订阅失败:", error)
    } finally {
      setFeedsLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/user/settings")
      if (res.ok) {
        const data = await res.json()
        setMarkReadOnScroll(data.markReadOnScroll ?? false)
        setAutoRefreshOnLoad(data.autoRefreshOnLoad ?? true)
      }
    } catch (error) {
      console.error("加载设置失败:", error)
    }
  }

  const loadArticles = async (feedId?: string, unread?: boolean, reset = true, silent = false) => {
    try {
      if (!silent) setLoading(true)
      const params = new URLSearchParams()
      if (feedId) params.append("feedId", feedId)
      if (unread) params.append("unreadOnly", "true")
      params.append("limit", "10")

      const res = await fetch(`/api/articles?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const hasArticles = data.articles && data.articles.length > 0
        
        if (hasArticles) {
          // 如果有文章数据，先返回数据，再静默调用刷新接口
          setArticles(reset ? data.articles : [...articles, ...data.articles])
          setNextCursor(data.nextCursor)
          setHasMore(data.hasNextPage)
          
          // 静默刷新（不阻塞UI），传入 hasExistingArticles=true 表示当前有文章数据
          refreshFeedsSilently(feedId, true).catch(err => {
            console.error("静默刷新失败:", err)
          })
        } else {
          // 如果没有文章数据，先调用刷新接口，然后再返回文章数据
          try {
            // 先刷新数据
            const refreshRes = await fetch("/api/feeds/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                feedIds: feedId ? [feedId] : undefined,
                forceRefresh: true 
              }),
            })
            
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              
              // 刷新完成后，重新加载文章列表
              const articlesRes = await fetch(`/api/articles?${params.toString()}`)
              if (articlesRes.ok) {
                const articlesData = await articlesRes.json()
                setArticles(reset ? articlesData.articles : [...articles, ...articlesData.articles])
                setNextCursor(articlesData.nextCursor)
                setHasMore(articlesData.hasNextPage)
                
                // 如果有新文章，显示通知
                if (refreshData.newArticlesCount > 0) {
                  setNewArticlesCount(refreshData.newArticlesCount)
                }
              }
            } else if (refreshRes.status === 429) {
              // 刷新过于频繁，仍然加载现有数据
              setArticles(reset ? data.articles : [...articles, ...data.articles])
              setNextCursor(data.nextCursor)
              setHasMore(data.hasNextPage)
            } else {
              // 刷新失败，仍然加载现有数据
              setArticles(reset ? data.articles : [...articles, ...data.articles])
              setNextCursor(data.nextCursor)
              setHasMore(data.hasNextPage)
            }
          } catch (refreshError) {
            console.error("刷新失败:", refreshError)
            // 刷新失败，仍然加载现有数据
            setArticles(reset ? data.articles : [...articles, ...data.articles])
            setNextCursor(data.nextCursor)
            setHasMore(data.hasNextPage)
          }
        }
      }
    } catch (error) {
      console.error("加载文章失败:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // 静默刷新订阅源（不阻塞UI，不显示加载状态）
  const refreshFeedsSilently = async (feedId?: string, hasExistingArticles = false) => {
    try {
      const res = await fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          feedIds: feedId ? [feedId] : undefined,
          forceRefresh: false // 使用正常刷新，遵守时间限制
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        
        // 如果当前页面有文章数据，不显示横幅，新文章会在下次加载时自动包含
        // 只有在没有文章数据时才显示横幅
        if (data.newArticlesCount > 0 && !hasExistingArticles) {
          setNewArticlesCount(data.newArticlesCount)
        }
        
        // 更新订阅列表的未读计数
        await loadFeeds()
      }
      // 429 或其他错误静默处理，不打扰用户
    } catch (error) {
      // 静默处理错误，不显示给用户
      console.error("静默刷新失败:", error)
    }
  }

  const loadMoreArticles = async () => {
    if (!nextCursor || isLoadingMore) return

    try {
      setIsLoadingMore(true)
      const params = new URLSearchParams()
      if (selectedFeed) params.append("feedId", selectedFeed)
      if (unreadOnly) params.append("unreadOnly", "true")
      params.append("limit", "10")
      params.append("cursor", nextCursor)

      const res = await fetch(`/api/articles?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setArticles([...articles, ...data.articles])
        setNextCursor(data.nextCursor)
        setHasMore(data.hasNextPage)
      }
    } catch (error) {
      console.error("加载更多文章失败:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleFeedSelect = (feedId: string | null) => {
    setSelectedFeed(feedId)
    loadArticles(feedId || undefined, unreadOnly)

    // 更新 URL
    if (feedId) {
      router.push(`/dashboard?feed=${feedId}`)
    } else {
      router.push("/dashboard")
    }
  }

  const handleAddFeed = async (url: string, enableTranslation: boolean) => {
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, enableTranslation }),
      })

      if (res.ok) {
        await loadArticles(selectedFeed || undefined, unreadOnly)
        await loadFeeds()
        setShowAddFeed(false)
        return { success: true }
      } else {
        const error = await res.json()
        return { success: false, error: error.error || "添加失败" }
      }
    } catch (error) {
      return { success: false, error: "添加失败" }
    }
  }

  const handleBatchAddFeed = async (urls: string[], enableTranslation: boolean) => {
    try {
      const res = await fetch("/api/feeds/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, enableTranslation }),
      })

      if (res.ok) {
        const data = await res.json()
        // 如果有成功的添加，刷新订阅列表和文章列表
        if (data.summary && data.summary.success > 0) {
          await loadArticles(selectedFeed || undefined, unreadOnly)
          await loadFeeds()
        }
        return {
          success: true,
          results: data.results,
          errors: data.errors,
          summary: data.summary,
        }
      } else {
        const error = await res.json()
        return { success: false, error: error.error || "批量添加失败" }
      }
    } catch (error) {
      return { success: false, error: "批量添加失败，请重试" }
    }
  }

  const handleEditFeed = async (
    feedId: string,
    data: { title?: string; url?: string; enableTranslation?: boolean }
  ) => {
    try {
      const res = await fetch(`/api/feeds/${feedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        await loadArticles(selectedFeed || undefined, unreadOnly)
        await loadFeeds()
        setEditingFeed(null)
        return { success: true }
      } else {
        const error = await res.json()
        return { success: false, error: error.error || "更新失败" }
      }
    } catch (error) {
      return { success: false, error: "更新失败" }
    }
  }

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm("确定要删除此订阅吗？")) return

    try {
      const res = await fetch(`/api/feeds/${feedId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        if (selectedFeed === feedId) {
          setSelectedFeed(null)
          await loadArticles(undefined, unreadOnly)
        }
        await loadFeeds()
      }
    } catch (error) {
      console.error("删除订阅失败:", error)
    }
  }

  // 刷新并重新加载函数
  const handleRefreshAndReload = async () => {
    setNewArticlesCount(0)
    setNextCursor(null)
    setHasMore(true)
    await loadArticles(selectedFeed || undefined, unreadOnly, true, false)
  }

  
  const handleMarkAsRead = async (articleId: string) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/read`, {
        method: "POST",
      })

      if (res.ok) {
        const data = await res.json()

        // 如果文章已经标记为已读，直接返回
        if (data.alreadyRead) {
          return
        }

        // 从当前 articles 状态中找到文章
        const article = articles.find((a) => a.id === articleId)

        // 如果文章不存在或已经是已读状态，不更新
        if (!article || article.readBy.length > 0) {
          return
        }

        // 保存 feedId
        const targetFeedId = article.feed.id

        // 更新文章状态
        setArticles((prevArticles) =>
          prevArticles.map((a) =>
            a.id === articleId ? { ...a, readBy: [{ articleId }] } : a
          )
        )

        // 更新对应 feed 的未读计数（只更新一次）
        setFeeds((prevFeeds) =>
          prevFeeds.map((feed) =>
            feed.id === targetFeedId && feed.unreadCount > 0
              ? { ...feed, unreadCount: feed.unreadCount - 1 }
              : feed
          )
        )
      }
    } catch (error) {
      console.error("标记已读失败:", error)
    }
  }

  const handleMarkAsReadBatch = async (articleIds: string[]) => {
    if (articleIds.length === 0) return

    try {
      const res = await fetch("/api/articles/read-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds }),
      })

      if (res.ok) {
        const data = await res.json()

        // 获取所有被标记的文章（包括新标记的和已经标记的）
        const markedArticles = articles.filter((a) => articleIds.includes(a.id))

        // 统计每个 feed 的未读数减少量
        const feedUnreadDelta = new Map<string, number>()
        markedArticles.forEach((article) => {
          // 只统计未读文章
          if (article.readBy.length === 0) {
            const feedId = article.feed.id
            feedUnreadDelta.set(feedId, (feedUnreadDelta.get(feedId) || 0) + 1)
          }
        })

        // 更新文章状态
        setArticles((prevArticles) =>
          prevArticles.map((a) =>
            articleIds.includes(a.id) ? { ...a, readBy: [{ articleId: a.id }] } : a
          )
        )

        // 更新 feeds 的未读计数
        setFeeds((prevFeeds) =>
          prevFeeds.map((feed) => {
            const delta = feedUnreadDelta.get(feed.id) || 0
            return delta > 0 && feed.unreadCount > 0
              ? { ...feed, unreadCount: Math.max(0, feed.unreadCount - delta) }
              : feed
          })
        )
      }
    } catch (error) {
      console.error("批量标记已读失败:", error)
    }
  }

  const toggleUnreadOnly = () => {
    const newUnreadOnly = !unreadOnly
    setUnreadOnly(newUnreadOnly)
    // 保存到 localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("unreadOnly", String(newUnreadOnly))
    }
    loadArticles(selectedFeed || undefined, newUnreadOnly)
  }

  const handleMarkAllAsRead = async () => {
    try {
      // 只标记当前列表中未读的文章
      const unreadArticleIds = articles
        .filter((a) => a.readBy.length === 0)
        .map((a) => a.id)

      if (unreadArticleIds.length === 0) {
        return
      }

      // 设置加载状态
      setIsRefreshingAfterMarkAllRead(true)

      // 使用批量标记已读功能
      await handleMarkAsReadBatch(unreadArticleIds)

      // 重置分页状态
      setNextCursor(null)
      setHasMore(true)

      // 重新加载第一页文章数据
      await loadArticles(selectedFeed || undefined, unreadOnly, true, false)
      
      // 更新订阅列表的未读计数
      await loadFeeds()
    } catch (error) {
      console.error("标记当前列表已读失败:", error)
    } finally {
      setIsRefreshingAfterMarkAllRead(false)
    }
  }

  const handleManualRefresh = async () => {
    if (isManualRefreshing) return
    
    try {
      setIsManualRefreshing(true)
      
      // 同步调用刷新 API
      const res = await fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      })
      
      if (res.status === 429) {
        const data = await res.json()
        alert(`刷新过于频繁，请等待 ${data.remainingMinutes || 0} 分钟后再试`)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        
        // 如果当前页面有文章数据，直接重新加载第一页，新文章会自动包含在列表中
        // 只有在没有文章数据时才显示横幅
        if (articles.length > 0) {
          // 重新加载第一页，新文章会自动出现在列表顶部
          await loadArticles(selectedFeed || undefined, unreadOnly, true, false)
        } else if (data.newArticlesCount > 0) {
          // 没有文章数据时，显示横幅通知
          setNewArticlesCount(data.newArticlesCount)
        }
        
        // 更新订阅列表的未读计数
        await loadFeeds()
      }
    } catch (error) {
      console.error("手动刷新失败:", error)
    } finally {
      setIsManualRefreshing(false)
    }
  }

  const handleMarkOlderAsRead = async (range: '24h' | 'week'): Promise<{ success: boolean; count?: number; message?: string }> => {
    try {
      let days: number | undefined
      let cutoffDate: Date | undefined

      if (range === '24h') {
        // 24小时之前
        days = 1
      } else if (range === 'week') {
        // 本周之前：计算本周开始的时间（周一 00:00:00）
        const now = new Date()
        const dayOfWeek = now.getDay() // 0 = 周日, 1 = 周一, ..., 6 = 周六
        // 计算到本周一的偏移天数（如果今天是周日，则偏移到上周一）
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        cutoffDate = new Date(now)
        cutoffDate.setDate(now.getDate() - daysToMonday)
        cutoffDate.setHours(0, 0, 0, 0)
      }

      const res = await fetch("/api/articles/read-older", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: days,
          cutoffDate: cutoffDate?.toISOString() // 如果指定了具体日期，传递 ISO 字符串
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // 简单的做法是重新加载，或者全量刷新
        // 因为很难知道哪些具体文章被更新了（除非 API 返回 IDs，但可能很多）
        // 这里我们选择刷新当前列表
        await loadArticles(selectedFeed || undefined, unreadOnly)
        await loadFeeds() // 更新侧边栏计数

        return {
          success: true,
          count: data.count || 0,
          message: data.count > 0 ? `已将 ${data.count} 篇旧文章标记为已读` : "没有符合条件的旧文章"
        }
      } else {
        return {
          success: false,
          message: "操作失败，请重试"
        }
      }
    } catch (error) {
      console.error("清理旧文章失败:", error)
      return {
        success: false,
        message: "操作失败，请重试"
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar
        feeds={feeds}
        selectedFeed={selectedFeed}
        onSelectFeed={handleFeedSelect}
        onAddFeed={() => setShowAddFeed(true)}
        onEditFeed={(feed) => setEditingFeed(feed)}
        onDeleteFeed={handleDeleteFeed}
          unreadOnly={unreadOnly}
        onToggleUnreadOnly={toggleUnreadOnly}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        loading={feedsLoading}
        />
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* 移动端顶部菜单栏 */}
        <div className="md:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Menu className="h-6 w-6" />
            <span className="font-medium">菜单</span>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ArticleList
            articles={articles}
            loading={loading}
            hasMore={hasMore}
            onMarkAsRead={handleMarkAsRead}
            onMarkAsReadBatch={handleMarkAsReadBatch}
            onLoadMore={loadMoreArticles}
            onMarkAllAsRead={handleMarkAllAsRead}
            onMarkOlderAsRead={handleMarkOlderAsRead}
            markReadOnScroll={markReadOnScroll}
            isRefreshing={isRefreshingAfterMarkAllRead || isManualRefreshing}
            onRefresh={handleManualRefresh}
            newArticlesCount={newArticlesCount}
            onRefreshAndReload={handleRefreshAndReload}
          />
        </div>
      </main>
      {showAddFeed && (
        <AddFeedModal
          onClose={() => setShowAddFeed(false)}
          onAddSingle={handleAddFeed}
          onAddBatch={handleBatchAddFeed}
        />
      )}
      {editingFeed && (
        <EditFeedModal
          feed={editingFeed}
          onClose={() => setEditingFeed(null)}
          onUpdate={handleEditFeed}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}

