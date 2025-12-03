"use client"

import { X } from "lucide-react"

interface ImagePreviewModalProps {
  imageSrc: string | null
  onClose: () => void
}

export default function ImagePreviewModal({ imageSrc, onClose }: ImagePreviewModalProps) {
  if (!imageSrc) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        aria-label="关闭预览"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={imageSrc}
        alt="预览"
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

