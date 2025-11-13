"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"

interface AddFeedModalProps {
  onClose: () => void
  onAdd: (url: string) => Promise<{ success: boolean; error?: string }>
}

export default function AddFeedModal({ onClose, onAdd }: AddFeedModalProps) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!url.trim()) {
      setError("请输入RSS链接")
      return
    }

    setLoading(true)
    try {
      const result = await onAdd(url.trim())
      if (result.success) {
        onClose()
      } else {
        setError(result.error || "添加失败")
      }
    } catch (err) {
      setError("添加失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            添加 RSS 订阅
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="rss-url"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              RSS 链接
            </label>
            <input
              id="rss-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              常见 RSS 示例：
            </h3>
            <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <li>• https://hnrss.org/frontpage (Hacker News)</li>
              <li>• https://www.reddit.com/r/programming/.rss</li>
              <li>• https://feeds.bbci.co.uk/news/rss.xml (BBC News)</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                "添加订阅"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

