"use client"

import { useState } from "react"
import { Clock, Loader2 } from "lucide-react"
import { useToast } from "../Toast"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface CleanupMenuProps {
  onMarkOlderAsRead: (range: '24h' | 'week' | 'all') => Promise<{ success: boolean; count?: number; message?: string }>
}

export default function CleanupMenu({ onMarkOlderAsRead }: CleanupMenuProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const { success, error, info } = useToast()

  const handleCleanupClick = async (range: '24h' | 'week' | 'all') => {
    setIsCleaningUp(true)
    
    try {
      const result = await onMarkOlderAsRead(range)
      if (result.success) {
        if (result.count && result.count > 0) {
          const message = range === 'all' 
            ? `已将全部 ${result.count} 篇文章标记为已读` 
            : `已将 ${result.count} 篇旧文章标记为已读`
          success(message)
        } else {
          info(range === 'all' ? "没有未读文章" : "没有符合条件的旧文章")
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isCleaningUp}
          variant="outline"
          size="sm"
          className="flex items-center space-x-1 bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-800 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
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
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleCleanupClick('24h')}
          disabled={isCleaningUp}
        >
          24小时之前
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleCleanupClick('week')}
          disabled={isCleaningUp}
        >
          本周之前
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleCleanupClick('all')}
          disabled={isCleaningUp}
        >
          全部
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

