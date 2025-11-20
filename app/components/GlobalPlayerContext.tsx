"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface GlobalPlayerState {
  videoUrl: string | null
  videoId: string | null
  articleId?: string
  isActive: boolean
  shouldAutoPlay?: boolean
}

interface GlobalPlayerContextType {
  playerState: GlobalPlayerState
  activatePlayer: (videoUrl: string, videoId: string, articleId?: string, shouldAutoPlay?: boolean) => void
  deactivatePlayer: () => void
}

const GlobalPlayerContext = createContext<GlobalPlayerContextType | undefined>(undefined)

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerState, setPlayerState] = useState<GlobalPlayerState>({
    videoUrl: null,
    videoId: null,
    articleId: undefined,
    isActive: false,
    shouldAutoPlay: false,
  })

  const activatePlayer = useCallback((videoUrl: string, videoId: string, articleId?: string, shouldAutoPlay = true) => {
    setPlayerState({
      videoUrl,
      videoId,
      articleId,
      isActive: true,
      shouldAutoPlay,
    })
  }, [])

  const deactivatePlayer = useCallback(() => {
    setPlayerState({
      videoUrl: null,
      videoId: null,
      articleId: undefined,
      isActive: false,
      shouldAutoPlay: false,
    })
  }, [])

  return (
    <GlobalPlayerContext.Provider value={{ playerState, activatePlayer, deactivatePlayer }}>
      {children}
    </GlobalPlayerContext.Provider>
  )
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext)
  if (context === undefined) {
    throw new Error("useGlobalPlayer must be used within a GlobalPlayerProvider")
  }
  return context
}

