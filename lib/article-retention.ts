import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const shanghaiDate = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai" })

export function articleRetentionCutoff(now: number): Date {
  return new Date(now - 7 * 24 * 60 * 60 * 1000)
}

export async function recordFeedRefresh(
  user: Pick<User, "id" | "lastRefreshRequestAt">,
  now: Date
) {
  const updateUser = prisma.user.update({
    where: { id: user.id },
    data: { lastRefreshRequestAt: now, lastActiveAt: now },
  })

  if (user.lastRefreshRequestAt && shanghaiDate.format(user.lastRefreshRequestAt) === shanghaiDate.format(now)) {
    await updateUser
    return
  }

  const cutoff = articleRetentionCutoff(now.getTime())
  const [{ count }] = await prisma.$transaction([
    prisma.article.deleteMany({
      where: {
        feed: { userId: user.id },
        OR: [
          { pubDate: { lt: cutoff } },
          { pubDate: null, createdAt: { lt: cutoff } },
        ],
      },
    }),
    updateUser,
  ])

  console.log(`每日首次刷新清理了 ${count} 篇旧文章 (userId=${user.id})`)
}
