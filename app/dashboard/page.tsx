"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"
import ArticleList from "@/app/components/ArticleList"
import AddFeedModal from "@/app/components/AddFeedModal"
import BatchAddFeedModal from "@/app/components/BatchAddFeedModal"
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
  const [showBatchAddFeed, setShowBatchAddFeed] = useState(false)
  const [editingFeed, setEditingFeed] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
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
  const hasInitialLoadRef = useRef(false)
  const lastAutoRefreshRef = useRef<number>(0)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

  // 首次加载：加载订阅和文章，并根据设置决定是否自动刷新
  useEffect(() => {
    if (status === "authenticated" && autoRefreshOnLoad !== null && isInitialized && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true

      const performInitialLoad = async () => {
        // 先加载现有数据
        await loadArticles(selectedFeed || undefined, unreadOnly)
        await loadFeeds()
        
        // 根据设置决定是否自动刷新
        if (autoRefreshOnLoad) {
          // 后台静默刷新，不阻塞UI
          triggerBackgroundRefresh()
        }
      }

      performInitialLoad()
    }
  }, [status, autoRefreshOnLoad, isInitialized])

  // 自动后台刷新：用户浏览时每10分钟自动触发
  useEffect(() => {
    if (status !== "authenticated") return

    // 设置定时器，每10分钟检查一次
    const intervalId = setInterval(() => {
      const now = Date.now()
      const timeSinceLastRefresh = now - lastAutoRefreshRef.current
      const TEN_MINUTES = 10 * 60 * 1000

      // 如果距离上次刷新超过10分钟，触发后台刷新
      if (timeSinceLastRefresh >= TEN_MINUTES || lastAutoRefreshRef.current === 0) {
        console.log("自动触发后台刷新（用户浏览时）")
        
        // 发送刷新请求，不等待完成
        fetch("/api/feeds/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).catch(err => {
          console.error("触发后台刷新失败:", err)
        })

        // 记录刷新时间
        lastAutoRefreshRef.current = now
        
        // 5秒后静默更新文章列表
        setTimeout(() => {
          loadArticles(selectedFeed || undefined, unreadOnly, true, true)
          loadFeeds()
        }, 5000)
      }
    }, 60 * 1000) // 每分钟检查一次

    autoRefreshIntervalRef.current = intervalId

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
    }
  }, [status, selectedFeed, unreadOnly])

  const loadFeeds = async () => {
    try {
      const res = await fetch("/api/feeds")
      if (res.ok) {
        const data = await res.json()
        setFeeds(data)
      }
    } catch (error) {
      console.error("加载订阅失败:", error)
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
        setArticles(reset ? data.articles : [...articles, ...data.articles])
        setNextCursor(data.nextCursor)
        setHasMore(data.hasNextPage)
      }
    } catch (error) {
      console.error("加载文章失败:", error)
    } finally {
      if (!silent) setLoading(false)
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

  // 触发后台静默刷新
  const triggerBackgroundRefresh = async (feedIds?: string[]) => {
    try {
      // 发送刷新请求，不等待完成
      fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds }),
      }).catch(err => {
        console.error("触发后台刷新失败:", err)
      })

      // 记录刷新时间
      lastAutoRefreshRef.current = Date.now()

      console.log("后台刷新已触发")
    } catch (error) {
      console.error("触发刷新失败:", error)
    }
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
      const params = new URLSearchParams()
      if (selectedFeed) params.append("feedId", selectedFeed)

      const res = await fetch(`/api/articles/read-all?${params.toString()}`, {
        method: "POST",
      })

      if (res.ok) {
        const data = await res.json()

        // 更新本地文章状态
        setArticles((prev) =>
          prev.map((a) => ({
            ...a,
            readBy: a.readBy.length === 0 ? [{ articleId: a.id }] : a.readBy,
          }))
        )

        // 更新 feeds 的未读计数
        if (selectedFeed) {
          // 如果选择了特定 feed，只更新该 feed
          setFeeds((prev) =>
            prev.map((feed) =>
              feed.id === selectedFeed
                ? { ...feed, unreadCount: 0 }
                : feed
            )
          )
        } else {
          // 如果选择了全部，需要重新加载 feeds 以获取准确的未读计数
          await loadFeeds()
        }

        // 设置刷新状态，显示正在刷新
        setIsRefreshingAfterMarkAllRead(true)
        console.log("全部已读完成，触发自动刷新...")
        await triggerBackgroundRefresh(selectedFeed ? [selectedFeed] : undefined)

        // 3秒后重新加载文章列表以显示刷新结果
        setTimeout(async () => {
          await loadArticles(selectedFeed || undefined, unreadOnly, true, true)
          await loadFeeds()
          setIsRefreshingAfterMarkAllRead(false)
          console.log("自动刷新完成，文章列表已更新")
        }, 3000)
      }
    } catch (error) {
      console.error("全部标记已读失败:", error)
      setIsRefreshingAfterMarkAllRead(false)
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
        onBatchAddFeed={() => setShowBatchAddFeed(true)}
        onEditFeed={(feed) => setEditingFeed(feed)}
        onDeleteFeed={handleDeleteFeed}
          unreadOnly={unreadOnly}
        onToggleUnreadOnly={toggleUnreadOnly}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
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
            isRefreshing={isRefreshingAfterMarkAllRead}
          />
        </div>
      </main>
      {showAddFeed && (
        <AddFeedModal
          onClose={() => setShowAddFeed(false)}
          onAdd={handleAddFeed}
        />
      )}
      {showBatchAddFeed && (
        <BatchAddFeedModal
          onClose={() => setShowBatchAddFeed(false)}
          onAdd={handleBatchAddFeed}
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

