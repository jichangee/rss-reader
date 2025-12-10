"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"

interface ImagePreviewModalProps {
  imageSrc: string | null
  onClose: () => void
}

export default function ImagePreviewModal({ imageSrc, onClose }: ImagePreviewModalProps) {
  return (
    <Dialog open={!!imageSrc} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent 
        className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-0 shadow-none [&>button]:text-white [&>button]:hover:bg-white/20"
        showCloseButton={true}
      >
        <VisuallyHidden>
          <DialogTitle>图片预览</DialogTitle>
        </VisuallyHidden>
        {imageSrc && (
          <img
            src={imageSrc}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] object-contain w-full h-auto"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

