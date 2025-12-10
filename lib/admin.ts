import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./prisma"

/**
 * 检查用户是否为管理员
 */
export async function checkAdmin() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, name: true }
  })
  
  if (!user || user.role !== 'admin') {
    throw new Error("Forbidden: Admin access required")
  }
  
  return user
}

/**
 * 检查邮箱是否为管理员邮箱（从环境变量读取）
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || []
  return adminEmails.includes(email)
}

/**
 * 记录管理员操作日志
 */
export async function logAdminAction(params: {
  adminId: string
  action: string
  targetType?: string
  targetId?: string
  details?: any
  request?: Request
}) {
  const { adminId, action, targetType, targetId, details, request } = params
  
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        details: details ? JSON.stringify(details) : null,
        ipAddress: request ? getIpAddress(request) : null,
        userAgent: request ? request.headers.get('user-agent') : null,
      }
    })
  } catch (error) {
    console.error('Failed to log admin action:', error)
  }
}

/**
 * 获取请求的 IP 地址
 */
function getIpAddress(request: Request): string | null {
  // 尝试从各种可能的头部获取 IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  return null
}
