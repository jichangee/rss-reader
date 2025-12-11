"use client"

import { useEffect, useState } from "react"
import { Loader2, Shield, User, CheckCircle2, XCircle, Database, Clock } from "lucide-react"
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

interface SettingsData {
  stats: {
    totalUsers: number
    totalFeeds: number
    totalArticles: number
  }
  admins: Array<{
    id: string
    name: string | null
    email: string
    image: string | null
    createdAt: string
  }>
  recentLogs: Array<{
    id: string
    action: string
    targetType: string | null
    targetId: string | null
    details: string | null
    ipAddress: string | null
    createdAt: string
    admin: {
      name: string | null
      email: string
    }
  }>
  env: {
    nodeEnv: string
    hasAdminEmails: boolean
    hasCronSecret: boolean
    hasGoogleTranslateKey: boolean
  }
}

interface LogData {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  admin: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [logs, setLogs] = useState<LogData[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState("all")
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)

  useEffect(() => {
    loadSettings()
    loadLogs()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [logsPage, actionFilter])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (error) {
      console.error("加载系统设置失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    try {
      setLogsLoading(true)
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: "20",
        action: actionFilter
      })
      
      const res = await fetch(`/api/admin/logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setLogsTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("加载操作日志失败:", error)
    } finally {
      setLogsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      view_dashboard: "查看仪表板",
      view_users: "查看用户列表",
      view_user_detail: "查看用户详情",
      update_user: "更新用户",
      delete_user: "删除用户",
      view_feeds: "查看订阅源",
      view_feed_detail: "查看订阅源详情",
      delete_feed: "删除订阅源",
      refresh_feeds: "刷新订阅源",
      view_articles: "查看文章",
      delete_article: "删除文章",
      delete_articles_batch: "批量删除文章",
      view_settings: "查看系统设置"
    }
    return labels[action] || action
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">加载失败</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 系统统计 */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                总用户数
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                {settings.stats.totalUsers}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
              <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                总订阅源
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                {settings.stats.totalFeeds}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900">
              <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                总文章数
              </p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                {settings.stats.totalArticles.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
              <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 环境变量状态 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          环境配置
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">运行环境</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white uppercase">
              {settings.env.nodeEnv}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">管理员邮箱配置</span>
            {settings.env.hasAdminEmails ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Cron Secret</span>
            {settings.env.hasCronSecret ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">翻译 API Key</span>
            {settings.env.hasGoogleTranslateKey ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* 管理员列表 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          管理员列表
        </h3>
        <div className="space-y-3">
          {settings.admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center space-x-3">
                {admin.image ? (
                  <img
                    src={admin.image}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {admin.name || "未命名"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {admin.email}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(admin.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 操作日志 */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              操作日志
            </h3>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="筛选操作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                <SelectItem value="view_dashboard">查看仪表板</SelectItem>
                <SelectItem value="view_users">查看用户</SelectItem>
                <SelectItem value="delete_user">删除用户</SelectItem>
                <SelectItem value="delete_feed">删除订阅源</SelectItem>
                <SelectItem value="delete_article">删除文章</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {logsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    时间
                  </TableHead>
                  <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    管理员
                  </TableHead>
                  <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    操作
                  </TableHead>
                  <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    目标
                  </TableHead>
                  <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider">
                    IP地址
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4" />
                        {formatDate(log.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {log.admin.image ? (
                          <img
                            src={log.admin.image}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <Shield className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </div>
                        )}
                        <div className="text-sm text-gray-900 dark:text-white">
                          {log.admin.name || log.admin.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                        {getActionLabel(log.action)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {log.targetType || "-"}
                      {log.targetId && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({log.targetId.slice(0, 8)}...)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分页 */}
            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    第 <span className="font-medium">{logsPage}</span> 页，共{" "}
                    <span className="font-medium">{logsTotalPages}</span> 页
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                    <Button
                      onClick={() => setLogsPage(logsPage - 1)}
                      disabled={logsPage === 1}
                      variant="outline"
                      size="sm"
                      className="rounded-l-md rounded-r-none"
                    >
                      上一页
                    </Button>
                    <Button
                      onClick={() => setLogsPage(logsPage + 1)}
                      disabled={logsPage === logsTotalPages}
                      variant="outline"
                      size="sm"
                      className="rounded-r-md rounded-l-none"
                    >
                      下一页
                    </Button>
                  </nav>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
