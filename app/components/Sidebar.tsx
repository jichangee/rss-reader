"use client"

import { signOut, useSession } from "next-auth/react"
import { Plus, LogOut, Rss, Trash2, Filter, X, Settings, Edit2, Layers, Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface SidebarProps {
  feeds: any[]
  selectedFeed: string | null
  onSelectFeed: (feedId: string | null) => void
  onAddFeed: () => void
  onBatchAddFeed: () => void
  onEditFeed: (feed: any) => void
  onDeleteFeed: (feedId: string) => void
  unreadOnly: boolean
  onToggleUnreadOnly: () => void
  isOpen: boolean
  onClose: () => void
  loading?: boolean
}

export default function Sidebar({
  feeds,
  selectedFeed,
  onSelectFeed,
  onAddFeed,
  onBatchAddFeed,
  onEditFeed,
  onDeleteFeed,
  unreadOnly,
  onToggleUnreadOnly,
  isOpen,
  onClose,
  loading = false,
}: SidebarProps) {
  const { data: session } = useSession()
  const router = useRouter()

  // 防止移动端侧边栏打开时背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const handleFeedSelect = (feedId: string | null) => {
    onSelectFeed(feedId)
    // 在移动端选择订阅后关闭侧边栏
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  return (
    <>
      {/* 移动端遮罩层 */}
      <div
        className={`fixed inset-0 z-30 bg-black transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-50" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* 头部 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 flex-shrink-0">
              <Rss className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-gray-900 dark:text-white">
                RSS 阅读器
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {session?.user?.name || session?.user?.email}
              </p>
            </div>
          </div>
          {/* 移动端关闭按钮 */}
          <button
            onClick={onClose}
            className="ml-2 md:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
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
            onClick={onBatchAddFeed}
            className="flex items-center justify-center space-x-1 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <Layers className="h-4 w-4" />
            <span>批量添加</span>
          </button>
        </div>
        <button
          onClick={onToggleUnreadOnly}
          className={`flex w-full items-center justify-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-2 ${
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
            onClick={() => handleFeedSelect(null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedFeed === null
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <span className="font-medium">全部文章</span>
            <span className="text-xs">
              {loading ? "-" : feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)}
            </span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : feeds.length > 0 ? (
            <div className="mt-4">
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                我的订阅
              </h2>
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`group relative flex items-center rounded-lg transition-colors ${
                    selectedFeed === feed.id
                      ? "bg-indigo-100 dark:bg-indigo-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <button
                    onClick={() => handleFeedSelect(feed.id)}
                    className="flex flex-1 items-center justify-between px-3 py-2 text-left min-w-0"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden pr-12">
                      {feed.imageUrl ? (
                        <img
                          src={feed.imageUrl}
                          alt=""
                          className="h-5 w-5 rounded flex-shrink-0"
                        />
                      ) : (
                        <Rss className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span
                        className={`truncate text-sm min-w-0 ${
                          selectedFeed === feed.id
                            ? "font-medium text-indigo-700 dark:text-indigo-300"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {feed.title}
                      </span>
                    </div>
                    <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                      {feed.unreadCount || 0}
                    </span>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto bg-white/90 dark:bg-gray-800/90 rounded backdrop-blur-sm px-1 py-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditFeed(feed)
                      }}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-indigo-600 dark:hover:bg-gray-600"
                      title="编辑订阅"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFeed(feed.id)
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      title="删除订阅"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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
      <div className="border-t border-gray-200 p-4 dark:border-gray-700 space-y-2">
        <button
          onClick={() => router.push("/settings")}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span>设置</span>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </button>
      </div>
      </div>
    </>
  )
}

