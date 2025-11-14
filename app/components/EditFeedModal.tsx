"use client"

import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"

interface Feed {
  id: string
  title: string
  url: string
  enableTranslation?: boolean
}

interface EditFeedModalProps {
  feed: Feed
  onClose: () => void
  onUpdate: (feedId: string, enableTranslation: boolean) => Promise<{ success: boolean; error?: string }>
}

export default function EditFeedModal({ feed, onClose, onUpdate }: EditFeedModalProps) {
  const [enableTranslation, setEnableTranslation] = useState(Boolean(feed?.enableTranslation ?? false))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setEnableTranslation(Boolean(feed?.enableTranslation ?? false))
  }, [feed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    setLoading(true)
    try {
      const result = await onUpdate(feed.id, enableTranslation)
      if (result.success) {
        onClose()
      } else {
        setError(result.error || "更新失败")
      }
    } catch (err) {
      setError("更新失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            编辑订阅
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
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              订阅名称
            </label>
            <input
              type="text"
              value={feed?.title ?? ""}
              disabled
              className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              RSS 链接
            </label>
            <input
              type="url"
              value={feed?.url ?? ""}
              disabled
              className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enableTranslation}
                onChange={(e) => setEnableTranslation(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                启用翻译
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              启用后，此订阅的文章标题和内容将自动翻译为你设置的目标语言
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

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
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

