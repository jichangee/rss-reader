"use client"

import { useState, useEffect } from "react"
import { X, Play, Trash2, Clock, Loader2, Music } from "lucide-react"
import YouTubeAudioPlayer from "./YouTubeAudioPlayer"

interface PlaylistItem {
  id: string
  videoId: string
  videoUrl: string
  title?: string
  thumbnail?: string
  duration: number
  currentTime: number
  lastPlayedAt: string
}

interface PlaylistDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function PlaylistDrawer({ isOpen, onClose }: PlaylistDrawerProps) {
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<PlaylistItem | null>(null)

  // 加载播放列表
  const loadPlaylist = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/playlist")
      if (response.ok) {
        const data = await response.json()
        setPlaylistItems(data.playlistItems || [])
      }
    } catch (err) {
      console.error("加载播放列表失败:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadPlaylist()
    }
  }, [isOpen])

  // 删除播放列表项
  const handleDelete = async (videoId: string) => {
    try {
      const response = await fetch(`/api/playlist?videoId=${videoId}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        setPlaylistItems(items => items.filter(item => item.videoId !== videoId))
        if (selectedItem?.videoId === videoId) {
          setSelectedItem(null)
        }
      }
    } catch (err) {
      console.error("删除失败:", err)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // 计算进度百分比
  const getProgress = (item: PlaylistItem): number => {
    if (item.duration === 0) return 0
    return (item.currentTime / item.duration) * 100
  }

  // 格式化时间差
  const formatRelativeTime = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "刚刚"
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString("zh-CN")
  }

  // 按ESC键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // 防止背景滚动
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

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ${
          isOpen ? "opacity-50" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full sm:w-2/3 lg:w-1/2 xl:w-2/5 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <Music className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  播放列表
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {playlistItems.length} 个视频
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
              title="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : playlistItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <Music className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">播放列表为空</p>
                <p className="mt-2 text-sm">播放的YouTube音频会自动添加到这里</p>
              </div>
            ) : (
              <div className="space-y-4">
                {playlistItems.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start space-x-3">
                      {/* 缩略图 */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={item.thumbnail || `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                          alt=""
                          className="w-32 h-18 object-cover rounded"
                        />
                        {/* 进度条 */}
                        {item.currentTime > 0 && item.duration > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600">
                            <div
                              className="h-full bg-indigo-600 transition-all"
                              style={{ width: `${getProgress(item)}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                          {item.title || "YouTube视频"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.duration > 0 && (
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {item.currentTime > 0
                                ? `${formatTime(item.currentTime)} / ${formatTime(item.duration)}`
                                : formatTime(item.duration)}
                            </span>
                          )}
                          <span>{formatRelativeTime(item.lastPlayedAt)}</span>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="flex items-center space-x-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                          >
                            <Play className="h-3 w-3" />
                            <span>{item.currentTime > 0 ? "继续播放" : "播放"}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item.videoId)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 展开的播放器 */}
                    {selectedItem?.id === item.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <YouTubeAudioPlayer 
                          videoUrl={item.videoUrl}
                          initialTime={item.currentTime}
                          shouldAutoPlay={true}
                        />
                        <button
                          onClick={() => setSelectedItem(null)}
                          className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          收起播放器
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

