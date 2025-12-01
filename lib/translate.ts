/**
 * 翻译服务
 * 支持多种翻译API：Google Translate、小牛翻译、微软翻译
 */

import { translate } from '@vitalets/google-translate-api'

export type TranslationProvider = "google" | "niutrans" | "microsoft"

export interface TranslationConfig {
  provider: TranslationProvider
  googleApiKey?: string // 保留字段以兼容旧配置，但不再使用
  niutransApiKey?: string
  microsoftApiKey?: string
  microsoftRegion?: string
}

export interface TranslateOptions {
  text: string
  targetLanguage: string
  sourceLanguage?: string
  config: TranslationConfig
}

/**
 * 语言代码映射
 */
const languageCodeMap: Record<string, string> = {
  zh: "zh",
  en: "en",
  ja: "ja",
  ko: "ko",
  es: "es",
  fr: "fr",
  de: "de",
  ru: "ru",
  pt: "pt",
  it: "it",
  ar: "ar",
  hi: "hi",
}

/**
 * 将语言代码转换为各服务商支持的格式
 */
function normalizeLanguageCode(code: string, provider: TranslationProvider): string {
  const normalized = languageCodeMap[code] || code
  
  // 微软翻译需要 zh-Hans 而不是 zh
  if (provider === "microsoft" && normalized === "zh") {
    return "zh-Hans"
  }
  
  return normalized
}

/**
 * 使用Google Translate API进行翻译（使用 @vitalets/google-translate-api）
 */
async function translateWithGoogle({
  text,
  targetLanguage,
  sourceLanguage = "auto",
  config,
}: TranslateOptions): Promise<string> {
  try {
    if (!text || text.trim().length === 0) {
      return text
    }

    // 如果目标语言是中文且文本看起来已经是中文，跳过翻译
    if (targetLanguage === "zh" && /[\u4e00-\u9fa5]/.test(text)) {
      return text
    }

    const targetLang = normalizeLanguageCode(targetLanguage, "google")
    const translateOptions: { to: string; from?: string } = {
      to: targetLang,
    }

    // 如果指定了源语言且不是自动检测，则传入 from 参数
    if (sourceLanguage && sourceLanguage !== "auto") {
      translateOptions.from = normalizeLanguageCode(sourceLanguage, "google")
    }

    const result = await translate(text, translateOptions)
    
    return result.text || text
  } catch (error) {
    console.error("Google 翻译失败:", error)
    return text
  }
}

/**
 * 使用小牛翻译 API进行翻译
 */
async function translateWithNiutrans({
  text,
  targetLanguage,
  sourceLanguage = "auto",
  config,
}: TranslateOptions): Promise<string> {
  const apiKey = config.niutransApiKey

  if (!apiKey) {
    console.warn("小牛翻译 API Key 未设置，跳过翻译")
    return text
  }

  try {
    if (!text || text.trim().length === 0) {
      return text
    }

    // 如果目标语言是中文且文本看起来已经是中文，跳过翻译
    if (targetLanguage === "zh" && /[\u4e00-\u9fa5]/.test(text)) {
      return text
    }

    // 小牛翻译 API - 文本翻译服务只需要 API Key
    const url = "https://api.niutrans.com/NiuTransServer/translation"
    
    const requestBody: any = {
      apikey: apiKey,
      src_text: text,
      from: 'en',
      to: normalizeLanguageCode(targetLanguage, "niutrans"),
    }
    
    // 小牛翻译支持自动检测源语言，如果指定了源语言则传入
    if (sourceLanguage && sourceLanguage !== "auto") {
      requestBody.from = normalizeLanguageCode(sourceLanguage, "niutrans")
    }
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "未知错误" }))
      console.error("小牛翻译API错误:", JSON.stringify(errorData, null, 2))
      return text
    }

    const data = await response.json()
    console.log('data', data);
    
    if (data.tgt_text) {
      return data.tgt_text
    }

    return text
  } catch (error) {
    console.error("小牛翻译失败:", error)
    return text
  }
}

/**
 * 使用微软翻译 API进行翻译
 */
async function translateWithMicrosoft({
  text,
  targetLanguage,
  sourceLanguage = "auto",
  config,
}: TranslateOptions): Promise<string> {
  const apiKey = config.microsoftApiKey
  const region = config.microsoftRegion || "global"

  if (!apiKey) {
    console.warn("微软翻译 API Key 未设置，跳过翻译")
    return text
  }

  try {
    if (!text || text.trim().length === 0) {
      return text
    }

    // 如果目标语言是中文且文本看起来已经是中文，跳过翻译
    if (targetLanguage === "zh" && /[\u4e00-\u9fa5]/.test(text)) {
      return text
    }

    // 微软翻译 API v3
    const endpoint = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0`
    const targetLang = normalizeLanguageCode(targetLanguage, "microsoft")
    
    const params = new URLSearchParams({
      "to": targetLang,
    })
    
    if (sourceLanguage && sourceLanguage !== "auto") {
      params.append("from", normalizeLanguageCode(sourceLanguage, "microsoft"))
    }
    
    const url = `${endpoint}&${params.toString()}`
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Text: text }]),
    })

    if (!response.ok) {
      const errorData = await response.text().catch(() => "未知错误")
      console.error("微软翻译API错误:", errorData)
      return text
    }

    const data = await response.json()
    
    if (Array.isArray(data) && data[0]?.translations?.[0]?.text) {
      return data[0].translations[0].text
    }

    return text
  } catch (error) {
    console.error("微软翻译失败:", error)
    return text
  }
}


/**
 * 翻译文本（主函数）
 */
export async function translateText(options: TranslateOptions): Promise<string> {
  const { text, targetLanguage, config } = options

  // 如果目标语言未设置或为空，直接返回原文
  if (!targetLanguage || targetLanguage.trim() === "") {
    return text
  }

  // 如果文本为空，直接返回
  if (!text || text.trim().length === 0) {
    return text
  }

  // 根据配置的提供商选择翻译服务
  switch (config.provider) {
    case "google":
      return translateWithGoogle(options)
    case "niutrans":
      return translateWithNiutrans(options)
    case "microsoft":
      return translateWithMicrosoft(options)
    default:
      console.warn(`未知的翻译服务提供商: ${config.provider}`)
      return text
  }
}

/**
 * 批量翻译文本
 */
export async function translateTexts(
  texts: string[],
  targetLanguage: string,
  config: TranslationConfig,
  sourceLanguage?: string
): Promise<string[]> {
  if (!targetLanguage || texts.length === 0) {
    return texts
  }

  // 并行翻译所有文本
  const translations = await Promise.all(
    texts.map((text) =>
      translateText({
        text,
        targetLanguage,
        sourceLanguage,
        config,
      })
    )
  )

  return translations
}

/**
 * 清理HTML标签，提取纯文本用于翻译
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return ""
  
  // 简单的HTML标签移除
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
