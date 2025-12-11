"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, Trash2, ExternalLink, Rss, Eye, Bookmark } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ArticleData {
  id: string
  title: string
  link: string
  contentSnippet: string | null
  pubDate: string | null
  author: string | null
  createdAt: string
  feed: {
    id: string
    title: string
    imageUrl: string | null
    user: {
      id: string
      name: string | null
      email: string
    }
  }
  _count: {
    readBy: number
    readLaterBy: number
  }
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadArticles()
  }, [page])

  useEffect(() => {
    // 搜索时重置页码
    if (page !== 1) {
      setPage(1)
    } else {
      loadArticles()
    }
  }, [search])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search
      })
      
      const res = await fetch(`/api/admin/articles?${params}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("加载文章列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticles(new Set(articles.map(a => a.id)))
    } else {
      setSelectedArticles(new Set())
    }
  }

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles)
    if (checked) {
      newSelected.add(articleId)
    } else {
      newSelected.delete(articleId)
    }
    setSelectedArticles(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedArticles.size === 0) {
      alert("请选择要删除的文章")
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedArticles.size} 篇文章吗？此操作不可撤销。`)) {
      return
    }

    try {
      setDeleting(true)
      const res = await fetch("/api/admin/articles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: Array.from(selectedArticles) })
      })

      if (res.ok) {
        const data = await res.json()
        alert(`成功删除 ${data.count} 篇文章`)
        setSelectedArticles(new Set())
        loadArticles()
      } else {
        const data = await res.json()
        alert(data.error || "删除失败")
      }
    } catch (error) {
      console.error("删除文章失败:", error)
      alert("删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteArticle = async (articleId: string, articleTitle: string) => {
    if (!confirm(`确定要删除文章 "${articleTitle}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        alert("删除成功")
        loadArticles()
      } else {
        const data = await res.json()
        alert(data.error || "删除失败")
      }
    } catch (error) {
      console.error("删除文章失败:", error)
      alert("删除失败")
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const allSelected = articles.length > 0 && selectedArticles.size === articles.length

  return (
    <div className="space-y-6">
      {/* 搜索和操作 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder="搜索文章标题或内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={handleDeleteSelected}
          disabled={selectedArticles.size === 0 || deleting}
          variant="destructive"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          删除选中 ({selectedArticles.size})
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          共 <span className="font-semibold text-gray-900 dark:text-white">{total}</span> 篇文章
        </p>
      </div>

      {/* 文章列表 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-3 w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  文章
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  订阅源
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  统计
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                  发布时间
                </TableHead>
                <TableHead className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="px-6 py-4">
                    <Checkbox
                      checked={selectedArticles.has(article.id)}
                      onCheckedChange={(checked) => handleSelectArticle(article.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="max-w-2xl">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center group"
                      >
                        <span className="line-clamp-2">{article.title}</span>
                        <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      </a>
                      {article.contentSnippet && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {article.contentSnippet}
                        </p>
                      )}
                      {article.author && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          作者: {article.author}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {article.feed.imageUrl ? (
                        <img
                          src={article.feed.imageUrl}
                          alt=""
                          className="h-6 w-6 rounded"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <Rss className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 dark:text-white truncate">
                          {article.feed.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {article.feed.user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center" title="阅读数">
                        <Eye className="mr-1 h-4 w-4" />
                        {article._count.readBy}
                      </div>
                      <div className="flex items-center" title="稍后读">
                        <Bookmark className="mr-1 h-4 w-4" />
                        {article._count.readLaterBy}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(article.pubDate)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <Button
                      onClick={() => handleDeleteArticle(article.id, article.title)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
