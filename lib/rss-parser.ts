import { execFile } from "node:child_process"
import { promisify } from "node:util"
import Parser from "rss-parser"

const execFileAsync = promisify(execFile)

const parser = new Parser()

/** 部分站点（Cloudflare 等）会按 TLS 指纹拦截 Node 内置的 fetch，系统 curl 常能正常拉取。 */
const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

/** 在直连无法拿到合法 RSS 时抛出，便于 API 返回明确说明 */
export class RssFeedFetchBlockedError extends Error {
  constructor() {
    super(
      "该订阅源被防护策略拦截，服务器无法直接抓取。本地若已安装 curl 通常会优先通过 curl 拉取；若仍失败，请在环境变量 RSS_FEED_PROXY_TEMPLATE 中配置抓取代理（URL 模板，需包含 {url} 占位符）。"
    )
    this.name = "RssFeedFetchBlockedError"
  }
}

function isLikelyBlockedHtml(body: string, status: number): boolean {
  if (status === 403 || status === 401) return true
  const t = body.trimStart()
  const lower = t.slice(0, 120).toLowerCase()
  if (lower.startsWith("<!doctype") || lower.startsWith("<html")) return true
  if (
    body.includes("cf-browser-verification") ||
    body.includes("Just a moment") ||
    body.includes("Attention Required! | Cloudflare")
  ) {
    return true
  }
  return false
}

function looksLikeFeedXml(body: string): boolean {
  const t = body.trimStart()
  return (
    t.startsWith("<?xml") ||
    t.startsWith("<rss") ||
    t.startsWith("<feed") ||
    t.startsWith("<rdf:RDF")
  )
}

async function fetchViaSystemCurl(url: string, timeoutSec: number): Promise<string | undefined> {
  if (process.env.RSS_DISABLE_SYSTEM_CURL === "1") return undefined
  try {
    const { stdout } = await execFileAsync(
      curlBinary(),
      [
        "-sL",
        "--compressed",
        "--max-time",
        String(Math.max(1, timeoutSec)),
        "-A",
        FETCH_HEADERS["User-Agent"],
        "-H",
        `Accept: ${FETCH_HEADERS.Accept}`,
        url,
      ],
      { maxBuffer: 15 * 1024 * 1024 },
    )
    return stdout
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { stdout?: string }
    if (err.code === "ENOENT") return undefined
    if (typeof err.stdout === "string" && err.stdout.length > 0) return err.stdout
    return undefined
  }
}

/** 允许通过 RSS_CURL_BINARY 指定 curl 路径（可选） */
function curlBinary(): string {
  return process.env.RSS_CURL_BINARY?.trim() || "curl"
}

async function fetchFeedXml(url: string, timeoutMs: number): Promise<string> {
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000))

  const curlBody = await fetchViaSystemCurl(url, timeoutSec)
  if (curlBody?.length && looksLikeFeedXml(curlBody)) return curlBody

  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined

  const fetchDirect = async (target: string): Promise<string> => {
    const res = await fetch(target, {
      redirect: "follow",
      headers: FETCH_HEADERS,
      ...(signal ? { signal } : {}),
    })
    const text = await res.text()
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) throw new RssFeedFetchBlockedError()
      throw new Error(`Status code ${res.status}`)
    }
    if (isLikelyBlockedHtml(text, res.status)) throw new RssFeedFetchBlockedError()
    if (!looksLikeFeedXml(text)) throw new RssFeedFetchBlockedError()
    return text
  }

  try {
    return await fetchDirect(url)
  } catch (e) {
    const tpl = process.env.RSS_FEED_PROXY_TEMPLATE?.trim()
    const shouldTryProxy =
      tpl &&
      (e instanceof RssFeedFetchBlockedError ||
        (e instanceof Error && /^Status code 403/.test(e.message)))
    if (shouldTryProxy) {
      try {
        return await fetchDirect(tpl.replace("{url}", encodeURIComponent(url)))
      } catch {
        // 使用首次错误（更贴近「源站不可达」）
      }
    }
    throw e
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === "AbortError") return true
  if (error.name === "TimeoutError") return true
  return false
}

/**
 * 带超时的 RSS 解析：优先系统 curl，其次 fetch；可选 RSS_FEED_PROXY_TEMPLATE。
 */
export async function parseRSSWithTimeout(url: string, timeoutMs: number = 10000) {
  try {
    const xml = await fetchFeedXml(url, timeoutMs)
    return await parser.parseString(xml)
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error("RSS解析超时")
    }
    throw error
  }
}
