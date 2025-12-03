"use client"

import { useState, useRef, useEffect } from "react"
import { Clock, Loader2 } from "lucide-react"
import { useToast } from "../Toast"

interface CleanupMenuProps {
  onMarkOlderAsRead: (range: '24h' | 'week') => Promise<{ success: boolean; count?: number; message?: string }>
}

export default function CleanupMenu({ onMarkOlderAsRead }: CleanupMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { success, error, info } = useToast()

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showMenu])

  const handleCleanupClick = async (range: '24h' | 'week') => {
    setShowMenu(false)
    setIsCleaningUp(true)
    
    try {
      const result = await onMarkOlderAsRead(range)
      if (result.success) {
        if (result.count && result.count > 0) {
          success(`已将 ${result.count} 篇旧文章标记为已读`)
        } else {
          info("没有符合条件的旧文章")
        }
      } else {
        error(result.message || "操作失败，请重试")
      }
    } catch (err) {
      console.error("清理旧文章失败:", err)
      error("操作失败，请重试")
    } finally {
      setIsCleaningUp(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isCleaningUp}
        className="flex items-center space-x-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
        title="清理旧文章"
      >
        {isCleaningUp ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {isCleaningUp ? "清理中..." : "清理旧文章"}
        </span>
      </button>
      
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl dark:bg-gray-800 dark:shadow-gray-900/30 z-50">
          <div className="py-1" role="menu">
            <button
              onClick={() => handleCleanupClick('24h')}
              disabled={isCleaningUp}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
              role="menuitem"
            >
              24小时之前
            </button>
            <button
              onClick={() => handleCleanupClick('week')}
              disabled={isCleaningUp}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
              role="menuitem"
            >
              本周之前
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

