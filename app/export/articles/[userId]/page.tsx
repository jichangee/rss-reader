import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { formatPublicExportAsMarkdown, getPublicArticleExport } from "@/lib/public-article-export"

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

  const markdown = formatPublicExportAsMarkdown(data)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 shadow-sm whitespace-pre-wrap break-words font-mono dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 sm:p-6 sm:text-[15px]">
          {markdown}
        </pre>
      </main>
    </div>
  )
}
