import Parser from "rss-parser"

const parser = new Parser()

/**
 * 带超时的RSS解析函数
 * @param url RSS feed的URL
 * @param timeoutMs 超时时间（毫秒），默认10秒
 * @returns 解析后的RSS feed数据
 */
export async function parseRSSWithTimeout(url: string, timeoutMs: number = 10000) {
  return new Promise<Parser.Output<unknown>>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('RSS解析超时'))
    }, timeoutMs)

    parser.parseURL(url)
      .then((feed) => {
        clearTimeout(timeoutId)
        resolve(feed)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

