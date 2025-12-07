"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Save, Download, Upload } from "lucide-react"
import WebhookManager from "@/app/components/WebhookManager"

const LANGUAGES = [
  { code: "zh", name: "中文" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" }
]

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${
        checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50`}
    >
      <span
        aria-hidden="true"
        className={`${
          checked ? 'translate-x-5' : 'translate-x-0'
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useState("zh")
  const [translationProvider, setTranslationProvider] = useState<"google" | "niutrans" | "microsoft">("google")
  const [googleTranslateApiKey, setGoogleTranslateApiKey] = useState("")
  const [niutransApiKey, setNiutransApiKey] = useState("")
  const [microsoftTranslateApiKey, setMicrosoftTranslateApiKey] = useState("")
  const [microsoftTranslateRegion, setMicrosoftTranslateRegion] = useState("global")
  const [markReadOnScroll, setMarkReadOnScroll] = useState(false)
  const [autoRefreshOnLoad, setAutoRefreshOnLoad] = useState(true)
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number; total: number } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      loadSettings()
    }
  }, [status])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/user/settings")
      if (res.ok) {
        const data = await res.json()
        setTargetLanguage(data.targetLanguage || "zh")
        setTranslationProvider(data.translationProvider || "google")
        setGoogleTranslateApiKey(data.googleTranslateApiKey || "")
        setNiutransApiKey(data.niutransApiKey || "")
        setMicrosoftTranslateApiKey(data.microsoftTranslateApiKey || "")
        setMicrosoftTranslateRegion(data.microsoftTranslateRegion || "global")
        setMarkReadOnScroll(data.markReadOnScroll ?? false)
        setAutoRefreshOnLoad(data.autoRefreshOnLoad ?? true)
        setHideImagesAndVideos(data.hideImagesAndVideos ?? false)
      }
    } catch (error) {
      console.error("加载设置失败:", error)
      setError("加载设置失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      setSuccess(false)

      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          targetLanguage, 
          translationProvider,
          googleTranslateApiKey,
          niutransApiKey,
          microsoftTranslateApiKey,
          microsoftTranslateRegion,
          markReadOnScroll, 
          autoRefreshOnLoad,
          hideImagesAndVideos
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const error = await res.json()
        setError(error.error || "保存失败")
      }
    } catch (error) {
      setError("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const res = await fetch("/api/feeds/export")
      
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `rss-feeds-${new Date().toISOString().split('T')[0]}.opml`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const error = await res.json()
        setError(error.error || "导出失败")
      }
    } catch (error) {
      setError("导出失败，请重试")
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.name.endsWith('.opml') && file.type !== 'application/xml' && file.type !== 'text/xml') {
      setImportError("请选择OPML格式的文件")
      return
    }

    try {
      setImporting(true)
      setImportError("")
      setImportSuccess(false)
      setImportResults(null)

      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/feeds/import", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setImportSuccess(true)
        setImportResults({
          success: data.summary.success,
          failed: data.summary.failed,
          total: data.summary.total,
        })
        
        // 如果成功导入了订阅，刷新页面以更新订阅列表
        if (data.summary.success > 0) {
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } else {
        const error = await res.json()
        setImportError(error.error || "导入失败")
      }
    } catch (error) {
      setImportError("导入失败，请重试")
    } finally {
      setImporting(false)
      // 重置文件输入
      e.target.value = ""
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>返回</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            设置
          </h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              阅读设置
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">滚动标记已读</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">当文章滚动出屏幕时自动标记为已读</p>
                </div>
                <Switch checked={markReadOnScroll} onChange={setMarkReadOnScroll} disabled={saving} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">首次自动刷新</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">首次进入页面时自动刷新订阅内容</p>
                </div>
                <Switch checked={autoRefreshOnLoad} onChange={setAutoRefreshOnLoad} disabled={saving} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">隐藏图片和视频</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">勾选后文章中的图片和视频将被折叠隐藏，点击可展开查看</p>
                </div>
                <Switch checked={hideImagesAndVideos} onChange={setHideImagesAndVideos} disabled={saving} />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              翻译设置
            </h2>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              设置默认的翻译目标语言和翻译服务提供商。在添加订阅时，你可以为每个订阅单独选择是否启用翻译。
            </p>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="target-language"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  目标语言
                </label>
                <select
                  id="target-language"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="translation-provider"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  翻译服务提供商
                </label>
                <select
                  id="translation-provider"
                  value={translationProvider}
                  onChange={(e) => setTranslationProvider(e.target.value as "google")}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="google">Google 翻译</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <WebhookManager />
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              订阅管理
            </h2>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              导出或导入你的RSS订阅列表。支持标准的OPML格式，可以与其他RSS阅读器兼容。
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center justify-center space-x-2 rounded-lg border border-indigo-600 bg-white px-6 py-3 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500 dark:bg-gray-700 dark:text-indigo-400 dark:hover:bg-gray-600"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>导出中...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>导出订阅</span>
                  </>
                )}
              </button>

              <label className="flex cursor-pointer items-center justify-center space-x-2 rounded-lg border border-indigo-600 bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-700">
                {importing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span>导入订阅</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".opml,application/xml,text/xml"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            </div>

            {importError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {importError}
              </div>
            )}

            {importSuccess && importResults && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <p className="font-medium">导入完成</p>
                <p className="mt-1">
                  成功导入 {importResults.success} 个订阅，失败 {importResults.failed} 个（共 {importResults.total} 个）
                </p>
                {importResults.success > 0 && (
                  <p className="mt-1 text-xs">页面将在2秒后自动刷新...</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          {error && (
            <div className="mr-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mr-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
              设置已保存
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>保存设置</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
