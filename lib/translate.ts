"use client"

import type { Article } from "@/app/components/ArticleList/types"

type ArticleTranslation = Pick<Article, "title" | "content" | "contentSnippet">

function getArticleTextNodes(template: HTMLTemplateElement): Text[] {
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.data.trim() && !node.parentElement?.closest("script, style, textarea")) {
      nodes.push(node)
    }
  }

  return nodes
}

async function translateArticle(article: Article, targetLanguage: string): Promise<ArticleTranslation | null> {
  const template = document.createElement("template")
  template.innerHTML = article.content || ""
  const nodes = getArticleTextNodes(template)
  const texts = [article.title, article.contentSnippet || "", ...nodes.map((node) => node.data.trim())]

  if (targetLanguage === "zh" && texts.some((text) => /[\u4e00-\u9fa5]/.test(text))) return null

  // 用编号对应各段译文，正文只替换文本节点以保留原来的链接、媒体和格式。
  const text = texts.map((part, index) => `|||#${index}#|||\n\n${part}`).join("\n\n")
  const response = await fetch("https://translate.googleapis.com/translate_a/single?client=at&dt=t&dj=1", {
    method: "POST",
    body: new URLSearchParams({ sl: "auto", tl: targetLanguage, q: text }),
  })

  if (!response.ok) return null

  const data: { sentences?: { trans?: string }[] } = await response.json()
  const result = data.sentences?.map((sentence) => sentence.trans).join("") || ""
  const parts = result.split(/\|\|\|#(\d+)#\|\|\|/)
  if (parts.length !== texts.length * 2 + 1 || texts.some((_, index) => parts[index * 2 + 1] !== String(index))) {
    return null
  }

  const [title, snippet, ...body] = texts.map((original, index) => parts[index * 2 + 2].trim() || original)
  nodes.forEach((node, index) => {
    node.data = node.data.replace(node.data.trim(), () => body[index])
  })

  return {
    title,
    content: article.content ? template.innerHTML : article.content,
    contentSnippet: article.contentSnippet ? snippet : article.contentSnippet,
  }
}

export async function translateArticles(articles: Article[], targetLanguage: string) {
  const translations = new Map<string, ArticleTranslation>()

  await Promise.all(articles.map(async (article) => {
    try {
      const translation = await translateArticle(article, targetLanguage)
      if (translation) translations.set(article.id, translation)
    } catch (error) {
      console.error("翻译文章失败:", error)
    }
  }))

  return translations
}
