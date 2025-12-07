"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Loader2, X, Save } from "lucide-react"

interface Webhook {
  id: string
  name: string
  url: string
  method: string
  customFields: string | null
  remote: boolean
  enabled: boolean
  feedCount: number
  feeds: Array<{ id: string; title: string }>
  createdAt: string
  updatedAt: string
}

interface WebhookManagerProps {
  onWebhookChange?: () => void
}

// Webhook 可发送的字段选项
const WEBHOOK_FIELD_OPTIONS = [
  { value: 'link', label: '文章链接' },
  { value: 'title', label: '文章标题' },
  { value: 'content', label: '文章内容' },
  { value: 'contentSnippet', label: '文章摘要' },
  { value: 'guid', label: '文章 GUID' },
  { value: 'author', label: '作者' },
  { value: 'pubDate', label: '发布日期' },
  { value: 'articleId', label: '文章 ID' },
  { value: 'feedUrl', label: '订阅源 URL' },
  { value: 'feedTitle', label: '订阅源标题' },
  { value: 'feedDescription', label: '订阅源描述' },
]

interface CustomFieldMapping {
  name: string
  value: string
}

export default function WebhookManager({ onWebhookChange }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // 表单状态
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [method, setMethod] = useState<"GET" | "POST">("POST")
  const [customFields, setCustomFields] = useState<CustomFieldMapping[]>([])
  const [remote, setRemote] = useState(true)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    loadWebhooks()
  }, [])

  const loadWebhooks = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/webhooks")
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data)
      } else {
        setError("加载 Webhook 列表失败")
      }
    } catch (error) {
      console.error("加载 Webhook 列表失败:", error)
      setError("加载 Webhook 列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingWebhook(null)
    setName("")
    setUrl("")
    setMethod("POST")
    setCustomFields([{ name: 'url', value: '{link}' }])
    setRemote(true)
    setEnabled(true)
    setError("")
  }

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setIsCreating(false)
    setName(webhook.name)
    setUrl(webhook.url)
    setMethod(webhook.method as "GET" | "POST")
    setRemote(webhook.remote)
    setEnabled(webhook.enabled)
    setError("")

    // 解析自定义字段
    if (webhook.customFields) {
      try {
        const parsed = JSON.parse(webhook.customFields)
        if (Array.isArray(parsed)) {
          setCustomFields(parsed.map((item: any) => ({
            name: item.name || '',
            value: item.value || ''
          })))
        } else {
          setCustomFields([{ name: 'url', value: '{link}' }])
        }
      } catch {
        setCustomFields([{ name: 'url', value: '{link}' }])
      }
    } else {
      setCustomFields([{ name: 'url', value: '{link}' }])
    }
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingWebhook(null)
    setName("")
    setUrl("")
    setMethod("POST")
    setCustomFields([{ name: 'url', value: '{link}' }])
    setRemote(true)
    setEnabled(true)
    setError("")
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Webhook 名称不能为空")
      return
    }

    if (!url.trim()) {
      setError("Webhook URL 不能为空")
      return
    }

    try {
      new URL(url)
    } catch {
      setError("Webhook URL 格式无效")
      return
    }

    setSaving(true)
    setError("")

    try {
      const customFieldsJson = customFields.length > 0
        ? JSON.stringify(customFields.filter(f => f.name.trim() && f.value.trim()))
        : JSON.stringify([{ name: 'url', value: '{link}' }])

      if (isCreating) {
        // 创建
        const res = await fetch("/api/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            url: url.trim(),
            method,
            customFields: customFieldsJson,
            remote,
            enabled,
          }),
        })

        if (res.ok) {
          await loadWebhooks()
          handleCancel()
          onWebhookChange?.()
        } else {
          const error = await res.json()
          setError(error.error || "创建失败")
        }
      } else if (editingWebhook) {
        // 更新
        const res = await fetch(`/api/webhooks/${editingWebhook.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            url: url.trim(),
            method,
            customFields: customFieldsJson,
            remote,
            enabled,
          }),
        })

        if (res.ok) {
          await loadWebhooks()
          handleCancel()
          onWebhookChange?.()
        } else {
          const error = await res.json()
          setError(error.error || "更新失败")
        }
      }
    } catch (error) {
      console.error("保存失败:", error)
      setError("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm("确定要删除这个 Webhook 吗？")) {
      return
    }

    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        await loadWebhooks()
        onWebhookChange?.()
      } else {
        const error = await res.json()
        alert(error.error || "删除失败")
      }
    } catch (error) {
      console.error("删除失败:", error)
      alert("删除失败，请重试")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Webhook 管理
        </h2>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          <span>新建 Webhook</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Webhook 列表 */}
      {webhooks.length === 0 && !isCreating && !editingWebhook ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">还没有创建任何 Webhook</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {webhook.name}
                    </h3>
                    {!webhook.enabled && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        已禁用
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {webhook.url}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    {webhook.method} · {webhook.remote ? "服务器端" : "客户端"} · 关联 {webhook.feedCount} 个订阅
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                    title="编辑"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑表单 */}
      {(isCreating || editingWebhook) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isCreating ? "新建 Webhook" : "编辑 Webhook"}
            </h3>
            <button
              onClick={handleCancel}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Webhook 名称 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 推送到 Notion"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Webhook URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  请求方式
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  disabled={saving}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                自定义字段映射
              </label>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                可使用变量: {WEBHOOK_FIELD_OPTIONS.map(opt => `{${opt.value}}`).join(', ')}
              </p>
              <div className="space-y-2">
                {customFields.map((field, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => {
                        const newFields = [...customFields]
                        newFields[index].name = e.target.value
                        setCustomFields(newFields)
                      }}
                      placeholder="参数名"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      disabled={saving}
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => {
                        const newFields = [...customFields]
                        newFields[index].value = e.target.value
                        setCustomFields(newFields)
                      }}
                      placeholder="例如: {link}"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomFields(customFields.filter((_, i) => i !== index))
                      }}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                      disabled={saving || customFields.length === 1}
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCustomFields([...customFields, { name: '', value: '{link}' }])
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={saving}
                >
                  + 添加字段
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remote"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={saving}
              />
              <label htmlFor="remote" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                远程发起（服务器端）
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={saving}
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                启用
              </label>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>保存</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

