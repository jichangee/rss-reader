"use client"

import { useState, useEffect } from "react"
import { Loader2, XCircle, AlertCircle } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Webhook {
  id: string
  name: string
  url: string
  method: string
  enabled: boolean
}

interface Feed {
  id: string
  title: string
  url: string
  enableTranslation?: boolean
  webhooks?: Webhook[]
}

interface EditFeedModalProps {
  feed: Feed
  onClose: () => void
  onUpdate: (feedId: string, data: { 
    title?: string
    url?: string
    enableTranslation?: boolean
  }) => Promise<{ success: boolean; error?: string }>
}

export default function EditFeedModal({ feed, onClose, onUpdate }: EditFeedModalProps) {
  const [title, setTitle] = useState(feed?.title ?? "")
  const [url, setUrl] = useState(feed?.url ?? "")
  const [enableTranslation, setEnableTranslation] = useState(Boolean(feed?.enableTranslation ?? false))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Webhook 相关状态
  const [allWebhooks, setAllWebhooks] = useState<Webhook[]>([])
  const [selectedWebhookIds, setSelectedWebhookIds] = useState<string[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)

  useEffect(() => {
    setTitle(feed?.title ?? "")
    setUrl(feed?.url ?? "")
    setEnableTranslation(Boolean(feed?.enableTranslation ?? false))
    
    // 加载当前Feed关联的webhooks
    if (feed?.webhooks) {
      setSelectedWebhookIds(feed.webhooks.map(wh => wh.id))
    }
    
    // 加载所有可用的webhooks
    loadAllWebhooks()
  }, [feed])

  const loadAllWebhooks = async () => {
    try {
      setLoadingWebhooks(true)
      const res = await fetch("/api/webhooks")
      if (res.ok) {
        const data = await res.json()
        setAllWebhooks(data)
      }
    } catch (error) {
      console.error("加载 Webhook 列表失败:", error)
    } finally {
      setLoadingWebhooks(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // 验证输入
    if (!title.trim()) {
      setError("订阅名称不能为空")
      return
    }

    if (!url.trim()) {
      setError("RSS链接不能为空")
      return
    }

    setLoading(true)
    try {
      // 更新Feed基本信息
      const result = await onUpdate(feed.id, {
        title: title.trim(),
        url: url.trim(),
        enableTranslation,
      })
      
      if (result.success) {
        // 更新Webhook关联
        await updateWebhookAssociations()
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

  const updateWebhookAssociations = async () => {
    // 获取当前Feed关联的webhooks
    const currentRes = await fetch(`/api/feeds/${feed.id}/webhooks`)
    if (!currentRes.ok) return
    
    const currentWebhooks = await currentRes.json()
    const currentWebhookIds = currentWebhooks.map((wh: Webhook) => wh.id)
    
    // 计算需要添加和删除的webhooks
    const toAdd = selectedWebhookIds.filter(id => !currentWebhookIds.includes(id))
    const toRemove = currentWebhookIds.filter((id: string) => !selectedWebhookIds.includes(id))
    
    // 添加新的关联
    for (const webhookId of toAdd) {
      await fetch(`/api/feeds/${feed.id}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId }),
      })
    }
    
    // 删除旧的关联
    for (const webhookId of toRemove) {
      await fetch(`/api/feeds/${feed.id}/webhooks?webhookId=${webhookId}`, {
        method: "DELETE",
      })
    }
  }

  const handleWebhookToggle = (webhookId: string) => {
    if (selectedWebhookIds.includes(webhookId)) {
      setSelectedWebhookIds(selectedWebhookIds.filter(id => id !== webhookId))
    } else {
      setSelectedWebhookIds([...selectedWebhookIds, webhookId])
    }
  }

  const selectedWebhooks = allWebhooks.filter(wh => selectedWebhookIds.includes(wh.id))

  return (
    <Dialog open={true} onOpenChange={(open) => {
      if (!open && !loading) {
        onClose()
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑订阅</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                订阅名称
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入订阅名称"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                RSS 链接
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                修改RSS链接将验证新链接的有效性
              </p>
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
                启用后，此订阅的文章标题和内容将自动翻译为你设置的目标语言
              </p>
            </div>

            {/* Webhook 选择 */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Webhook 推送配置
              </h3>
              
              {loadingWebhooks ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : allWebhooks.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    还没有创建任何 Webhook
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    请在设置页面创建 Webhook
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allWebhooks.map((webhook) => (
                    <label
                      key={webhook.id}
                      className="flex items-center space-x-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedWebhookIds.includes(webhook.id)}
                        onCheckedChange={() => handleWebhookToggle(webhook.id)}
                        disabled={loading || !webhook.enabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {webhook.name}
                          </span>
                          {!webhook.enabled && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-400">
                              已禁用
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {webhook.url} · {webhook.method}
                        </p>
                      </div>
                    </label>
                  ))}
                  
                  {selectedWebhooks.length > 0 && (
                    <div className="mt-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                      <p className="text-xs font-medium text-indigo-900 dark:text-indigo-300">
                        已选择 {selectedWebhooks.length} 个 Webhook
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedWebhooks.map((webhook) => (
                          <span
                            key={webhook.id}
                            className="inline-flex items-center space-x-1 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                          >
                            <span>{webhook.name}</span>
                            <Button
                              type="button"
                              onClick={() => handleWebhookToggle(webhook.id)}
                              variant="ghost"
                              size="icon-sm"
                              className="h-auto p-0 hover:text-indigo-600"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                选择要关联到此订阅的 Webhook。文章推送时会触发所有关联的 Webhook。
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
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
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
