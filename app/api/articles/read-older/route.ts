import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { days, cutoffDate: cutoffDateStr } = await req.json().catch(() => ({}))
    
    // 计算截止日期
    let cutoffDate: Date
    if (cutoffDateStr) {
      // 如果提供了具体的截止日期，使用它
      cutoffDate = new Date(cutoffDateStr)
    } else {
      // 否则使用 days 参数（默认1天前）
      cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - Number(days || 1))
    }

    // 1. 找出所有早于截止日期且用户未读的文章 ID
    // 注意：Prisma 不支持直接在 updateMany 中做 "NOT EXISTS" 的复杂过滤，
    // 所以我们需要分两步：先找出文章，再创建已读记录
    
    const articlesToMark = await prisma.article.findMany({
      where: {
        AND: [
          {
            pubDate: {
              not: null, // 必须有发布日期
            }
          },
          {
            pubDate: {
              lt: cutoffDate, // 发布日期早于截止日期
            }
          }
        ],
        // 只处理用户订阅的 feed 中的文章
        feed: {
          userId: session.user.id
        },
        // 过滤掉已经读过的
        readBy: {
          none: {
            userId: session.user.id
          }
        }
      },
      select: {
        id: true,
        pubDate: true // 用于调试
      }
    })

    if (articlesToMark.length === 0) {
      return NextResponse.json({ count: 0, message: "没有需要标记的文章" })
    }

    // 记录日志以便调试
    console.log(`[READ_OLDER] 找到 ${articlesToMark.length} 篇文章需要标记，截止日期: ${cutoffDate.toISOString()}`)

    // 2. 批量插入已读记录
    // Prisma 的 createMany 不支持 SQLite (如果项目用SQLite)，但这里是 PostgreSQL (从 schema 看)
    // schema.prisma 显示 provider = "postgresql"，所以可以使用 createMany
    
    const result = await prisma.readArticle.createMany({
      data: articlesToMark.map(article => ({
        userId: session.user.id,
        articleId: article.id
      })),
      skipDuplicates: true // 防止并发请求导致的唯一键冲突
    })

    console.log(`[READ_OLDER] 成功标记 ${result.count} 篇文章为已读`)

    return NextResponse.json({ 
      count: result.count,
      message: `已将 ${result.count} 篇旧文章标记为已读`
    })

  } catch (error) {
    console.error("[READ_OLDER]", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

