"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  Loader2, 
  ArrowLeft, 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Rss, 
  Eye, 
  Bookmark, 
  Webhook,
  ExternalLink,
  FileText
} from "lucide-react"
import Link from "next/link"

interface UserDetail {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
  createdAt: string
  lastActiveAt: string | null
  feeds: Array<{
    id: string
    title: string
    url: string
    createdAt: string
    _count: {
      articles: number
    }
  }>
  readArticles: Array<{
    id: string
    readAt: string
    article: {
      id: string
      title: string
      link: string
    }
  }>
  webhooks: Array<{
    id: string
    name: string
    url: string
    enabled: boolean
  }>
  _count: {
    feeds: number
    readArticles: number
    readLater: number
    webhooks: number
  }
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserDetail()
  }, [userId])

  const loadUserDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        const data = await res.json()
        setError(data.error || "加载用户详情失败")
      }
    } catch (error) {
      console.error("加载用户详情失败:", error)
      setError("加载用户详情失败")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || "用户不存在"}</p>
        <Link
          href="/admin/users"
          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          返回用户列表
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Link
        href="/admin/users"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回用户列表
      </Link>

      {/* 用户基本信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start space-x-6">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-20 w-20 rounded-full"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              <User className="h-10 w-10 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user.name || "未命名"}
              </h2>
              {user.role === "admin" ? (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                  <Shield className="mr-1 h-4 w-4" />
                  管理员
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  普通用户
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Mail className="mr-2 h-4 w-4" />
                {user.email}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="mr-2 h-4 w-4" />
                注册时间: {formatDate(user.createdAt)}
              </div>
              {user.lastActiveAt && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="mr-2 h-4 w-4" />
                  最后活跃: {formatDate(user.lastActiveAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
              <Rss className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                订阅源
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user._count.feeds}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
              <Eye className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                阅读数
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user._count.readArticles}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900">
              <Bookmark className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                稍后读
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user._count.readLater}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900">
              <Webhook className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Webhooks
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {user._count.webhooks}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 订阅源列表 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          订阅源列表 ({user.feeds.length})
        </h3>
        {user.feeds.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">该用户还没有订阅源</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                    订阅源
                  </th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                    文章数
                  </th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                    创建时间
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {user.feeds.map((feed) => (
                  <tr key={feed.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {feed.title}
                        </p>
                        <a
                          href={feed.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center"
                        >
                          {feed.url}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                      {feed._count.articles}
                    </td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(feed.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 最近阅读 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          最近阅读 (最近10条)
        </h3>
        {user.readArticles.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">该用户还没有阅读记录</p>
        ) : (
          <div className="space-y-3">
            {user.readArticles.map((read) => (
              <div
                key={read.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <a
                      href={read.article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {read.article.title}
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    阅读时间: {formatDate(read.readAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhooks */}
      {user.webhooks.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Webhooks ({user.webhooks.length})
          </h3>
          <div className="space-y-3">
            {user.webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Webhook className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {webhook.name}
                    </span>
                    {webhook.enabled ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        禁用
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {webhook.url}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

