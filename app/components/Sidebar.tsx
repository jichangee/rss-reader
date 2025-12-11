"use client"

import { signOut, useSession } from "next-auth/react"
import { Plus, LogOut, Rss, Trash2, Filter, X, Settings, Edit2, Loader2, Bookmark, TrendingUp } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer"

interface SidebarProps {
  feeds: any[]
  selectedFeed: string | null
  isReadLaterView: boolean
  isSquareView: boolean
  readLaterCount: number
  showSquare: boolean
  onSelectFeed: (feedId: string | null) => void
  onSelectReadLater: () => void
  onSelectSquare: () => void
  onAddFeed: () => void
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
  isReadLaterView,
  isSquareView,
  readLaterCount,
  showSquare,
  onSelectFeed,
  onSelectReadLater,
  onSelectSquare,
  onAddFeed,
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
  const [feedIconErrors, setFeedIconErrors] = useState<Record<string, boolean>>({})

  const handleFeedSelect = (feedId: string | null) => {
    onSelectFeed(feedId)
    // 在移动端选择订阅后关闭侧边栏
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  // 侧边栏内容组件
  const SidebarContent = ({ showCloseButton = false }: { showCloseButton?: boolean }) => (
    <>
      {/* 头部 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden flex-shrink-0">
              <img src="/logo.jpg" alt="RSS Reader Logo" className="h-full w-full object-cover" />
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
          {showCloseButton && (
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Button
          onClick={onAddFeed}
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span>添加订阅</span>
        </Button>
        <Button
          onClick={onToggleUnreadOnly}
          variant={unreadOnly ? "secondary" : "outline"}
          className="w-full mt-2"
          size="sm"
        >
          <Filter className="h-4 w-4" />
          <span>{unreadOnly ? "显示全部" : "仅未读"}</span>
        </Button>
      </div>

      {/* 订阅列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          <Button
            onClick={() => handleFeedSelect(null)}
            variant={selectedFeed === null && !isReadLaterView && !isSquareView ? "secondary" : "ghost"}
            className={`w-full justify-between ${
              selectedFeed === null && !isReadLaterView && !isSquareView
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : ""
            }`}
            size="sm"
          >
            <span className="font-medium">全部文章</span>
            <span className="text-xs">
              {(loading && feeds.length === 0) ? "-" : feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)}
            </span>
          </Button>

          {/* 稍后读入口 */}
          <Button
            onClick={() => {
              onSelectReadLater()
              if (window.innerWidth < 768) {
                onClose()
              }
            }}
            variant={isReadLaterView ? "secondary" : "ghost"}
            className={`w-full justify-between ${
              isReadLaterView
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                : ""
            }`}
            size="sm"
          >
            <div className="flex items-center space-x-2">
              <Bookmark className={`h-4 w-4 ${isReadLaterView ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`} />
              <span className="font-medium">稍后读</span>
            </div>
            <span className="text-xs">
              {(loading && feeds.length === 0) ? "-" : readLaterCount}
            </span>
          </Button>

          {/* 广场入口 - 只在有数据时显示 */}
          {showSquare && (
            <Button
              onClick={() => {
                onSelectSquare()
                if (window.innerWidth < 768) {
                  onClose()
                }
              }}
              variant={isSquareView ? "secondary" : "ghost"}
              className={`w-full justify-between ${
                isSquareView
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                  : ""
              }`}
              size="sm"
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className={`h-4 w-4 ${isSquareView ? "text-orange-600 dark:text-orange-400" : "text-gray-400"}`} />
                <span className="font-medium">广场</span>
              </div>
              <span className="text-xs">🔥</span>
            </Button>
          )}

          {(loading && feeds.length === 0) ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-20 mb-4" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2 rounded-lg px-3 py-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-6" />
                </div>
              ))}
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
                    selectedFeed === feed.id && !isReadLaterView && !isSquareView
                      ? "bg-indigo-100 dark:bg-indigo-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Button
                    onClick={() => handleFeedSelect(feed.id)}
                    variant="ghost"
                    className="flex flex-1 items-center justify-between px-3 py-2 text-left min-w-0 h-auto"
                    size="sm"
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden pr-12">
                      {feed.imageUrl && !feedIconErrors[feed.id] ? (
                        <img
                          src={feed.imageUrl}
                          alt=""
                          className="h-5 w-5 rounded flex-shrink-0"
                          onError={() => setFeedIconErrors(prev => ({ ...prev, [feed.id]: true }))}
                        />
                      ) : (
                        <Rss className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span
                        className={`truncate text-sm min-w-0 ${
                          selectedFeed === feed.id && !isReadLaterView && !isSquareView
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
                  </Button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto bg-white/90 dark:bg-gray-800/90 rounded backdrop-blur-sm px-1 py-0.5">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditFeed(feed)
                      }}
                      variant="ghost"
                      size="icon-sm"
                      className="h-auto p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-gray-300"
                      title="编辑订阅"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFeed(feed.id)
                      }}
                      variant="ghost"
                      size="icon-sm"
                      className="h-auto p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      title="删除订阅"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>还没有订阅</p>
              <p className="mt-1">点击&quot;添加订阅&quot;开始</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部 */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-700 space-y-2">
        <Button
          onClick={() => router.push("/settings")}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Settings className="h-4 w-4" />
          <span>设置</span>
        </Button>
        <Button
          onClick={() => signOut({ callbackUrl: "/login" })}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* 桌面端侧边栏 */}
      <div className="hidden md:flex md:static inset-y-0 left-0 z-40 w-80 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <SidebarContent showCloseButton={false} />
      </div>

      {/* 移动端 Drawer */}
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} direction="left">
        <DrawerContent className="w-80 max-w-[85vw] h-full rounded-none border-r border-t-0 border-b-0 border-l-0 p-0">
          <div className="flex h-full flex-col">
            <SidebarContent showCloseButton={true} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

