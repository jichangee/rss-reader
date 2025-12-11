import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import { isAdminEmail } from "./admin"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      id: "email-code",
      name: "邮箱验证码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        code: { label: "验证码", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) {
          return null
        }

        // 验证验证码
        const verificationCode = await prisma.emailVerificationCode.findFirst({
          where: {
            email: credentials.email,
            code: credentials.code,
            used: false,
            expiresAt: {
              gt: new Date()
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        if (!verificationCode) {
          return null
        }

        // 标记验证码为已使用
        await prisma.emailVerificationCode.update({
          where: { id: verificationCode.id },
          data: { used: true }
        })

        // 查找或创建用户
        let user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
            }
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        }
      }
    }),
  ],
  callbacks: {
    session: async ({ session, user, token }) => {
      if (session?.user) {
        // 对于数据库策略，使用user.id
        if (user) {
          session.user.id = user.id
        } else if (token?.sub) {
          // 对于JWT策略（credentials登录），使用token.sub
          session.user.id = token.sub
        }
      }
      return session
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id
      }
      return token
    },
    // 用户登录时检查是否为管理员，自动设置角色
    signIn: async ({ user, account }) => {
      if (user.email && isAdminEmail(user.email)) {
        // 更新用户角色为管理员
        await prisma.user.update({
          where: { email: user.email },
          data: { role: 'admin' }
        })
      }

      // 对于credentials登录，需要手动创建session
      if (account?.provider === "email-code") {
        return true
      }

      return true
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt", // 改为JWT策略以支持credentials登录
  },
}

