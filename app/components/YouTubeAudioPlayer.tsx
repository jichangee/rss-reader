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
  const videoTitleRef = useRef<string>("YouTube音频")
  const videoThumbnailRef = useRef<string>("")
  const wasPlayingBeforeHideRef = useRef<boolean>(false)
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isUserPausedRef = useRef<boolean>(false)

  // 提取YouTube视频ID
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
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

  // 监听页面可见性变化，防止锁屏时暂停
  useEffect(() => {
    if (!playerReady) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时，记录当前播放状态
        wasPlayingBeforeHideRef.current = isPlaying && !isUserPausedRef.current
        // 确保 Media Session 已设置，以便锁屏时显示控制
        if (isPlaying && playerRef.current && !isUserPausedRef.current) {
          setupMediaSession()
          
          // 启动自动恢复定时器，持续检查并恢复播放
          if (autoResumeTimerRef.current) {
            clearInterval(autoResumeTimerRef.current)
          }
          
          autoResumeTimerRef.current = setInterval(() => {
            if (document.hidden && playerRef.current && !isUserPausedRef.current && wasPlayingBeforeHideRef.current) {
              try {
                const state = playerRef.current.getPlayerState?.()
                // 如果播放器被暂停了，尝试恢复
                if (state === 2) {
                  playerRef.current.playVideo()
                }
              } catch (e) {
                // 静默失败，避免过多日志
              }
            } else {
              // 如果页面可见或用户暂停了，清除定时器
              if (autoResumeTimerRef.current) {
                clearInterval(autoResumeTimerRef.current)
                autoResumeTimerRef.current = null
              }
            }
          }, 1000) // 每秒检查一次
        }
      } else {
        // 页面重新可见时，清除自动恢复定时器
        if (autoResumeTimerRef.current) {
          clearInterval(autoResumeTimerRef.current)
          autoResumeTimerRef.current = null
        }
        
        // 如果之前正在播放，尝试恢复播放
        if (wasPlayingBeforeHideRef.current && playerRef.current && !isUserPausedRef.current) {
          setTimeout(() => {
            try {
              if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                const state = playerRef.current.getPlayerState()
                // 状态 2 表示暂停
                if (state === 2) {
                  playerRef.current.playVideo()
                }
              }
            } catch (e) {
              console.error("恢复播放失败:", e)
            }
          }, 300)
        }
      }
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 监听页面进入后台前的事件（iOS Safari）
    const handlePageHide = () => {
      // 确保 Media Session 已设置
      if (playerReady && playerRef.current && isPlaying && !isUserPausedRef.current) {
        setupMediaSession()
        wasPlayingBeforeHideRef.current = true
        
        // 启动自动恢复定时器
        if (autoResumeTimerRef.current) {
          clearInterval(autoResumeTimerRef.current)
        }
        
        autoResumeTimerRef.current = setInterval(() => {
          if (playerRef.current && !isUserPausedRef.current && wasPlayingBeforeHideRef.current) {
            try {
              const state = playerRef.current.getPlayerState?.()
              if (state === 2) {
                playerRef.current.playVideo()
              }
            } catch (e) {
              // 静默失败
            }
          }
        }, 1000)
      }
    }

    // 监听页面恢复事件（iOS Safari）
    const handlePageShow = () => {
      // 清除自动恢复定时器
      if (autoResumeTimerRef.current) {
        clearInterval(autoResumeTimerRef.current)
        autoResumeTimerRef.current = null
      }
      
      // 页面恢复时，如果之前正在播放，尝试恢复
      if (wasPlayingBeforeHideRef.current && playerRef.current && !isUserPausedRef.current) {
        setTimeout(() => {
          try {
            if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
              const state = playerRef.current.getPlayerState()
              if (state === 2) {
                playerRef.current.playVideo()
              }
            }
          } catch (e) {
            console.error("恢复播放失败:", e)
          }
        }, 300)
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      if (autoResumeTimerRef.current) {
        clearInterval(autoResumeTimerRef.current)
        autoResumeTimerRef.current = null
      }
    }
  }, [playerReady, isPlaying])

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
      // 清理 Media Session
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = null
          navigator.mediaSession.setActionHandler('play', null)
          navigator.mediaSession.setActionHandler('pause', null)
          navigator.mediaSession.setActionHandler('seekbackward', null)
          navigator.mediaSession.setActionHandler('seekforward', null)
        } catch (e) {
          console.error("清理 Media Session 失败:", e)
        }
      }
      
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
      if (autoResumeTimerRef.current) {
        clearInterval(autoResumeTimerRef.current)
        autoResumeTimerRef.current = null
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

  // 设置 Media Session API（用于锁屏控制）
  const setupMediaSession = () => {
    if (!('mediaSession' in navigator)) return

    const videoData = playerRef.current?.getVideoData()
    const title = videoData?.title || videoTitleRef.current
    videoTitleRef.current = title
    videoThumbnailRef.current = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`

    try {
      navigator.mediaSession.metadata = new (window as any).MediaMetadata({
        title: title,
        artist: 'YouTube',
        artwork: [
          { src: videoThumbnailRef.current, sizes: '320x180', type: 'image/jpeg' },
          { src: videoThumbnailRef.current, sizes: '640x360', type: 'image/jpeg' },
        ],
      })

      // 设置播放/暂停操作
      navigator.mediaSession.setActionHandler('play', () => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          isUserPausedRef.current = false
          wasPlayingBeforeHideRef.current = true
          playerRef.current.playVideo()
        }
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          isUserPausedRef.current = true
          wasPlayingBeforeHideRef.current = false
          playerRef.current.pauseVideo()
        }
      })

      // 设置前进/后退操作（可选）
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentTime = playerRef.current.getCurrentTime()
          const newTime = Math.max(0, currentTime - 10)
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(newTime, true)
          }
        }
      })

      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentDur = duration || (playerRef.current.getDuration?.() || 0)
          const currentTime = playerRef.current.getCurrentTime()
          const newTime = Math.min(currentDur, currentTime + 10)
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(newTime, true)
          }
        }
      })
    } catch (e) {
      console.error("设置 Media Session 失败:", e)
    }
  }

  // 更新 Media Session 播放状态
  const updateMediaSessionPlaybackState = (playing: boolean) => {
    if (!('mediaSession' in navigator)) return
    
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    } catch (e) {
      console.error("更新 Media Session 状态失败:", e)
    }
  }

  // 播放器就绪
  const onPlayerReady = (event: any) => {
    setPlayerReady(true)
    setIsLoading(false)
    const dur = event.target.getDuration()
    setDuration(dur)
    event.target.setVolume(volume)
    
    // 获取视频信息并设置 Media Session
    const videoData = event.target.getVideoData()
    if (videoData?.title) {
      videoTitleRef.current = videoData.title
    }
    setupMediaSession()
    
    // 如果有保存的进度，恢复到该位置
    if (savedProgress && savedProgress > 0 && savedProgress < dur - 10) {
      event.target.seekTo(savedProgress, true)
      setCurrentTime(savedProgress)
    }
    
    // 如果需要自动播放，立即开始播放
    if (shouldAutoPlay) {
      setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo()
        }
      }, 300)
    }
    
    // 开始更新进度
    intervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime())
      }
    }, 100)
  }

  // 播放器状态改变
  const onPlayerStateChange = (event: any) => {
    // -1: 未开始, 0: 结束, 1: 播放中, 2: 暂停, 3: 缓冲中, 5: 视频已插入
    if (event.data === 1) {
      setIsPlaying(true)
      updateMediaSessionPlaybackState(true)
      isUserPausedRef.current = false
      // 清除自动恢复定时器
      if (autoResumeTimerRef.current) {
        clearInterval(autoResumeTimerRef.current)
        autoResumeTimerRef.current = null
      }
    } else if (event.data === 2) {
      setIsPlaying(false)
      updateMediaSessionPlaybackState(false)
      // 暂停时保存进度
      if (playerRef.current && duration > 0) {
        const time = playerRef.current.getCurrentTime()
        saveProgress(time, duration)
      }
      
      // 如果页面隐藏且不是用户主动暂停，尝试恢复播放
      if (document.hidden && !isUserPausedRef.current && wasPlayingBeforeHideRef.current) {
        // 延迟一下再恢复，避免立即触发
        setTimeout(() => {
          if (playerRef.current && document.hidden && !isUserPausedRef.current) {
            try {
              const state = playerRef.current.getPlayerState?.()
              if (state === 2) { // 暂停状态
                playerRef.current.playVideo()
              }
            } catch (e) {
              console.error("自动恢复播放失败:", e)
            }
          }
        }, 500)
      }
    } else if (event.data === 0) {
      setIsPlaying(false)
      updateMediaSessionPlaybackState(false)
      setCurrentTime(0)
      isUserPausedRef.current = false
      // 播放完成时保存进度为0（重置）
      if (duration > 0) {
        saveProgress(0, duration)
      }
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
        wasPlayingBeforeHideRef.current = false // 用户主动暂停
        isUserPausedRef.current = true // 标记为用户主动暂停
        // 清除自动恢复定时器
        if (autoResumeTimerRef.current) {
          clearInterval(autoResumeTimerRef.current)
          autoResumeTimerRef.current = null
        }
      } else {
        // 开始播放
        playerRef.current.playVideo()
        updateMediaSessionPlaybackState(true)
        wasPlayingBeforeHideRef.current = true // 用户主动播放
        isUserPausedRef.current = false // 清除用户暂停标志
        
        // 确保 Media Session 已设置
        setupMediaSession()

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
          title={isPlaying ? "暂停" : "播放"}
        >
          {isLoading ? (
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

      {/* 隐藏的YouTube播放器容器 */}
      <div ref={containerRef} style={{ display: 'none' }} />
    </div>
  )
}

