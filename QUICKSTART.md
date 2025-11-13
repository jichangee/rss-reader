# 快速开始指南

这是一个 5 分钟快速开始指南，帮助你快速运行 RSS 阅读器。

## 前置要求

- Node.js 18 或更高版本
- 一个 Google 账号

## 安装步骤

### 1. 安装依赖

由于你的系统 Node.js 版本可能较低，建议先升级 Node.js：

```bash
# 使用 nvm 升级（推荐）
nvm install 18
nvm use 18

# 或者访问 https://nodejs.org/ 下载最新 LTS 版本
```

然后安装依赖：

```bash
pnpm install
# 如果 pnpm 不可用，使用 npm
npm install
```

### 2. 配置 Google OAuth（必需）

#### 快速配置步骤：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目（或选择现有项目）
3. 导航到："API 和服务" → "凭据"
4. 点击"创建凭据" → "OAuth 客户端 ID"
5. 如果是首次使用，需要先配置"OAuth 同意屏幕"：
   - 选择"外部"
   - 填写应用名称和联系邮箱
   - 在测试用户中添加你的 Google 账号
6. 回到创建 OAuth 客户端：
   - 应用类型：Web 应用
   - 授权重定向 URI：`http://localhost:3000/api/auth/callback/google`
7. 复制客户端 ID 和密钥

### 3. 创建环境变量文件

在项目根目录创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-at-least-32-characters-long"

# Google OAuth（填入你的实际凭据）
GOOGLE_CLIENT_ID="你的客户端ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="你的客户端密钥"
```

生成 NEXTAUTH_SECRET：

```bash
openssl rand -base64 32
```

### 4. 设置本地数据库

#### 选项 A: 使用 PostgreSQL (推荐)

确保本地安装了 PostgreSQL，然后创建数据库：

```bash
# 创建数据库
createdb rss_reader

# 更新 .env 中的 DATABASE_URL
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/rss_reader"
DIRECT_URL="postgresql://your_user:your_password@localhost:5432/rss_reader"

# 初始化数据库
npx prisma generate
npx prisma db push
```

#### 选项 B: 使用 SQLite (仅开发环境)

如果使用 SQLite，需要修改 `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

然后在 `.env` 中设置：

```env
DATABASE_URL="file:./dev.db"
```

再运行：

```bash
npx prisma generate
npx prisma db push
```

### 5. 启动应用

```bash
npm run dev
```

打开浏览器访问：[http://localhost:3000](http://localhost:3000)

## 首次使用

1. 点击"使用 Google 登录"
2. 选择你的 Google 账号
3. 授权应用访问
4. 登录成功后会跳转到主界面
5. 点击"添加订阅"添加你的第一个 RSS 源

## 推荐的 RSS 源

试试这些流行的 RSS 源：

- **Hacker News**: `https://hnrss.org/frontpage`
- **Reddit Programming**: `https://www.reddit.com/r/programming/.rss`
- **阮一峰的网络日志**: `https://www.ruanyifeng.com/blog/atom.xml`

## 常见问题

### OAuth 错误

**问题**: "Error: redirect_uri_mismatch"

**解决**: 确保 Google Cloud Console 中的重定向 URI 完全匹配：
```
http://localhost:3000/api/auth/callback/google
```

### 数据库错误

**问题**: 数据库连接失败

**解决**: 
1. 确认已运行 `npx prisma generate`
2. 确认已运行 `npx prisma db push`
3. 检查 `DATABASE_URL` 配置正确

### 无法添加 RSS

**问题**: 添加 RSS 订阅失败

**解决**: 
1. 确认 RSS URL 格式正确
2. 确认该网站的 RSS 可访问
3. 检查浏览器控制台是否有错误信息

## 下一步

- 查看 [README.md](./README.md) 了解完整功能
- 查看 [ENV_SETUP.md](./ENV_SETUP.md) 了解详细配置
- 使用 `npm run db:studio` 查看数据库内容

## 获取帮助

如果遇到问题：

1. 检查浏览器控制台错误
2. 检查终端输出
3. 确认所有环境变量已正确配置
4. 确认 Google OAuth 配置正确

祝使用愉快！🎉

