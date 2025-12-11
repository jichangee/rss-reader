import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取订阅源详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: feedId } = await params
    
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        articles: {
          select: {
            id: true,
            title: true,
            link: true,
            pubDate: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        webhooks: {
          select: {
            id: true,
            webhook: {
              select: {
                id: true,
                name: true,
                url: true,
                enabled: true
              }
            }
          }
        },
        _count: {
          select: {
            articles: true,
            webhooks: true
          }
        }
      }
    })
    
    if (!feed) {
      return NextResponse.json({ error: "订阅源不存在" }, { status: 404 })
    }
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_feed_detail",
      targetType: "feed",
      targetId: feedId,
      request
    })
    
    return NextResponse.json(feed)
  } catch (error: unknown) {
    console.error("获取订阅源详情失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取订阅源详情失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}

// 删除订阅源
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: feedId } = await params
    
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      select: { title: true, url: true, userId: true }
    })
    
    if (!feed) {
      return NextResponse.json({ error: "订阅源不存在" }, { status: 404 })
    }
    
    // 删除订阅源（级联删除相关数据）
    await prisma.feed.delete({
      where: { id: feedId }
    })
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "delete_feed",
      targetType: "feed",
      targetId: feedId,
      details: { title: feed.title, url: feed.url, userId: feed.userId },
      request
    })
    
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("删除订阅源失败:", error)
    const errorMessage = error instanceof Error ? error.message : "删除订阅源失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
