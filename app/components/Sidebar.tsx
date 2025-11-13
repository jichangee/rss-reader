"use client"

import { signOut, useSession } from "next-auth/react"
import { Plus, RefreshCw, LogOut, Rss, Trash2, Filter } from "lucide-react"

interface SidebarProps {
  feeds: any[]
  selectedFeed: string | null
  onSelectFeed: (feedId: string | null) => void
  onAddFeed: () => void
  onDeleteFeed: (feedId: string) => void
  onRefresh: () => void
  unreadOnly: boolean
  onToggleUnreadOnly: () => void
}

export default function Sidebar({
  feeds,
  selectedFeed,
  onSelectFeed,
  onAddFeed,
  onDeleteFeed,
  onRefresh,
  unreadOnly,
  onToggleUnreadOnly,
}: SidebarProps) {
  const { data: session } = useSession()

  return (
    <div className="flex w-80 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* 头部 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
              <Rss className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white">
                RSS 阅读器
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {session?.user?.name || session?.user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAddFeed}
            className="flex items-center justify-center space-x-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>添加订阅</span>
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center justify-center space-x-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>刷新</span>
          </button>
        </div>
        <button
          onClick={onToggleUnreadOnly}
          className={`mt-2 flex w-full items-center justify-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            unreadOnly
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>{unreadOnly ? "显示全部" : "仅未读"}</span>
        </button>
      </div>

      {/* 订阅列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          <button
            onClick={() => onSelectFeed(null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedFeed === null
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <span className="font-medium">全部文章</span>
            <span className="text-xs">
              {feeds.reduce((sum, feed) => sum + (feed.articles?.length || 0), 0)}
            </span>
          </button>

          {feeds.length > 0 ? (
            <div className="mt-4">
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                我的订阅
              </h2>
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`group flex items-center rounded-lg transition-colors ${
                    selectedFeed === feed.id
                      ? "bg-indigo-100 dark:bg-indigo-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <button
                    onClick={() => onSelectFeed(feed.id)}
                    className="flex flex-1 items-center justify-between px-3 py-2 text-left"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      {feed.imageUrl ? (
                        <img
                          src={feed.imageUrl}
                          alt=""
                          className="h-5 w-5 rounded"
                        />
                      ) : (
                        <Rss className="h-5 w-5 text-gray-400" />
                      )}
                      <span
                        className={`truncate text-sm ${
                          selectedFeed === feed.id
                            ? "font-medium text-indigo-700 dark:text-indigo-300"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {feed.title}
                      </span>
                    </div>
                    <span className="ml-2 text-xs text-gray-500">
                      {feed.articles?.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteFeed(feed.id)}
                    className="mr-2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>还没有订阅</p>
              <p className="mt-1">点击"添加订阅"开始</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部 */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )
}

