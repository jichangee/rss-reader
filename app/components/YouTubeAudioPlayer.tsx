"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react"
import { extractVideoId, detectPlatform } from "@/lib/youtube-utils"

interface YouTubeAudioPlayerProps {
  url: string
  title?: string
  autoplay?: boolean
}

export default function YouTubeAudioPlayer({ 
  url, 
  title = "YouTube 音频",
  autoplay = false 
}: YouTubeAudioPlayerProps) {
  const [platform] = useState(() => detectPlatform())
  const videoId = extractVideoId(url)

  if (!videoId) {
    return null
  }

  // iOS 平台使用 HTML5 Audio 播放器
  if (platform === 'ios') {
    return <IOSAudioPlayer videoId={videoId} title={title} autoplay={autoplay} />
  }

  // 其他平台使用 YouTube iframe
  return <YouTubeIframePlayer videoId={videoId} title={title} autoplay={autoplay} />
}

/**
 * iOS 平台的 HTML5 音频播放器
 * 支持后台播放和锁屏控制
 */
function IOSAudioPlayer({ 
  videoId, 
  title, 
  autoplay 
}: { 
  videoId: string
  title: string
  autoplay: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState(title)

  // 获取音频流
  useEffect(() => {
    const fetchAudio = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/youtube/audio?videoId=${videoId}`)
        
        if (!response.ok) {
          throw new Error('获取音频失败')
        }

        const data = await response.json()
        setAudioUrl(data.audioUrl)
        setVideoTitle(data.title || title)
        
        // 设置 Media Session 元数据
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: data.title || title,
            artist: data.author || 'YouTube',
            artwork: [
              {
                src: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                sizes: '1280x720',
                type: 'image/jpeg',
              },
            ],
          })
        }
      } catch (err) {
        console.error('获取音频失败:', err)
        setError('无法加载音频，请稍后重试')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAudio()
  }, [videoId, title])

  // 设置 Media Session 控制
  useEffect(() => {
    if ('mediaSession' in navigator && audioRef.current) {
      const audio = audioRef.current

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play()
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause()
      })

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(audio.currentTime - 10, 0)
      })

      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.currentTime + 10, audio.duration)
      })

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          audio.currentTime = details.seekTime
        }
      })
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      }
    }
  }, [audioUrl])

  // 音频事件处理
  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      
      // 更新 Media Session 位置状态
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime,
        })
      }
    }
  }
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }
  const handleEnded = () => setIsPlaying(false)

  // 播放/暂停切换
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
  }

  // 进度条拖动
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
    }
    if (vol === 0) {
      setIsMuted(true)
    } else {
      setIsMuted(false)
    }
  }

  // 静音切换
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 mb-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 mb-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">正在加载音频...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 mb-4 shadow-md">
      {/* 音频标题 */}
      <div className="mb-3 flex items-center space-x-2">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {videoTitle}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">YouTube 音频</p>
        </div>
      </div>

      {/* 音频元素 */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          autoPlay={autoplay}
          preload="metadata"
        />
      )}

      {/* 进度条 */}
      <div className="mb-3">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-indigo-200 dark:bg-indigo-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-between">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors shadow-md hover:shadow-lg"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" fill="currentColor" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* 音量控制 */}
        <div className="flex items-center space-x-2 flex-1 ml-4">
          <button
            onClick={toggleMute}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-indigo-200 dark:bg-indigo-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 桌面平台的 YouTube iframe 播放器
 */
function YouTubeIframePlayer({ 
  videoId, 
  title,
  autoplay 
}: { 
  videoId: string
  title: string
  autoplay: boolean
}) {
  return (
    <div className="rounded-xl overflow-hidden mb-4 shadow-md">
      <div className="relative" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </div>
  )
}
