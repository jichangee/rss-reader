import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicArticleExport } from "@/lib/public-article-export"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ExternalLink, Rss } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "文章导出",
  robots: { index: false, follow: false },
}

export default async function PublicArticleExportPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const data = await getPublicArticleExport(userId)

  if (!data) {
    notFound()
  }

  const generatedLabel = format(new Date(data.generatedAt), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">RSS 阅读器 · 公开导出</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{data.displayName} 的订阅文章</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            最近 24 小时内更新，最多 500 篇（已排除稍后读）。数据在首次访问后缓存 4 小时，仅在有人打开本页时刷新。
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            本页生成时间（或缓存时间）：{generatedLabel} · 共 {data.articleCount} 篇
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {data.articles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            最近 24 小时内没有符合条件的文章。
          </p>
        ) : (
          <ol className="space-y-6">
            {data.articles.map((article, index) => (
              <li
                key={article.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/10"
              >
                <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Rss className="h-4 w-4 shrink-0" />
                  <span className="truncate">{article.feedTitle}</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold leading-snug">
                    <span className="mr-2 text-gray-400 dark:text-gray-500">{index + 1}.</span>
                    {article.title}
                  </h2>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-gray-50 dark:border-gray-600 dark:text-indigo-400 dark:hover:bg-gray-700/50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    原文
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {article.pubDate && (
                    <span>
                      {format(new Date(article.pubDate), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                    </span>
                  )}
                  {article.author && <span>作者：{article.author}</span>}
                </div>
                {article.preview && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {article.preview}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
