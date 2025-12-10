"use client"

import { toast } from "sonner"

// Hook for managing toasts using sonner
export function useToast() {
  return {
    success: (message: string, duration?: number) => {
      toast.success(message, { duration: duration || 3000 })
    },
    error: (message: string, duration?: number) => {
      toast.error(message, { duration: duration || 3000 })
    },
    info: (message: string, duration?: number) => {
      toast.info(message, { duration: duration || 3000 })
    },
    warning: (message: string, duration?: number) => {
      toast.warning(message, { duration: duration || 3000 })
    },
  }
}

// 为了向后兼容，导出空的 ToastContainer（不再需要）
export function ToastContainer() {
  return null
}

