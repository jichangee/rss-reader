import { NextResponse } from "next/server"
import { checkAdmin, logAdminAction } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

// 删除文章
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin()
    const { id: articleId } = await params
    
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { title: true, link: true, feedId: true }
    })
    
    if (!article) {
      return NextResponse.json({ error: "文章不存在" }, { status: 404 })
    }
    
    // 删除文章
    await prisma.article.delete({
      where: { id: articleId }
    })
    
    // 记录操作
    await logAdminAction({
      adminId: admin.id,
      action: "delete_article",
      targetType: "article",
      targetId: articleId,
      details: { title: article.title, link: article.link, feedId: article.feedId },
      request
    })
    
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("删除文章失败:", error)
    const errorMessage = error instanceof Error ? error.message : "删除文章失败"
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage === "Forbidden: Admin access required" ? 403 : 500 }
    )
  }
}
