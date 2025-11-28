/**
 * 翻译服务
 * 支持多种翻译API，目前使用Google Translate API
 */

interface TranslateOptions {
  text: string
  targetLanguage: string
  sourceLanguage?: string
}

/**
 * 使用Google Translate API进行翻译
 */
async function translateWithGoogle({
  text,
  targetLanguage,
  sourceLanguage = "auto",
}: TranslateOptions): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY

  if (!apiKey) {
    console.warn("GOOGLE_TRANSLATE_API_KEY 未设置，跳过翻译")
    return text
  }

  try {
    // 如果文本为空或太短，直接返回
    if (!text || text.trim().length === 0) {
      return text
    }

    // 如果目标语言是中文且文本看起来已经是中文，跳过翻译
    if (targetLanguage === "zh" && /[\u4e00-\u9fa5]/.test(text)) {
      return text
    }

    // 使用Google Translate API v2
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`
    
    // 构建请求体，如果 sourceLanguage 是 "auto" 或未指定，则不传递 source 参数
    // Google Translate API 会自动检测源语言
    const requestBody: any = {
      q: text,
      target: targetLanguage,
      format: "html", // 支持HTML格式
    }
    
    // 只有当 sourceLanguage 明确指定且不是 "auto" 时才添加 source 参数
    if (sourceLanguage && sourceLanguage !== "auto") {
      requestBody.source = sourceLanguage
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
      console.error("翻译API错误:", JSON.stringify(errorData, null, 2))
      // 如果API调用失败，返回原文而不是抛出错误
      return text
    }

    const data = await response.json()
    
    if (data.data?.translations?.[0]?.translatedText) {
      const translatedText = data.data.translations[0].translatedText
      // 检查翻译结果是否与原文相同（可能源语言和目标语言相同）
      if (translatedText === text && targetLanguage !== "zh") {
        console.warn(`[翻译警告] 翻译结果与原文相同，目标语言=${targetLanguage}，可能源语言与目标语言相同`)
      }
      return translatedText
    }

    // 如果没有翻译结果，返回原文
    console.warn(`[翻译警告] API返回了空结果，目标语言=${targetLanguage}`)
    return text
  } catch (error) {
    console.error("翻译失败:", error)
    return text
  }
}

/**
 * 翻译文本（主函数）
 */
export async function translateText(options: TranslateOptions): Promise<string> {
  const { text, targetLanguage } = options

  // 如果目标语言未设置或为空，直接返回原文
  if (!targetLanguage || targetLanguage.trim() === "") {
    return text
  }

  // 如果文本为空，直接返回
  if (!text || text.trim().length === 0) {
    return text
  }

  // 使用Google Translate
  return translateWithGoogle(options)
}

/**
 * 批量翻译文本
 */
export async function translateTexts(
  texts: string[],
  targetLanguage: string,
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

