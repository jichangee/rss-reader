"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface AddFeedModalProps {
  open?: boolean
  onClose: () => void
  onAddSingle: (url: string, enableTranslation: boolean) => Promise<{ success: boolean; error?: string }>
  onAddBatch: (urls: string[], enableTranslation: boolean) => Promise<{
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

export default function AddFeedModal({ open = true, onClose, onAddSingle, onAddBatch }: AddFeedModalProps) {
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
      // 如果只有一个链接，使用单个添加API
      if (validUrls.length === 1) {
        const result = await onAddSingle(validUrls[0], enableTranslation)
        if (result.success) {
          onClose()
        } else {
          setError(result.error || "添加失败")
        }
      } else {
        // 多个链接，使用批量添加API
        const result = await onAddBatch(validUrls, enableTranslation)
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
      }
    } catch (err) {
      setError("添加失败，请重试")
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

  const validUrlsCount = urls.filter((u) => u.trim() !== "").length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !loading) {
        handleClose()
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加 RSS 订阅</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

            </div>
          ) : (
            <form id="add-feed-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="rss-urls"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  RSS 链接
                </label>
                <div className="space-y-2">
                  {urls.map((url, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://example.com/feed.xml"
                        disabled={loading}
                        className="flex-1"
                      />
                      {urls.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => handleRemoveUrl(index)}
                          variant="ghost"
                          size="icon-sm"
                          disabled={loading}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={handleAddUrl}
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  className="mt-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Plus className="h-4 w-4" />
                  <span>添加更多链接</span>
                </Button>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={enableTranslation}
                    onCheckedChange={(checked) => setEnableTranslation(checked === true)}
                    disabled={loading}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    启用翻译
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  启用后，订阅的文章标题和内容将自动翻译为你设置的目标语言
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  常见 RSS 示例：
                </h3>
                <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <li>• https://hnrss.org/frontpage (Hacker News)</li>
                  <li>• https://www.reddit.com/r/programming/.rss</li>
                  <li>• https://feeds.bbci.co.uk/news/rss.xml (BBC News)</li>
                </ul>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {results ? (
          <DialogFooter>
            <Button
              onClick={handleClose}
              className="w-full"
            >
              完成
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="add-feed-form"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                validUrlsCount > 0 
                  ? `添加订阅${validUrlsCount > 1 ? ` (${validUrlsCount})` : ""}`
                  : "添加订阅"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
