# RSS 阅读器

一个现代化的 RSS 阅读器应用，支持 Google 账号登录和多源 RSS 订阅管理。

## 功能特性

- ✅ **Google 账号登录** - 使用 NextAuth.js 实现安全的 Google OAuth 认证
- ✅ **RSS 订阅管理** - 添加、删除和刷新多个 RSS 源
- ✅ **文章阅读** - 优雅的文章列表展示和阅读体验
- ✅ **已读标记** - 自动标记已读文章
- ✅ **过滤功能** - 支持仅显示未读文章
- ✅ **响应式设计** - 适配桌面和移动设备
- ✅ **暗色模式支持** - 内置深色主题

## 技术栈

- **框架**: Next.js 16 (App Router)
- **认证**: NextAuth.js
- **数据库**: Prisma + SQLite
- **RSS 解析**: rss-parser
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **类型**: TypeScript

## 快速开始

### 1. 环境准备

确保已安装 Node.js 18+ 和 pnpm（或 npm/yarn）。

### 2. 安装依赖

```bash
pnpm install
# 或
npm install
```

### 3. 配置环境变量

创建 `.env` 文件并添加以下配置：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 4. 获取 Google OAuth 凭据

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID：
   - 应用类型：Web 应用
   - 授权的重定向 URI：`http://localhost:3000/api/auth/callback/google`
5. 复制客户端 ID 和客户端密钥到 `.env` 文件

### 5. 初始化数据库

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. 启动开发服务器

```bash
pnpm dev
# 或
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始使用。

## 使用说明

### 添加 RSS 订阅

1. 登录后点击侧边栏的"添加订阅"按钮
2. 输入 RSS 源的 URL（例如：`https://hnrss.org/frontpage`）
3. 点击"添加订阅"

### 管理订阅

- **查看文章**：点击侧边栏的订阅源名称
- **删除订阅**：悬停在订阅源上，点击出现的删除图标
- **刷新订阅**：点击"刷新"按钮更新所有订阅源

### 阅读文章

- 点击文章标题或外链图标在新标签页打开原文
- 文章被点击后自动标记为已读
- 使用"仅未读"按钮过滤未读文章

## 常见 RSS 源示例

- Hacker News: `https://hnrss.org/frontpage`
- Reddit Programming: `https://www.reddit.com/r/programming/.rss`
- BBC News: `https://feeds.bbci.co.uk/news/rss.xml`
- The Verge: `https://www.theverge.com/rss/index.xml`

## 项目结构

```
rss-reader/
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/         # NextAuth 认证
│   │   ├── feeds/        # RSS 订阅管理
│   │   └── articles/     # 文章管理
│   ├── components/       # React 组件
│   ├── dashboard/        # 主界面
│   ├── login/           # 登录页面
│   └── layout.tsx       # 根布局
├── lib/
│   ├── auth.ts          # NextAuth 配置
│   └── prisma.ts        # Prisma 客户端
├── prisma/
│   └── schema.prisma    # 数据库模型
└── types/               # TypeScript 类型定义
```

## 数据库模型

- **User**: 用户信息
- **Account**: OAuth 账号信息
- **Session**: 用户会话
- **Feed**: RSS 订阅源
- **Article**: RSS 文章
- **ReadArticle**: 已读文章记录

## API 端点

### 认证
- `POST /api/auth/[...nextauth]` - NextAuth 认证处理

### 订阅管理
- `GET /api/feeds` - 获取用户的所有订阅
- `POST /api/feeds` - 添加新订阅
- `DELETE /api/feeds/[id]` - 删除订阅
- `POST /api/feeds/refresh` - 刷新所有订阅

### 文章管理
- `GET /api/articles` - 获取文章列表
- `POST /api/articles/[id]/read` - 标记文章为已读
- `DELETE /api/articles/[id]/read` - 取消已读标记

## 🚀 部署到 Vercel

本项目已针对 Vercel 部署进行完整优化。

### ⚡️ 快速部署（5 分钟）

查看 **[VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md)** 快速开始

### 📋 部署前检查

使用 **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** 确保所有配置正确

### 📖 详细部署指南

查看 **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** 获取完整步骤和故障排查

### 关键步骤概览

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 创建 Vercel Postgres 数据库
4. 配置 6 个环境变量
5. 初始化数据库: `npx prisma db push`
6. 部署完成！

### 必需的环境变量

```bash
DATABASE_URL=${POSTGRES_URL}
DIRECT_URL=${POSTGRES_URL_NON_POOLING}
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=[随机密钥]
GOOGLE_CLIENT_ID=[你的ID]
GOOGLE_CLIENT_SECRET=[你的密钥]
```

## 开发计划

- [ ] 添加文章搜索功能
- [ ] 支持文章收藏
- [ ] 添加标签分类
- [ ] 支持 OPML 导入/导出
- [ ] 添加阅读统计
- [ ] 支持全文抓取
- [ ] PWA 支持

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
