"use client"

import { useEffect, useState } from "react"
import { 
  Users, 
  Rss, 
  FileText, 
  Eye, 
  Bookmark,
  Webhook,
  TrendingUp,
  Loader2
} from "lucide-react"

interface Stats {
  users: {
    total: number
    new: {
      today: number
      week: number
      month: number
    }
    active: {
      dau: number
      wau: number
      mau: number
    }
    growth: Array<{
      date: string
      count: number
    }>
  }
  content: {
    feeds: {
      total: number
      new: number
    }
    articles: {
      total: number
      new: number
    }
    topFeeds: Array<{
      id: string
      title: string
      url: string
      imageUrl?: string
      articleCount: number
      owner: {
        id: string
        name: string | null
        email: string
      }
    }>
  }
  activity: {
    reads: {
      total: number
      today: number
    }
    readLater: number
    webhooks: number
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("加载统计数据失败:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">加载失败</p>
      </div>
    )
  }

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color 
  }: { 
    title: string
    value: string | number
    change?: string
    icon: React.ComponentType<{ className?: string }>
    color: string
  }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {change && (
            <p className="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <TrendingUp className="mr-1 h-4 w-4" />
              {change}
            </p>
          )}
        </div>
        <div className={`rounded-full p-3 ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总用户数"
          value={stats.users.total}
          change={`今日新增 ${stats.users.new.today}`}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="日活跃用户"
          value={stats.users.active.dau}
          change={`周活跃 ${stats.users.active.wau}`}
          icon={Eye}
          color="bg-green-500"
        />
        <StatCard
          title="订阅源总数"
          value={stats.content.feeds.total}
          change={`今日新增 ${stats.content.feeds.new}`}
          icon={Rss}
          color="bg-purple-500"
        />
        <StatCard
          title="文章总数"
          value={stats.content.articles.total}
          change={`今日新增 ${stats.content.articles.new}`}
          icon={FileText}
          color="bg-orange-500"
        />
      </div>

      {/* 用户增长趋势 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          用户增长趋势（最近7天）
        </h3>
        <div className="space-y-3">
          {stats.users.growth.map((day, index) => {
            const maxCount = Math.max(...stats.users.growth.map(d => d.count))
            const percentage = maxCount > 0 ? (day.count / maxCount) * 100 : 0
            
            return (
              <div key={index} className="flex items-center space-x-4">
                <span className="w-24 text-sm text-gray-600 dark:text-gray-400">
                  {day.date}
                </span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-lg bg-indigo-500 transition-all duration-300 flex items-center justify-end pr-2"
                      style={{ width: `${percentage}%` }}
                    >
                      {day.count > 0 && (
                        <span className="text-xs font-medium text-white">
                          {day.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 活动统计 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
              <Eye className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                总阅读次数
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.activity.reads.total.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                今日: {stats.activity.reads.today}
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
                {stats.activity.readLater.toLocaleString()}
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
                Webhook 总数
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.activity.webhooks}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 热门订阅源 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          热门订阅源 Top 10
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  订阅源
                </th>
                <th className="pb-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  所有者
                </th>
                <th className="pb-3 text-right text-sm font-medium text-gray-600 dark:text-gray-400">
                  文章数
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.content.topFeeds.map((feed) => (
                <tr key={feed.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3">
                    <div className="flex items-center space-x-3">
                      {feed.imageUrl ? (
                        <img
                          src={feed.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <Rss className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {feed.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                          {feed.url}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {feed.owner.name || "未命名"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {feed.owner.email}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {feed.articleCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
