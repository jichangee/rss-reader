import Parser from "rss-parser"

const parser = new Parser()

/**
 * RSS 解析结果，包含解析后的数据和缓存头信息
 */
export interface RSSParseResult {
  feed: Parser.Output<unknown>
  cacheHeaders?: {
    etag?: string
    "last-modified"?: string
  }
  notModified?: boolean // 是否为 304 Not Modified
}

/**
 * 带超时的RSS解析函数（支持HTTP条件请求）
 * @param url RSS feed的URL
 * @param timeoutMs 超时时间（毫秒），默认10秒
 * @param etag HTTP ETag（用于条件请求）
 * @param lastModified HTTP Last-Modified（用于条件请求）
 * @returns 解析后的RSS feed数据和缓存头信息
 */
export async function parseRSSWithTimeout(
  url: string,
  timeoutMs: number = 10000,
  etag?: string | null,
  lastModified?: string | null
): Promise<RSSParseResult> {
  return new Promise<RSSParseResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('RSS解析超时'))
    }, timeoutMs)

    // 构建请求头
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
    }

    // 添加条件请求头
    if (etag) {
      headers['If-None-Match'] = etag
    }
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified
    }

    // 使用 fetch 获取内容（支持条件请求）
    fetch(url, { headers })
      .then(async (response) => {
        clearTimeout(timeoutId)

        // 如果是 304 Not Modified，直接返回
        if (response.status === 304) {
          resolve({
            feed: {} as Parser.Output<unknown>,
            notModified: true,
          })
          return
        }

        if (!response.ok) {
          reject(new Error(`HTTP ${response.status}: ${response.statusText}`))
          return
        }

        // 提取缓存头
        const cacheHeaders: RSSParseResult['cacheHeaders'] = {}
        const etagHeader = response.headers.get('etag')
        const lastModifiedHeader = response.headers.get('last-modified')

        if (etagHeader) {
          cacheHeaders.etag = etagHeader
        }
        if (lastModifiedHeader) {
          cacheHeaders['last-modified'] = lastModifiedHeader
        }

        // 获取响应文本
        const text = await response.text()

        // 使用 rss-parser 解析内容
        parser.parseString(text)
          .then((feed) => {
            resolve({
              feed,
              cacheHeaders: Object.keys(cacheHeaders).length > 0 ? cacheHeaders : undefined,
            })
          })
          .catch((error) => {
            reject(error)
          })
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * 兼容旧版本的解析函数（不包含条件请求）
 * @deprecated 使用 parseRSSWithTimeout 替代
 */
export async function parseRSSWithTimeoutLegacy(url: string, timeoutMs: number = 10000) {
  const result = await parseRSSWithTimeout(url, timeoutMs)
  return result.feed
}

