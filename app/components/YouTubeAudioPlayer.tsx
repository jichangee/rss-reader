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
}

export default function YouTubeAudioPlayer({ videoUrl }: YouTubeAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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
          playerRef.current.destroy()
        } catch (e) {
          // 忽略销毁错误
        }
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [videoId])

  // 初始化播放器
  const initializePlayer = () => {
    if (!containerRef.current || !videoId) return

    try {
      playerRef.current = new window.YT.Player(containerRef.current, {
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
    setDuration(event.target.getDuration())
    event.target.setVolume(volume)
    
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
    } else if (event.data === 2) {
      setIsPlaying(false)
    } else if (event.data === 0) {
      setIsPlaying(false)
      setCurrentTime(0)
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
  const togglePlay = () => {
    if (!playerRef.current || !playerReady) return

    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  // 进度条拖动
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !playerReady) return
    
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    playerRef.current.seekTo(newTime, true)
  }

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerRef.current || !playerReady) return
    
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    playerRef.current.setVolume(newVolume)
    
    if (newVolume === 0) {
      setIsMuted(true)
      playerRef.current.mute()
    } else {
      setIsMuted(false)
      playerRef.current.unMute()
    }
  }

  // 静音切换
  const toggleMute = () => {
    if (!playerRef.current || !playerReady) return
    
    if (isMuted) {
      const newVolume = volume === 0 ? 50 : volume
      setVolume(newVolume)
      playerRef.current.unMute()
      playerRef.current.setVolume(newVolume)
      setIsMuted(false)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
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

