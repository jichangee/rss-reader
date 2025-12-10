import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 获取用户详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: userId } = await params
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        feeds: {
          select: {
            id: true,
            title: true,
            url: true,
            createdAt: true,
            _count: {
              select: {
                articles: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        readArticles: {
          select: {
            id: true,
            readAt: true,
            article: {
              select: {
                id: true,
                title: true,
                link: true
              }
            }
          },
          orderBy: {
            readAt: 'desc'
          },
          take: 10
        },
        webhooks: {
          select: {
            id: true,
            name: true,
            url: true,
            enabled: true
          }
        },
        _count: {
          select: {
            feeds: true,
            readArticles: true,
            readLater: true,
            webhooks: true
          }
        }
      }
    })
    
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "view_user_detail",
      targetType: "user",
      targetId: userId,
      request
    })
    
    return NextResponse.json(user)
  } catch (error: unknown) {
    console.error("获取用户详情失败:", error)
    const errorMessage = error instanceof Error ? error.message : "获取用户详情失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}

// 更新用户
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: userId } = await params
    const body = await request.json()
    
    const { role } = body
    
    // 验证角色
    if (role && !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 })
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    })
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "update_user",
      targetType: "user",
      targetId: userId,
      details: { changes: { role } },
      request
    })
    
    return NextResponse.json(user)
  } catch (error: unknown) {
    console.error("更新用户失败:", error)
    const errorMessage = error instanceof Error ? error.message : "更新用户失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}

// 删除用户
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: userId } = await params
    
    // 防止管理员删除自己
    if (admin.id === userId) {
      return NextResponse.json({ error: "不能删除自己的账号" }, { status: 400 })
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    })
    
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }
    
    // 删除用户（级联删除相关数据）
    await prisma.user.delete({
      where: { id: userId }
    })
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "delete_user",
      targetType: "user",
      targetId: userId,
      details: { email: user.email, name: user.name },
      request
    })
    
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("删除用户失败:", error)
    const errorMessage = error instanceof Error ? error.message : "删除用户失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
