"use client"

import { useEffect } from "react"
import { useGlobalPlayer } from "./GlobalPlayerContext"
import YouTubeAudioPlayer from "./YouTubeAudioPlayer"
import { X, Maximize2 } from "lucide-react"

export default function GlobalPlayer() {
  const { playerState, deactivatePlayer } = useGlobalPlayer()

  if (!playerState.isActive || !playerState.videoUrl) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
              <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="font-medium">全局播放器</span>
            </div>
          </div>
          <button
            onClick={deactivatePlayer}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            title="关闭播放器"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <YouTubeAudioPlayer 
          videoUrl={playerState.videoUrl} 
          articleId={playerState.articleId}
          isGlobalPlayer={true}
          shouldAutoPlay={playerState.shouldAutoPlay}
        />
      </div>
    </div>
  )
}

