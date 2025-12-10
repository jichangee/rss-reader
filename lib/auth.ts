import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
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
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user) {
        session.user.id = user.id
      }
      return session
    },
    // 用户登录时检查是否为管理员，自动设置角色
    signIn: async ({ user }) => {
      if (user.email && isAdminEmail(user.email)) {
        // 更新用户角色为管理员
        await prisma.user.update({
          where: { email: user.email },
          data: { role: 'admin' }
        })
      }
      return true
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "database",
  },
}

