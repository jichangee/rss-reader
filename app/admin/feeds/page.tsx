"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, Trash2, RefreshCw, Rss, ExternalLink, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FeedData {
  id: string
  title: string
  url: string
  description: string | null
  imageUrl: string | null
  enableTranslation: boolean
  lastRefreshedAt: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count: {
    articles: number
    webhooks: number
  }
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<FeedData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("createdAt")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  useEffect(() => {
    loadFeeds()
  }, [page, sortBy])

  useEffect(() => {
    // 搜索时重置页码
    if (page !== 1) {
      setPage(1)
    } else {
      loadFeeds()
    }
  }, [search])

  const loadFeeds = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search,
        sortBy,
        sortOrder: "desc"
      })
      
      const res = await fetch(`/api/admin/feeds?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFeeds(data.feeds)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("加载订阅源列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshFeed = async (feedId: string) => {
    try {
      setRefreshing(feedId)
      const res = await fetch("/api/admin/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId })
      })

      if (res.ok) {
        alert("刷新成功")
        loadFeeds()
      } else {
        const data = await res.json()
        alert(data.error || "刷新失败")
      }
    } catch (error) {
      console.error("刷新订阅源失败:", error)
      alert("刷新失败")
    } finally {
      setRefreshing(null)
    }
  }

  const handleRefreshAll = async () => {
    if (!confirm("确定要刷新所有订阅源吗？这可能需要一些时间。")) {
      return
    }

    try {
      setRefreshing("all")
      const res = await fetch("/api/admin/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })

      if (res.ok) {
        const data = await res.json()
        alert(`刷新完成！成功: ${data.success?.length || 0}, 失败: ${data.failed?.length || 0}`)
        loadFeeds()
      } else {
        const data = await res.json()
        alert(data.error || "刷新失败")
      }
    } catch (error) {
      console.error("刷新所有订阅源失败:", error)
      alert("刷新失败")
    } finally {
      setRefreshing(null)
    }
  }

  const handleDeleteFeed = async (feedId: string, feedTitle: string) => {
    if (!confirm(`确定要删除订阅源 "${feedTitle}" 吗？此操作不可撤销，将删除该订阅源的所有文章。`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/feeds/${feedId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        alert("删除成功")
        loadFeeds()
      } else {
        const data = await res.json()
        alert(data.error || "删除失败")
      }
    } catch (error) {
      console.error("删除订阅源失败:", error)
      alert("删除失败")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="搜索订阅源标题或URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">创建时间</SelectItem>
            <SelectItem value="updatedAt">更新时间</SelectItem>
            <SelectItem value="articleCount">文章数量</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleRefreshAll}
          disabled={refreshing === "all"}
          variant="default"
        >
          {refreshing === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          刷新全部
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          共 <span className="font-semibold text-gray-900 dark:text-white">{total}</span> 个订阅源
        </p>
      </div>

      {/* 订阅源列表 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  订阅源
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  所有者
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  统计
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  最后刷新
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  创建时间
                </TableHead>
                <TableHead className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map((feed) => (
                <TableRow key={feed.id}>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      {feed.imageUrl ? (
                        <img
                          src={feed.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <Rss className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {feed.title}
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={feed.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 truncate max-w-md flex items-center"
                          >
                            {feed.url}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {feed.user.image ? (
                        <img
                          src={feed.user.image}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <User className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {feed.user.name || "未命名"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {feed.user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white">
                        {feed._count.articles} 篇文章
                      </div>
                      {feed.enableTranslation && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">
                          已启用翻译
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {feed.lastRefreshedAt ? formatDate(feed.lastRefreshedAt) : "从未"}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(feed.createdAt)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        onClick={() => handleRefreshFeed(feed.id)}
                        disabled={refreshing === feed.id}
                        variant="ghost"
                        size="sm"
                      >
                        {refreshing === feed.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDeleteFeed(feed.id, feed.title)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  上一页
                </Button>
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                  className="ml-3"
                >
                  下一页
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    第 <span className="font-medium">{page}</span> 页，共{" "}
                    <span className="font-medium">{totalPages}</span> 页
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                    <Button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                      className="rounded-l-md rounded-r-none"
                    >
                      上一页
                    </Button>
                    <Button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      variant="outline"
                      size="sm"
                      className="rounded-r-md rounded-l-none"
                    >
                      下一页
                    </Button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
