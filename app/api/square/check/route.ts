import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * 检查广场是否有数据
 * GET /api/square/check
 * 
 * 返回：{ hasData: boolean }
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ hasData: false })
    }

    // 检查是否有任何热度数据
    const hotnessCount = await prisma.articleHotness.count({
      where: {
        hotScore: {
          gt: 0
        }
      }
    })

    return NextResponse.json({ hasData: hotnessCount > 0 })
  } catch (error) {
    console.error("检查广场数据失败:", error)
    return NextResponse.json({ hasData: false })
  }
}
