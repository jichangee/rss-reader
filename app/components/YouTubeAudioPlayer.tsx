"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, Loader2, Volume2, VolumeX } from "lucide-react"

// 声明YouTube Player API类型
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface YouTubeAudioPlayerProps {
  videoUrl: string
  articleId?: string // 可选的文章ID，用于关联播放记录
  shouldAutoPlay?: boolean // 是否自动播放
  initialTime?: number // 初始播放时间（秒）
}

export default function YouTubeAudioPlayer({ videoUrl, articleId, shouldAutoPlay = false, initialTime }: YouTubeAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [savedProgress, setSavedProgress] = useState<number | null>(initialTime !== undefined ? initialTime : null)
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const saveProgressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastMediaPositionUpdateRef = useRef<number>(0)

  // 提取YouTube视频ID
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
      /youtube-nocookie\.com\/embed\/([^&\n?#]+)/, // 支持 youtube-nocookie.com
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  const videoId = extractVideoId(videoUrl)

  // 加载之前的播放进度（仅当没有提供 initialTime 时）
  useEffect(() => {
    if (!videoId || initialTime !== undefined) return

    const loadProgress = async () => {
      try {
        const response = await fetch("/api/playlist")
        if (response.ok) {
          const data = await response.json()
          const item = data.playlistItems?.find((item: any) => item.videoId === videoId)
          if (item && item.currentTime > 0) {
            setSavedProgress(item.currentTime)
          }
        }
      } catch (err) {
        console.error("加载播放进度失败:", err)
      }
    }

    loadProgress()
  }, [videoId, initialTime])

  // 保存播放进度到服务器
  const saveProgress = async (time: number, dur: number) => {
    if (!videoId || !playerRef.current) return

    try {
      // 获取视频信息
      const videoData = playerRef.current.getVideoData()
      const title = videoData?.title || "未知标题"
      const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`

      await fetch("/api/playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          videoUrl,
          title,
          thumbnail,
          duration: dur,
          currentTime: time,
          articleId,
        }),
      })
    } catch (err) {
      console.error("保存播放进度失败:", err)
    }
  }

  const isMediaSessionSupported = () => typeof navigator !== "undefined" && "mediaSession" in navigator

  const updateMediaSessionMetadata = () => {
    if (!isMediaSessionSupported() || !playerRef.current) return

    try {
      const videoData = playerRef.current.getVideoData?.()
      const title = videoData?.title || "YouTube 音频"
      const artist = videoData?.author || "YouTube"

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: "RSS Reader",
        artwork: videoId
          ? [
              { src: `https://img.youtube.com/vi/${videoId}/default.jpg`, sizes: "120x90", type: "image/jpeg" },
              { src: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
              { src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
            ]
          : undefined,
      })
    } catch (err) {
      console.warn("设置 Media Session 元数据失败:", err)
    }
  }

  const updateMediaSessionPlaybackState = (playing: boolean) => {
    if (!isMediaSessionSupported()) return
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused"
    } catch (err) {
      console.warn("更新 Media Session 播放状态失败:", err)
    }
  }

  const updateMediaSessionPosition = (position: number, dur: number) => {
    if (
      !isMediaSessionSupported() ||
      typeof navigator.mediaSession.setPositionState !== "function" ||
      !isFinite(dur) ||
      dur <= 0
    ) {
      return
    }

    const now = Date.now()
    if (now - lastMediaPositionUpdateRef.current < 500) return
    lastMediaPositionUpdateRef.current = now

    try {
      navigator.mediaSession.setPositionState({
        duration: dur,
        position,
        playbackRate: playerRef.current?.getPlaybackRate?.() || 1,
      })
    } catch (err) {
      console.warn("更新 Media Session 进度失败:", err)
    }
  }

  const registerMediaSessionHandlers = () => {
    if (!isMediaSessionSupported()) return

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (playerRef.current?.playVideo) {
          playerRef.current.playVideo()
        }
      })
      navigator.mediaSession.setActionHandler("pause", () => {
        if (playerRef.current?.pauseVideo) {
          playerRef.current.pauseVideo()
        }
      })
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(0, true)
        }
      })
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (playerRef.current?.getDuration && playerRef.current?.seekTo) {
          const dur = playerRef.current.getDuration()
          playerRef.current.seekTo(Math.max(dur - 5, 0), true)
        }
      })
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        if (playerRef.current?.getCurrentTime && playerRef.current?.seekTo) {
          const current = playerRef.current.getCurrentTime()
          playerRef.current.seekTo(Math.max(current - (details.seekOffset || 10), 0), true)
        }
      })
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        if (playerRef.current?.getCurrentTime && playerRef.current?.seekTo) {
          const current = playerRef.current.getCurrentTime()
          const dur = playerRef.current.getDuration?.() || duration
          playerRef.current.seekTo(Math.min(current + (details.seekOffset || 10), dur), true)
        }
      })
    } catch (err) {
      console.warn("注册 Media Session 控件失败:", err)
    }
  }

  // 定期保存播放进度
  useEffect(() => {
    if (isPlaying && playerReady) {
      // 每10秒保存一次进度
      saveProgressTimerRef.current = setInterval(() => {
        if (playerRef.current && duration > 0) {
          const time = playerRef.current.getCurrentTime()
          saveProgress(time, duration)
        }
      }, 10000)

      return () => {
        if (saveProgressTimerRef.current) {
          clearInterval(saveProgressTimerRef.current)
        }
      }
    }
  }, [isPlaying, playerReady, duration])

  // 加载YouTube IFrame API
  useEffect(() => {
    if (!videoId) {
      setError("无效的YouTube链接")
      setIsLoading(false)
      return
    }

    // 检查API是否已加载
    if (window.YT && window.YT.Player) {
      initializePlayer()
      return
    }

    // 加载YouTube IFrame API
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // API加载完成后的回调
    window.onYouTubeIframeAPIReady = () => {
      initializePlayer()
    }

    return () => {
      // 清理播放器
      if (playerRef.current) {
        try {
          // 组件卸载时保存最后的进度
          if (duration > 0 && typeof playerRef.current.getCurrentTime === 'function') {
            const time = playerRef.current.getCurrentTime()
            saveProgress(time, duration)
          }
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy()
          }
        } catch (e) {
          console.error("清理播放器失败:", e)
        }
        playerRef.current = null
      }
      
      // 清空容器
      if (containerRef.current) {
        try {
          containerRef.current.innerHTML = ''
        } catch (e) {
          console.error("清空容器失败:", e)
        }
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (saveProgressTimerRef.current) {
        clearInterval(saveProgressTimerRef.current)
        saveProgressTimerRef.current = null
      }
    }
  }, [videoId])

  // 初始化播放器
  const initializePlayer = () => {
    if (!containerRef.current || !videoId) return

    // 先销毁旧的播放器实例（如果存在）
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
      } catch (e) {
        console.error("销毁旧播放器失败:", e)
      }
      playerRef.current = null
    }

    // 清空容器并重新创建一个干净的 div
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = ''
        // 创建一个新的 div 作为播放器容器
        const playerDiv = document.createElement('div')
        playerDiv.id = `yt-player-${videoId}-${Date.now()}`
        containerRef.current.appendChild(playerDiv)
      } catch (e) {
        console.error("清理容器失败:", e)
      }
    }

    // 重置状态
    setPlayerReady(false)
    setIsPlaying(false)
    setError(null)

    try {
      // 使用新创建的 div 初始化播放器
      const playerDiv = containerRef.current?.firstChild as HTMLElement
      if (!playerDiv) {
        throw new Error("播放器容器创建失败")
      }

      playerRef.current = new window.YT.Player(playerDiv, {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          hl: 'zh-CN',              // 设置界面语言为简体中文
          cc_lang_pref: 'zh-CN',    // 字幕语言偏好为简体中文
          cc_load_policy: 0,        // 不自动显示字幕（音频播放器不需要）
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      })
    } catch (err) {
      console.error("初始化播放器失败:", err)
      setError("播放器初始化失败")
      setIsLoading(false)
    }
  }

  // 播放器就绪
  const onPlayerReady = (event: any) => {
    setPlayerReady(true)
    setIsLoading(false)
    const dur = event.target.getDuration()
    setDuration(dur)
    event.target.setVolume(volume)
    updateMediaSessionMetadata()
    registerMediaSessionHandlers()
    
    // 如果有保存的进度，恢复到该位置
    if (savedProgress && savedProgress > 0 && savedProgress < dur - 10) {
      event.target.seekTo(savedProgress, true)
      setCurrentTime(savedProgress)
      updateMediaSessionPosition(savedProgress, dur)
    }
    
    // 如果需要自动播放，立即开始播放
    if (shouldAutoPlay) {
      setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo()
          updateMediaSessionPlaybackState(true)
        }
      }, 300)
    }
    
    // 开始更新进度
    intervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime()
        setCurrentTime(time)
        updateMediaSessionPosition(time, playerRef.current.getDuration?.() || dur || duration)
      }
    }, 100)
  }

  // 播放器状态改变
  const onPlayerStateChange = (event: any) => {
    // -1: 未开始, 0: 结束, 1: 播放中, 2: 暂停, 3: 缓冲中, 5: 视频已插入
    if (event.data === 1) {
      // 播放中
      setIsPlaying(true)
      setIsBuffering(false)
      updateMediaSessionPlaybackState(true)
    } else if (event.data === 2) {
      // 暂停
      setIsPlaying(false)
      setIsBuffering(false)
      updateMediaSessionPlaybackState(false)
      // 暂停时保存进度
      if (playerRef.current && duration > 0) {
        const time = playerRef.current.getCurrentTime()
        saveProgress(time, duration)
      }
    } else if (event.data === 3) {
      // 缓冲中
      setIsBuffering(true)
    } else if (event.data === 0) {
      // 播放结束
      setIsPlaying(false)
      setIsBuffering(false)
      setCurrentTime(0)
      updateMediaSessionPlaybackState(false)
      // 播放完成时保存进度为0（重置）
      if (duration > 0) {
        saveProgress(0, duration)
      }
    } else {
      // 其他状态（-1: 未开始, 5: 视频已插入）
      setIsBuffering(false)
    }
  }

  // 播放器错误
  const onPlayerError = (event: any) => {
    console.error("YouTube播放器错误:", event.data)
    const errorMessages: { [key: number]: string } = {
      2: "无效的参数",
      5: "HTML5播放器错误",
      100: "视频未找到或已被删除",
      101: "视频所有者不允许嵌入播放",
      150: "视频所有者不允许嵌入播放",
    }
    setError(errorMessages[event.data] || "播放失败")
    setIsLoading(false)
  }

  // 播放/暂停
  const togglePlay = async () => {
    if (!playerRef.current || !playerReady) return

    // 确保播放器方法存在
    if (typeof playerRef.current.playVideo !== 'function' || 
        typeof playerRef.current.pauseVideo !== 'function') {
      console.error("播放器未正确初始化")
      setError("播放器未就绪，请稍后重试")
      return
    }

    try {
      if (isPlaying) {
        playerRef.current.pauseVideo()
        updateMediaSessionPlaybackState(false)
      } else {
        // 开始播放
        playerRef.current.playVideo()
        updateMediaSessionPlaybackState(true)

        // 开始播放后，添加到播放列表（即使 duration 还没准备好）
        if (videoId) {
          // 等待一下确保获取到 duration
          setTimeout(async () => {
            if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
              const dur = playerRef.current.getDuration()
              const time = playerRef.current.getCurrentTime?.() || 0
              if (dur > 0) {
                await saveProgress(time, dur)
              }
            }
          }, 500)
        }
      }
    } catch (err) {
      console.error("播放控制失败:", err)
      setError("播放失败，请刷新页面重试")
    }
  }

  // 进度条拖动
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !playerReady) return
    
    // 确保方法存在
    if (typeof playerRef.current.seekTo !== 'function') return
    
    try {
      const newTime = parseFloat(e.target.value)
      setCurrentTime(newTime)
      playerRef.current.seekTo(newTime, true)
      updateMediaSessionPosition(newTime, playerRef.current.getDuration?.() || duration)
    } catch (err) {
      console.error("进度调整失败:", err)
    }
  }

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !playerReady) return
    
    // 确保方法存在
    if (typeof playerRef.current.setVolume !== 'function') return
    
    try {
      const newVolume = parseFloat(e.target.value)
      setVolume(newVolume)
      playerRef.current.setVolume(newVolume)
      
      if (newVolume === 0) {
        setIsMuted(true)
        if (typeof playerRef.current.mute === 'function') {
          playerRef.current.mute()
        }
      } else {
        setIsMuted(false)
        if (typeof playerRef.current.unMute === 'function') {
          playerRef.current.unMute()
        }
      }
    } catch (err) {
      console.error("音量调整失败:", err)
    }
  }

  // 静音切换
  const toggleMute = () => {
    if (!playerRef.current || !playerReady) return
    
    // 确保方法存在
    if (typeof playerRef.current.mute !== 'function' || 
        typeof playerRef.current.unMute !== 'function') return
    
    try {
      if (isMuted) {
        const newVolume = volume === 0 ? 50 : volume
        setVolume(newVolume)
        playerRef.current.unMute()
        if (typeof playerRef.current.setVolume === 'function') {
          playerRef.current.setVolume(newVolume)
        }
        setIsMuted(false)
      } else {
        playerRef.current.mute()
        setIsMuted(true)
      }
    } catch (err) {
      console.error("静音切换失败:", err)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!videoId) {
    return null
  }

  return (
    <div className="my-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 p-4 shadow-sm">
      <div className="flex items-center space-x-3">
        {/* 播放按钮 */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="flex-shrink-0 rounded-full bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
          title={isBuffering ? "缓冲中..." : isPlaying ? "暂停" : "播放"}
        >
          {isLoading || isBuffering ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* YouTube视频信息 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                YouTube音频
              </span>
            </div>
            {duration > 0 && (
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}
          </div>

          {/* 进度条 */}
          {playerReady && (
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, rgb(79, 70, 229) 0%, rgb(79, 70, 229) ${(currentTime / duration) * 100}%, rgb(209, 213, 219) ${(currentTime / duration) * 100}%, rgb(209, 213, 219) 100%)`
                }}
              />
              
              {/* 音量控制 */}
              <button
                onClick={toggleMute}
                className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(79, 70, 229) 0%, rgb(79, 70, 229) ${(isMuted ? 0 : volume)}%, rgb(209, 213, 219) ${(isMuted ? 0 : volume)}%, rgb(209, 213, 219) 100%)`
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 隐藏的YouTube播放器容器（不能 display:none，否则移动端会被后台暂停） */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className="youtube-player-container"
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          maxWidth: "1px",
          maxHeight: "1px",
          opacity: 0,
          pointerEvents: "none",
          overflow: "hidden",
          bottom: 0,
          right: 0,
          zIndex: -1,
        }}
      />
    </div>
  )
}

