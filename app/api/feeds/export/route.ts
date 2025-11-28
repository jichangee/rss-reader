import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 导出订阅为OPML格式
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        feeds: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // 生成OPML格式
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS订阅导出</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${user.feeds.map(feed => `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.link || feed.url)}"/>`).join('\n')}
  </body>
</opml>`

    return new NextResponse(opml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="rss-feeds-${new Date().toISOString().split('T')[0]}.opml"`,
      },
    })
  } catch (error) {
    console.error("导出订阅失败:", error)
    return NextResponse.json({ error: "导出订阅失败" }, { status: 500 })
  }
}

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ""
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

