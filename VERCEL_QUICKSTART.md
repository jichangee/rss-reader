# Vercel 快速部署指南 🚀

5 分钟快速将 RSS 阅读器部署到 Vercel。

## 前提条件

- GitHub 账号
- Vercel 账号（可使用 GitHub 登录）
- Google OAuth 凭据

## 快速部署步骤

### 1️⃣ 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/rss-reader.git
git push -u origin main
```

### 2️⃣ 在 Vercel 导入项目

1. 访问 [vercel.com/new](https://vercel.com/new)
2. 选择你的 `rss-reader` 仓库
3. 点击 "Import"
4. **暂不部署**，先进行配置

### 3️⃣ 创建数据库

1. 点击 "Storage" 标签
2. 点击 "Create Database"
3. 选择 **"Postgres"**
4. 选择区域（推荐：离用户最近的区域）
5. 点击 "Create"
6. 点击 "Connect Project" 连接到你的项目

✅ Vercel 会自动添加数据库环境变量

### 4️⃣ 配置环境变量

在项目设置 → Environment Variables 中添加：

```bash
# 数据库（使用 Vercel 自动注入的变量）
DATABASE_URL=${POSTGRES_URL}
DIRECT_URL=${POSTGRES_URL_NON_POOLING}

# NextAuth（替换为实际值）
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=[运行: openssl rand -base64 32]

# Google OAuth（从 Google Cloud Console 获取）
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**重要**: 确保所有变量都选择应用于 **Production** 环境。

### 5️⃣ 更新 Google OAuth 配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目 → API 和服务 → 凭据
3. 编辑 OAuth 2.0 客户端
4. 在授权重定向 URI 中添加：
   ```
   https://your-app-name.vercel.app/api/auth/callback/google
   ```
5. 保存

### 6️⃣ 初始化数据库

安装 Vercel CLI 并初始化数据库：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 链接项目
vercel link

# 拉取环境变量
vercel env pull .env.local

# 推送数据库模式
npx prisma db push
```

### 7️⃣ 部署！

```bash
# 使用 CLI 部署
vercel --prod

# 或者在 Vercel Dashboard 点击 "Deploy"
```

等待构建完成（约 2-3 分钟）

### 8️⃣ 测试应用

访问你的应用：`https://your-app-name.vercel.app`

测试以下功能：
- ✅ Google 登录
- ✅ 添加 RSS 订阅
- ✅ 查看文章
- ✅ 标记已读

## 🎉 部署完成！

你的 RSS 阅读器现在已在 Vercel 上运行，享受：
- ⚡️ 全球 CDN 加速
- 🔄 自动部署（推送即部署）
- 📊 实时分析和日志
- 🔒 HTTPS 加密
- 🌍 高可用性

## 📝 环境变量快速参考

| 变量 | 值 | 说明 |
|------|-----|------|
| `DATABASE_URL` | `${POSTGRES_URL}` | Prisma 连接池 |
| `DIRECT_URL` | `${POSTGRES_URL_NON_POOLING}` | Prisma 直连 |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | 应用地址 |
| `NEXTAUTH_SECRET` | 随机密钥（32+ 字符） | 会话加密 |
| `GOOGLE_CLIENT_ID` | 从 Google Console 获取 | OAuth ID |
| `GOOGLE_CLIENT_SECRET` | 从 Google Console 获取 | OAuth 密钥 |

## 🔧 常见问题

### ❌ 登录失败
- 检查 `NEXTAUTH_URL` 是否正确
- 确认 Google OAuth 重定向 URI 已添加

### ❌ 数据库连接错误
- 运行 `npx prisma db push`
- 确认环境变量已正确配置

### ❌ 构建失败
- 查看 Vercel Build Logs
- 确认所有依赖已在 `package.json` 中

## 📚 详细文档

- **完整部署指南**: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- **部署检查清单**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **项目文档**: [README.md](./README.md)

## 🆘 获取帮助

遇到问题？
1. 查看 Vercel Function Logs
2. 检查浏览器控制台
3. 参考详细部署文档

## 🔄 后续部署

每次推送到 `main` 分支，Vercel 会自动部署：

```bash
git add .
git commit -m "Update features"
git push
```

自动部署约需 2-3 分钟。

---

**提示**: 保存你的 Vercel 项目 URL 和环境变量配置以便后续维护。

