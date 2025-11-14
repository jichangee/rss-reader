"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"
import ArticleList from "@/app/components/ArticleList"
import AddFeedModal from "@/app/components/AddFeedModal"
import { Loader2, Menu } from "lucide-react"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [feeds, setFeeds] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      loadFeeds()
      loadArticles()
    }
  }, [status])

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

  const loadArticles = async (feedId?: string, unread?: boolean) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (feedId) params.append("feedId", feedId)
      if (unread) params.append("unreadOnly", "true")
      
      const res = await fetch(`/api/articles?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (error) {
      console.error("加载文章失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFeedSelect = (feedId: string | null) => {
    setSelectedFeed(feedId)
    loadArticles(feedId || undefined, unreadOnly)
  }

  const handleAddFeed = async (url: string) => {
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (res.ok) {
        await loadFeeds()
        await loadArticles(selectedFeed || undefined, unreadOnly)
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

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm("确定要删除此订阅吗？")) return

    try {
      const res = await fetch(`/api/feeds/${feedId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        await loadFeeds()
        if (selectedFeed === feedId) {
          setSelectedFeed(null)
          await loadArticles(undefined, unreadOnly)
        }
      }
    } catch (error) {
      console.error("删除订阅失败:", error)
    }
  }

  const handleRefresh = async () => {
    try {
      const res = await fetch("/api/feeds/refresh", {
        method: "POST",
      })

      if (res.ok) {
        await loadFeeds()
        await loadArticles(selectedFeed || undefined, unreadOnly)
      }
    } catch (error) {
      console.error("刷新失败:", error)
    }
  }

  const handleMarkAsRead = async (articleId: string) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/read`, {
        method: "POST",
      })

      if (res.ok) {
        setArticles((prev) =>
          prev.map((a) =>
            a.id === articleId ? { ...a, readBy: [{ articleId }] } : a
          )
        )
      }
    } catch (error) {
      console.error("标记已读失败:", error)
    }
  }

  const toggleUnreadOnly = () => {
    const newUnreadOnly = !unreadOnly
    setUnreadOnly(newUnreadOnly)
    loadArticles(selectedFeed || undefined, newUnreadOnly)
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
        onDeleteFeed={handleDeleteFeed}
        onRefresh={handleRefresh}
        unreadOnly={unreadOnly}
        onToggleUnreadOnly={toggleUnreadOnly}
      />
      <main className="flex-1 overflow-hidden">
        <ArticleList
          articles={articles}
          loading={loading}
          onMarkAsRead={handleMarkAsRead}
        />
      </main>
      {showAddFeed && (
        <AddFeedModal
          onClose={() => setShowAddFeed(false)}
          onAdd={handleAddFeed}
        />
      )}
    </div>
  )
}

