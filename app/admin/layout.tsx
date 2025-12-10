"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Users, 
  Rss, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      // 检查用户是否为管理员
      fetch("/api/admin/check")
        .then(res => {
          if (res.ok) {
            setIsAdmin(true)
          } else {
            setIsAdmin(false)
            router.push("/dashboard")
          }
        })
        .catch(() => {
          setIsAdmin(false)
          router.push("/dashboard")
        })
    }
  }, [status, router])

  if (status === "loading" || isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const navigation = [
    { name: "数据统计", href: "/admin", icon: LayoutDashboard },
    { name: "用户管理", href: "/admin/users", icon: Users },
    { name: "订阅源管理", href: "/admin/feeds", icon: Rss },
    { name: "文章管理", href: "/admin/articles", icon: FileText },
    { name: "系统设置", href: "/admin/settings", icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 移动端遮罩层 */}
      <div
        className={`fixed inset-0 z-30 bg-black transition-opacity duration-300 lg:hidden ${
          isSidebarOpen ? "opacity-50" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* 侧边栏 */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo 区域 */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              管理后台
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* 用户信息 */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="h-10 w-10 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <span>返回前台</span>
            </Link>
            <button
              onClick={() => router.push("/api/auth/signout")}
              className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {navigation.find(item => item.href === pathname)?.name || "管理后台"}
          </h1>
          <div className="w-10 lg:hidden"></div> {/* 占位符保持居中 */}
        </header>

        {/* 内容区域 */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
