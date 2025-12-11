"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Loader2, ArrowLeft, Download, Upload, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import WebhookManager from "@/app/components/WebhookManager"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

const LANGUAGES = [
  { code: "zh", name: "中文" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" }
]

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState("zh")
  const [translationProvider, setTranslationProvider] = useState<"google" | "niutrans" | "microsoft">("google")
  const [googleTranslateApiKey, setGoogleTranslateApiKey] = useState("")
  const [niutransApiKey, setNiutransApiKey] = useState("")
  const [microsoftTranslateApiKey, setMicrosoftTranslateApiKey] = useState("")
  const [microsoftTranslateRegion, setMicrosoftTranslateRegion] = useState("global")
  const [hideImagesAndVideos, setHideImagesAndVideos] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    setMounted(true)
  }, [])

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
        setHideImagesAndVideos(data.hideImagesAndVideos ?? false)
      }
    } catch (error) {
      console.error("加载设置失败:", error)
      toast.error("加载设置失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 设置新的定时器，延迟保存以避免频繁请求
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true)

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
            markReadOnScroll: true,
            autoRefreshOnLoad: true,
            hideImagesAndVideos
          }),
        })

        if (res.ok) {
          toast.success("设置已保存")
        } else {
          const error = await res.json()
          toast.error(error.error || "保存失败")
        }
      } catch (error) {
        toast.error("保存失败，请重试")
      } finally {
        setSaving(false)
      }
    }, 500)
  }

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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
        toast.error(error.error || "导出失败")
      }
    } catch (error) {
      toast.error("导出失败，请重试")
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
          <Button
            onClick={() => router.push("/dashboard")}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>返回</span>
          </Button>
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
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">夜间模式</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">切换到深色主题以保护眼睛</p>
                </div>
                <Switch 
                  checked={mounted && theme === "dark"} 
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
                  disabled={!mounted}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">隐藏图片和视频</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">勾选后文章中的图片和视频将被折叠隐藏，点击可展开查看</p>
                </div>
                <Switch 
                  checked={hideImagesAndVideos} 
                  onCheckedChange={(checked) => {
                    setHideImagesAndVideos(checked)
                    handleSave()
                  }} 
                  disabled={saving} 
                />
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
                <Select 
                  value={targetLanguage} 
                  onValueChange={(value) => {
                    setTargetLanguage(value)
                    handleSave()
                  }}
                >
                  <SelectTrigger id="target-language" className="w-full">
                    <SelectValue placeholder="选择目标语言" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="translation-provider"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  翻译服务提供商
                </label>
                <Select 
                  value={translationProvider} 
                  onValueChange={(value) => {
                    setTranslationProvider(value as "google" | "niutrans" | "microsoft")
                    handleSave()
                  }}
                >
                  <SelectTrigger id="translation-provider" className="w-full">
                    <SelectValue placeholder="选择翻译服务提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google 翻译</SelectItem>
                  </SelectContent>
                </Select>
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
              <Button
                onClick={handleExport}
                disabled={exporting}
                variant="outline"
                className="flex items-center justify-center space-x-2"
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
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center justify-center space-x-2"
              >
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
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".opml,application/xml,text/xml"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
            </div>

            {importError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {importSuccess && importResults && (
              <Alert className="mt-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-600 dark:text-green-400">
                  <p className="font-medium">导入完成</p>
                  <p className="mt-1">
                    成功导入 {importResults.success} 个订阅，失败 {importResults.failed} 个（共 {importResults.total} 个）
                  </p>
                  {importResults.success > 0 && (
                    <p className="mt-1 text-xs">页面将在2秒后自动刷新...</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
