"use client"

import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"

interface Feed {
  id: string
  title: string
  url: string
  enableTranslation?: boolean
  webhookUrl?: string | null
  webhookMethod?: string | null
  webhookField?: string | null
  webhookParamName?: string | null
  webhookCustomFields?: string | null
  webhookRemote?: boolean | null
}

interface EditFeedModalProps {
  feed: Feed
  onClose: () => void
  onUpdate: (feedId: string, data: { 
    title?: string
    url?: string
    enableTranslation?: boolean
    webhookUrl?: string | null
    webhookMethod?: string
    webhookField?: string
    webhookParamName?: string
    webhookCustomFields?: string | null
    webhookRemote?: boolean
  }) => Promise<{ success: boolean; error?: string }>
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
  name: string  // 参数名
  type: 'field' | 'custom' | 'fixed'  // 类型：预定义字段、自定义值（可含变量）、固定值
  value: string  // 值：字段名、自定义值（可含变量如 {link}）、固定值
}

export default function EditFeedModal({ feed, onClose, onUpdate }: EditFeedModalProps) {
  const [title, setTitle] = useState(feed?.title ?? "")
  const [url, setUrl] = useState(feed?.url ?? "")
  const [enableTranslation, setEnableTranslation] = useState(Boolean(feed?.enableTranslation ?? false))
  const [webhookUrl, setWebhookUrl] = useState(feed?.webhookUrl ?? "")
  const [webhookMethod, setWebhookMethod] = useState(feed?.webhookMethod ?? "POST")
  const [webhookField, setWebhookField] = useState(feed?.webhookField ?? "link")
  const [webhookParamName, setWebhookParamName] = useState(feed?.webhookParamName ?? "url")
  const [webhookRemote, setWebhookRemote] = useState(feed?.webhookRemote ?? true)
  const [useCustomFields, setUseCustomFields] = useState(true)  // 默认使用自定义字段
  const [customFields, setCustomFields] = useState<CustomFieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setTitle(feed?.title ?? "")
    setUrl(feed?.url ?? "")
    setEnableTranslation(Boolean(feed?.enableTranslation ?? false))
    setWebhookUrl(feed?.webhookUrl ?? "")
    setWebhookMethod(feed?.webhookMethod ?? "POST")
    setWebhookField(feed?.webhookField ?? "link")
    setWebhookParamName(feed?.webhookParamName ?? "url")
    setWebhookRemote(feed?.webhookRemote ?? true)
    
    // 解析自定义字段配置
    if (feed?.webhookCustomFields) {
      try {
        const parsed = JSON.parse(feed.webhookCustomFields)
        if (Array.isArray(parsed)) {
          // 检查是否为旧格式（只有 name 和 field）
          const fields: CustomFieldMapping[] = parsed.map((item: any) => {
            if (item.type) {
              // 新格式，直接使用
              return item
            } else {
              // 旧格式，转换为新格式
              return {
                name: item.name || '',
                type: 'field' as const,
                value: item.field || item.value || ''
              }
            }
          })
          setCustomFields(fields)
          setUseCustomFields(true)
        } else if (typeof parsed === 'object' && parsed !== null) {
          // 对象格式转换为数组格式
          const fields: CustomFieldMapping[] = Object.entries(parsed).map(([name, value]) => ({
            name,
            type: 'field' as const,
            value: value as string
          }))
          setCustomFields(fields)
          setUseCustomFields(true)
        } else {
          // 如果没有配置，默认添加一个字段
          setCustomFields([{ name: 'url', type: 'field', value: 'link' }])
          setUseCustomFields(true)
        }
      } catch {
        // 解析失败，使用默认值
        setCustomFields([{ name: 'url', type: 'field', value: 'link' }])
        setUseCustomFields(true)
      }
    } else {
      // 如果没有配置，默认添加一个字段
      setCustomFields([{ name: 'url', type: 'field', value: 'link' }])
      setUseCustomFields(true)
    }
  }, [feed])

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
      // 准备自定义字段配置
      let webhookCustomFields: string | null = null
      if (useCustomFields && customFields.length > 0) {
        // 验证自定义字段
        const validFields = customFields.filter(f => f.name.trim() && f.value.trim())
        if (validFields.length > 0) {
          webhookCustomFields = JSON.stringify(validFields)
        }
      }
      
      const result = await onUpdate(feed.id, {
        title: title.trim(),
        url: url.trim(),
        enableTranslation,
        webhookUrl: webhookUrl.trim() || null,
        webhookMethod,
        webhookField: useCustomFields ? undefined : webhookField,
        webhookParamName: useCustomFields ? undefined : (webhookParamName.trim() || 'url'),
        webhookCustomFields,
        webhookRemote,
      })
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入订阅名称"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              RSS 链接
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              修改RSS链接将验证新链接的有效性
            </p>
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

          {/* Webhook 配置 */}
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Webhook 推送配置
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  配置后，文章卡片会显示推送按钮。留空则禁用推送功能
                </p>
              </div>

              {webhookUrl && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                        请求方式
                      </label>
                      <select
                        value={webhookMethod}
                        onChange={(e) => setWebhookMethod(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        disabled={loading}
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                      </select>
                    </div>
                  </div>

                  {useCustomFields ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        自定义字段映射
                      </label>
                      {customFields.map((field, index) => (
                        <div key={index} className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                          <div className="flex gap-2">
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
                              disabled={loading}
                            />
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const newFields = [...customFields]
                                const newType = e.target.value as 'field' | 'custom' | 'fixed'
                                newFields[index].type = newType
                                // 设置默认值
                                if (newType === 'field' && !WEBHOOK_FIELD_OPTIONS.find(opt => opt.value === newFields[index].value)) {
                                  newFields[index].value = 'link'
                                } else if (newType === 'custom') {
                                  newFields[index].value = '{link}'
                                } else if (newType === 'fixed') {
                                  newFields[index].value = ''
                                }
                                setCustomFields(newFields)
                              }}
                              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              disabled={loading}
                            >
                              <option value="field">预定义字段</option>
                              <option value="custom">自定义值</option>
                              <option value="fixed">固定值</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomFields(customFields.filter((_, i) => i !== index))
                              }}
                              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                              disabled={loading || customFields.length === 1}
                            >
                              删除
                            </button>
                          </div>
                          {field.type === 'field' ? (
                            <select
                              value={field.value}
                              onChange={(e) => {
                                const newFields = [...customFields]
                                newFields[index].value = e.target.value
                                setCustomFields(newFields)
                              }}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              disabled={loading}
                            >
                              {WEBHOOK_FIELD_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : field.type === 'custom' ? (
                            <div>
                              <input
                                type="text"
                                value={field.value}
                                onChange={(e) => {
                                  const newFields = [...customFields]
                                  newFields[index].value = e.target.value
                                  setCustomFields(newFields)
                                }}
                                placeholder="例如: 文章链接: {link}, 标题: {title}"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                disabled={loading}
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                可使用变量: {WEBHOOK_FIELD_OPTIONS.map(opt => `{${opt.value}}`).join(', ')}
                              </p>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => {
                                const newFields = [...customFields]
                                newFields[index].value = e.target.value
                                setCustomFields(newFields)
                              }}
                              placeholder="固定值"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              disabled={loading}
                            />
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFields([...customFields, { name: '', type: 'field', value: 'link' }])
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        disabled={loading}
                      >
                        + 添加字段
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {webhookMethod === 'GET' ? '参数名将作为 URL 查询参数名' : '参数名将作为 JSON 请求体的字段名'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            发送字段
                          </label>
                          <select
                            value={webhookField}
                            onChange={(e) => setWebhookField(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            disabled={loading}
                          >
                            {WEBHOOK_FIELD_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            参数名
                          </label>
                          <input
                            type="text"
                            value={webhookParamName}
                            onChange={(e) => setWebhookParamName(e.target.value)}
                            placeholder="url"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {webhookMethod === 'GET' ? 'URL 查询参数名' : 'JSON 请求体的字段名'}
                      </p>
                    </>
                  )}

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={webhookRemote}
                        onChange={(e) => setWebhookRemote(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        disabled={loading}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        远程发起
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      勾选后由服务器端发起请求（避免 CORS 问题），未勾选时由浏览器直接发起请求
                    </p>
                  </div>
                </>
              )}
            </div>
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

