"use client"

import { useState } from "react"
import { X, Loader2, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react"

interface BatchAddFeedModalProps {
  onClose: () => void
  onAdd: (urls: string[], enableTranslation: boolean) => Promise<{
    success: boolean
    results?: any[]
    errors?: any[]
    summary?: { total: number; success: number; failed: number }
    error?: string
  }>
}

interface FeedResult {
  url: string
  success: boolean
  feed?: any
  error?: string
}

export default function BatchAddFeedModal({ onClose, onAdd }: BatchAddFeedModalProps) {
  const [urls, setUrls] = useState<string[]>([""])
  const [enableTranslation, setEnableTranslation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<FeedResult[] | null>(null)
  const [error, setError] = useState("")

  const handleAddUrl = () => {
    setUrls([...urls, ""])
  }

  const handleRemoveUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index))
    }
  }

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls]
    newUrls[index] = value
    setUrls(newUrls)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setResults(null)

    // 过滤空URL
    const validUrls = urls.filter((url) => url.trim() !== "")

    if (validUrls.length === 0) {
      setError("请至少输入一个RSS链接")
      return
    }

    setLoading(true)
    try {
      const result = await onAdd(validUrls, enableTranslation)
      if (result.success && result.results && result.errors) {
        // 合并结果和错误
        const allResults: FeedResult[] = []
        
        // 添加成功的结果
        result.results.forEach((r: any) => {
          allResults.push({
            url: r.url,
            success: true,
            feed: r.feed,
          })
        })
        
        // 添加失败的结果
        result.errors.forEach((e: any) => {
          allResults.push({
            url: e.url,
            success: false,
            error: e.error,
          })
        })

        setResults(allResults)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError("批量添加失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setUrls([""])
      setResults(null)
      setError("")
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-lg bg-white shadow-xl dark:bg-gray-800 flex flex-col">
        <div className="flex-shrink-0 mb-4 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            批量添加 RSS 订阅
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {results ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  添加结果
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">总计:</span>
                    <span className="font-medium">{results.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                    <span>成功:</span>
                    <span className="font-medium">
                      {results.filter((r) => r.success).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                    <span>失败:</span>
                    <span className="font-medium">
                      {results.filter((r) => !r.success).length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-2 rounded-lg p-3 ${
                      result.success
                        ? "bg-green-50 dark:bg-green-900/20"
                        : "bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {result.success
                          ? result.feed?.title || result.url
                          : result.url}
                      </p>
                      {result.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {result.error}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {result.url}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  完成
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="rss-urls"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  RSS 链接列表（每行一个）
                </label>
                <div className="space-y-2">
                  {urls.map((url, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://example.com/feed.xml"
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        disabled={loading}
                      />
                      {urls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUrl(index)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="mt-2 flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                  <span>添加更多链接</span>
                </button>
                {error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
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
                    启用翻译（应用到所有订阅）
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  启用后，所有订阅的文章标题和内容将自动翻译为你设置的目标语言
                </p>
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
                  onClick={handleClose}
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
                    `批量添加 (${urls.filter((u) => u.trim() !== "").length})`
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

