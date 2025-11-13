# Vercel 部署配置变更总结

## 🎯 目标

将 RSS 阅读器配置为可以直接部署到 Vercel，使用 Vercel Postgres 作为数据库。

## ✅ 已完成的更改

### 1. 数据库配置更改

**文件**: `prisma/schema.prisma`

**变更**:
```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
+  directUrl = env("DIRECT_URL")
}
```

**原因**:
- Vercel 不支持 SQLite（无持久化存储）
- PostgreSQL 适合生产环境
- `directUrl` 用于数据库迁移操作

### 2. 新增 Vercel 配置文件

**文件**: `vercel.json` *(新建)*

```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install"
}
```

**作用**:
- 确保构建时生成 Prisma Client
- 指定依赖安装命令

### 3. 新增 Vercel 忽略文件

**文件**: `.vercelignore` *(新建)*

```
node_modules
.env
.env.*
*.db
*.db-journal
.next
prisma/migrations
```

**作用**:
- 减少上传文件大小
- 保护敏感信息

### 4. 更新 .gitignore

**文件**: `.gitignore`

**新增内容**:
```
# prisma
prisma/*.db
prisma/*.db-journal
prisma/migrations
```

**作用**:
- 防止数据库文件提交到 Git
- 排除 SQLite 相关文件

### 5. 更新 package.json

**文件**: `package.json`

**新增脚本**:
```json
{
  "scripts": {
    "vercel:env": "vercel env pull .env.local",
    "vercel:deploy": "vercel --prod",
    "vercel:logs": "vercel logs",
    "db:seed": "prisma db seed"
  }
}
```

**作用**:
- 提供便捷的 Vercel 操作命令
- 简化部署和调试流程

### 6. 环境变量模板更新

**文件**: `env.template`

**变更**:
```diff
# 数据库配置
-# SQLite (开发环境推荐)
-DATABASE_URL="file:./dev.db"
+# 开发环境 - PostgreSQL (推荐)
+DATABASE_URL="postgresql://username:password@localhost:5432/rss_reader?schema=public"
+DIRECT_URL="postgresql://username:password@localhost:5432/rss_reader?schema=public"

+# Vercel Postgres (生产环境)
+# DATABASE_URL="${POSTGRES_URL}"
+# DIRECT_URL="${POSTGRES_URL_NON_POOLING}"
```

**作用**:
- 提供 PostgreSQL 配置示例
- 说明 Vercel 环境变量映射

### 7. 新增部署文档

创建了完整的部署文档套件：

| 文档 | 用途 |
|------|------|
| `VERCEL_QUICKSTART.md` | 5 分钟快速部署指南 |
| `VERCEL_DEPLOYMENT.md` | 详细部署步骤和故障排查 |
| `DEPLOYMENT_CHECKLIST.md` | 完整的部署检查清单 |
| `VERCEL_CONFIG_SUMMARY.md` | 配置变更总结 |
| `CHANGES_FOR_VERCEL.md` | 本文档 |

### 8. 更新现有文档

**更新的文档**:
- `README.md` - 添加 Vercel 部署章节
- `QUICKSTART.md` - 更新数据库配置说明
- `PROJECT_OVERVIEW.md` - 添加 Vercel 部署信息

## 📦 项目结构变化

```
新增文件:
├── vercel.json                     # Vercel 构建配置
├── .vercelignore                   # Vercel 忽略文件
├── VERCEL_QUICKSTART.md           # 快速部署指南
├── VERCEL_DEPLOYMENT.md           # 详细部署指南
├── DEPLOYMENT_CHECKLIST.md        # 部署检查清单
├── VERCEL_CONFIG_SUMMARY.md       # 配置总结
└── CHANGES_FOR_VERCEL.md          # 变更说明（本文档）

修改的文件:
├── prisma/schema.prisma           # SQLite → PostgreSQL
├── .gitignore                     # 新增 Prisma 相关忽略
├── package.json                   # 新增 Vercel 脚本
├── env.template                   # 更新为 PostgreSQL 配置
├── README.md                      # 新增 Vercel 部署章节
├── QUICKSTART.md                  # 更新数据库配置
└── PROJECT_OVERVIEW.md            # 新增 Vercel 信息
```

## 🔧 必需的环境变量

部署到 Vercel 需要配置以下环境变量：

### 在 Vercel Dashboard 中配置

1. **数据库变量**（映射 Vercel 自动注入的变量）:
   ```
   DATABASE_URL=${POSTGRES_URL}
   DIRECT_URL=${POSTGRES_URL_NON_POOLING}
   ```

2. **NextAuth 变量**:
   ```
   NEXTAUTH_URL=https://your-app-name.vercel.app
   NEXTAUTH_SECRET=[使用 openssl rand -base64 32 生成]
   ```

