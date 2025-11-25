import { NextResponse } from "next/server"

/**
 * Invidious 公共实例列表
 * 参考: https://docs.invidious.io/instances/
 */
const INVIDIOUS_INSTANCES = [
  'https://invidious.jing.rocks',
  'https://iv.melmac.space',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
]

interface InvidiousVideoFormat {
  url: string
  type: string
  quality?: string
  bitrate?: number
}

interface InvidiousVideoResponse {
  adaptiveFormats: InvidiousVideoFormat[]
  formatStreams: InvidiousVideoFormat[]
  title: string
  author: string
  lengthSeconds: number
}

/**
 * 从 Invidious 获取 YouTube 视频音频流
 * 支持多实例故障转移
 */
async function fetchAudioFromInvidious(videoId: string): Promise<{ 
  audioUrl: string
  title: string
  author: string
  duration: number
}> {
  let lastError: Error | null = null

  // 尝试每个 Invidious 实例
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[YouTube Audio] 尝试从实例获取: ${instance}`)
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': 'RSS-Reader/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: InvidiousVideoResponse = await response.json()

      // 优先选择仅音频的格式
      // 按 bitrate 降序排列，选择最高质量的音频
      const audioFormats = data.adaptiveFormats
        .filter(f => f.type.startsWith('audio/'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

      if (audioFormats.length > 0) {
        console.log(`[YouTube Audio] 成功从 ${instance} 获取音频`)
        return {
          audioUrl: audioFormats[0].url,
          title: data.title,
          author: data.author,
          duration: data.lengthSeconds,
        }
      }

      // 如果没有仅音频格式，尝试使用 formatStreams
      // 通常包含音频+视频，但可以作为备选
      if (data.formatStreams.length > 0) {
        console.log(`[YouTube Audio] 使用备用格式从 ${instance}`)
        return {
          audioUrl: data.formatStreams[0].url,
          title: data.title,
          author: data.author,
          duration: data.lengthSeconds,
        }
      }

      throw new Error('未找到可用的音频格式')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[YouTube Audio] 实例 ${instance} 失败:`, lastError.message)
      continue
    }
  }

  // 所有实例都失败
  throw new Error(`无法从任何 Invidious 实例获取音频: ${lastError?.message || '未知错误'}`)
}

/**
 * API 路由: 获取 YouTube 音频流信息
 * GET /api/youtube/audio?videoId=VIDEO_ID
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')

    if (!videoId) {
      return NextResponse.json(
        { error: '缺少视频 ID' },
        { status: 400 }
      )
    }

    // 验证视频 ID 格式
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return NextResponse.json(
        { error: '无效的视频 ID' },
        { status: 400 }
      )
    }

    const audioInfo = await fetchAudioFromInvidious(videoId)

    return NextResponse.json(audioInfo, {
      headers: {
        // 缓存 1 小时
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('[YouTube Audio API] 错误:', error)
    
    return NextResponse.json(
      { 
        error: '获取音频失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
