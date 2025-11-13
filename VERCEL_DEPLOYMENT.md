# Vercel 部署指南

本指南将帮助你将 RSS 阅读器部署到 Vercel，并配置 Vercel Postgres 数据库。

## 🚀 部署步骤

### 1. 准备工作

#### 1.1 将代码推送到 GitHub

```bash
# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: RSS Reader"

# 添加远程仓库
git remote add origin https://github.com/your-username/rss-reader.git

# 推送到 GitHub
git push -u origin main
```

#### 1.2 注册 Vercel 账号

访问 [vercel.com](https://vercel.com) 并使用 GitHub 账号登录。

### 2. 创建 Vercel 项目

#### 2.1 导入 GitHub 仓库

1. 在 Vercel 仪表板点击 "Add New..."
2. 选择 "Project"
3. 选择你的 GitHub 仓库 `rss-reader`
4. 点击 "Import"

#### 2.2 配置项目设置

保持默认设置：
- **Framework Preset**: Next.js
- **Root Directory**: ./
- **Build Command**: `next build`
- **Output Directory**: `.next`

**暂时不要点击 "Deploy"**，先配置数据库。

### 3. 配置 Vercel Postgres 数据库

#### 3.1 创建数据库

1. 在 Vercel 项目页面，点击 "Storage" 标签
2. 点击 "Create Database"
3. 选择 "Postgres"
4. 选择区域（推荐选择离你最近的区域）
5. 点击 "Create"

#### 3.2 连接数据库到项目

1. 数据库创建后，点击 "Connect Project"
2. 选择你的 RSS Reader 项目
3. Vercel 会自动添加以下环境变量到你的项目：
   - `POSTGRES_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`
   - `POSTGRES_HOST`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

### 4. 配置环境变量

#### 4.1 在 Vercel 中添加环境变量

返回项目设置页面：

1. 点击 "Environment Variables" 标签
2. 添加以下环境变量：

**数据库配置**（Vercel 已自动添加，但需要映射）:

```
DATABASE_URL = ${POSTGRES_URL}
DIRECT_URL = ${POSTGRES_URL_NON_POOLING}
```

**NextAuth 配置**:

```
NEXTAUTH_URL = https://your-app-name.vercel.app
NEXTAUTH_SECRET = [运行 openssl rand -base64 32 生成]
```

**Google OAuth 配置**:

```
GOOGLE_CLIENT_ID = your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = your-google-client-secret
```

#### 4.2 更新 Google OAuth 重定向 URI

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 进入 "API 和服务" → "凭据"
4. 编辑你的 OAuth 2.0 客户端
5. 在"授权的重定向 URI"中添加：
   ```
   https://your-app-name.vercel.app/api/auth/callback/google
   ```
6. 保存

### 5. 初始化数据库

#### 5.1 推送数据库模式

在本地运行：

```bash
# 确保使用 PostgreSQL 配置
# 临时设置 Vercel 提供的数据库 URL
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."

# 推送数据库模式
npx prisma db push

# 或者使用迁移
npx prisma migrate deploy
```

**注意**: 你可以从 Vercel 项目的 Storage → Postgres → .env.local 标签中复制数据库连接字符串。

#### 5.2 （推荐）使用 Vercel CLI

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

### 6. 部署应用

#### 6.1 首次部署

在 Vercel 项目页面点击 "Deploy"，或者使用命令行：

```bash
vercel --prod
```

#### 6.2 后续部署

每次推送到 GitHub 的 main 分支，Vercel 会自动部署：

```bash
git add .
git commit -m "Update features"
git push
```

### 7. 验证部署

1. 访问你的应用 URL: `https://your-app-name.vercel.app`
2. 测试 Google 登录
3. 测试添加 RSS 订阅
4. 测试文章阅读功能

## 🔧 环境变量完整清单

在 Vercel 项目设置中配置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `${POSTGRES_URL}` | Prisma 连接池 URL |
| `DIRECT_URL` | `${POSTGRES_URL_NON_POOLING}` | Prisma 直连 URL |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | 应用 URL |
| `NEXTAUTH_SECRET` | `[生成的密钥]` | NextAuth 密钥 |
| `GOOGLE_CLIENT_ID` | `[你的客户端ID]` | Google OAuth ID |
| `GOOGLE_CLIENT_SECRET` | `[你的密钥]` | Google OAuth Secret |

## 📊 使用 Prisma Studio 管理数据库

```bash
# 拉取环境变量
vercel env pull .env.local

# 打开 Prisma Studio
npx prisma studio
```

## 🔍 常见问题

### Q1: 部署失败，提示数据库连接错误

**解决方案**:
1. 确认 `DATABASE_URL` 和 `DIRECT_URL` 已正确配置
2. 确认数据库模式已推送: `npx prisma db push`
3. 检查 Vercel 日志获取详细错误信息

### Q2: Google 登录失败

**解决方案**:
1. 确认 `NEXTAUTH_URL` 指向正确的 Vercel URL
2. 确认 Google Cloud Console 中添加了正确的重定向 URI
3. 确认 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 正确

### Q3: 环境变量未生效

**解决方案**:
1. 在 Vercel 中修改环境变量后需要重新部署
2. 确保环境变量应用于 "Production" 环境
3. 可以在 Vercel 项目设置中查看环境变量是否正确

### Q4: 数据库迁移问题

**解决方案**:
```bash
# 重置数据库（慎用，会删除所有数据）
npx prisma migrate reset

# 重新推送模式
npx prisma db push
```

### Q5: Prisma Client 生成失败

**解决方案**:
在 `package.json` 中已配置 `postinstall` 脚本，会自动运行 `prisma generate`。
如果仍有问题，可以在 Vercel 项目设置中添加构建命令：
```
prisma generate && next build
```

## 🎯 性能优化建议

### 1. 启用 Edge Runtime（可选）

在适合的 API 路由中添加：

```typescript
export const runtime = 'edge'
```

### 2. 配置缓存

在 `next.config.ts` 中配置适当的缓存策略。

### 3. 图片优化

使用 Next.js Image 组件优化图片加载。

### 4. 连接池配置

Vercel Postgres 自动提供连接池，但可以在 Prisma 中调整：

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
```

## 🔒 安全检查清单

部署前确认：

- [ ] 所有环境变量已正确配置
- [ ] `NEXTAUTH_SECRET` 使用强随机密钥
- [ ] Google OAuth 重定向 URI 正确配置
- [ ] 数据库连接字符串安全存储（不要提交到 Git）
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] OAuth 同意屏幕已发布（非测试模式）

## 📈 监控和调试

### 查看日志

在 Vercel 项目页面：
1. 点击 "Deployments" 标签
2. 选择一个部署
3. 查看 "Function Logs" 和 "Build Logs"

### 实时日志

```bash
vercel logs your-app-name.vercel.app
```

### 数据库查询监控

在 Vercel 项目的 Storage → Postgres → Insights 中查看查询性能。

## 🔄 回滚部署

如果出现问题，可以快速回滚：

1. 在 Vercel 项目页面，点击 "Deployments"
2. 找到之前的稳定版本
3. 点击 "..." → "Promote to Production"

## 📚 相关资源

- [Vercel 文档](https://vercel.com/docs)
- [Vercel Postgres 文档](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)

## 💡 提示

1. **使用 Vercel CLI** 可以更方便地管理部署和环境变量
2. **Preview 部署** 每个 PR 都会创建一个预览环境，方便测试
3. **分析工具** Vercel 提供内置的性能分析工具
4. **自定义域名** 可以在 Vercel 项目设置中添加自定义域名

---

部署完成后，你的 RSS 阅读器将在全球 CDN 上运行，享受极快的访问速度！🚀