3. **Google OAuth 变量**:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## 🚀 部署流程

### 步骤概览

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Configure for Vercel deployment"
   git push origin main
   ```

2. **在 Vercel 导入项目**
   - 访问 vercel.com
   - 导入 GitHub 仓库

3. **创建 Vercel Postgres 数据库**
   - Storage → Create Database → Postgres
   - 连接到项目

4. **配置环境变量**
   - 在项目设置中添加 6 个环境变量

5. **更新 Google OAuth**
   - 添加 Vercel 重定向 URI

6. **初始化数据库**
   ```bash
   vercel env pull .env.local
   npx prisma db push
   ```

7. **部署**
   ```bash
   vercel --prod
   ```

### 详细步骤

查看 **[VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md)** 获取分步指南。

## 🔄 本地开发选项

### 选项 1: 使用 PostgreSQL（推荐）

匹配生产环境：

```bash
# 安装 PostgreSQL
brew install postgresql  # macOS
# 或访问 postgresql.org

# 创建数据库
createdb rss_reader

# 配置 .env
DATABASE_URL="postgresql://user:pass@localhost:5432/rss_reader"
DIRECT_URL="postgresql://user:pass@localhost:5432/rss_reader"

# 初始化
npx prisma db push
```

### 选项 2: 继续使用 SQLite

仅用于本地开发：

1. 修改 `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. 配置 `.env`:
   ```
   DATABASE_URL="file:./dev.db"
   ```

3. 初始化:
   ```bash
   npx prisma db push
   ```

⚠️ **注意**: 使用 SQLite 时，部署前需要切换回 PostgreSQL。

## 📊 对比：配置前后

| 方面 | 配置前 | 配置后 |
|------|--------|--------|
| 数据库 | SQLite | PostgreSQL |
| 生产部署 | 不支持 | ✅ 支持 Vercel |
| 连接池 | 无 | ✅ Vercel Postgres 连接池 |
| 部署文档 | 无 | ✅ 完整文档套件 |
| 环境变量模板 | SQLite | ✅ PostgreSQL + Vercel |
| Vercel 配置 | 无 | ✅ vercel.json |
| 构建优化 | 基础 | ✅ 优化的构建流程 |

## ✨ 新增功能

通过这些配置，项目获得了：

1. **生产就绪** - 可直接部署到 Vercel
2. **数据库持久化** - PostgreSQL 替代 SQLite
3. **自动扩展** - Vercel 自动处理流量
4. **全球 CDN** - 极速访问
5. **完整文档** - 详细的部署指南
6. **开发便利** - 便捷的 CLI 命令

## 🎯 下一步

### 立即部署

如果你准备好部署，请按照以下顺序操作：

1. **确保代码已推送到 GitHub**
2. **准备 Google OAuth 凭据**
3. **查看检查清单**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
4. **按照快速指南操作**: [VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md)

### 或者先本地测试

如果想先在本地使用 PostgreSQL 测试：

1. 安装并启动 PostgreSQL
2. 创建数据库: `createdb rss_reader`
3. 更新 `.env` 文件
4. 运行 `npx prisma db push`
5. 启动开发服务器: `npm run dev`

## 📝 重要提示

1. **环境变量安全**
   - 永远不要提交 `.env` 文件
   - 使用强随机密钥

2. **Google OAuth 配置**
   - 记得添加 Vercel 的重定向 URI
   - 开发和生产使用不同的 OAuth 客户端（推荐）

3. **数据库迁移**
   - 生产环境使用 `prisma migrate deploy`
   - 开发环境使用 `prisma db push`

4. **首次部署**
   - 确保在部署前初始化数据库
   - 使用 `vercel env pull` 获取环境变量

## 🆘 获取帮助

如果遇到问题：

1. **查看文档**
   - [VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md) - 快速开始
   - [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - 详细指南
   - [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 检查清单

2. **检查常见问题**
   - 每个文档都包含"常见问题"章节
   - 查看 Vercel Function Logs

3. **调试步骤**
   - 查看构建日志
   - 检查环境变量配置
   - 验证数据库连接

## 🎉 总结

你的 RSS 阅读器现已完全配置好 Vercel 部署！

**关键变更**:
- ✅ 数据库从 SQLite 迁移到 PostgreSQL
- ✅ 添加 Vercel 配置文件
- ✅ 创建完整的部署文档
- ✅ 优化构建流程
- ✅ 提供便捷的 CLI 命令

**现在可以**:
- 🚀 部署到 Vercel（按照快速指南）
- 💻 本地使用 PostgreSQL 开发
- 📖 参考完整的文档资源
- 🔧 使用便捷的部署命令

---

**祝部署顺利！** 🎊

如有问题，请参考相关文档或查看 Vercel 日志。

