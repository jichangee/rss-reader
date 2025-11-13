# 环境配置指南

## Google OAuth 配置详细步骤

### 1. 访问 Google Cloud Console

打开 [Google Cloud Console](https://console.cloud.google.com/)

### 2. 创建或选择项目

1. 点击顶部的项目选择器
2. 点击"新建项目"
3. 输入项目名称（例如："RSS Reader"）
4. 点击"创建"

### 3. 启用 Google+ API

1. 在左侧菜单选择"API 和服务" > "库"
2. 搜索"Google+ API"
3. 点击并启用

### 4. 配置 OAuth 同意屏幕

1. 在左侧菜单选择"API 和服务" > "OAuth 同意屏幕"
2. 选择"外部"用户类型
3. 填写应用信息：
   - 应用名称：RSS 阅读器
   - 用户支持电子邮件：你的邮箱
   - 开发者联系信息：你的邮箱
4. 点击"保存并继续"
5. 作用域页面可以跳过
6. 测试用户页面添加你的 Google 账号（开发阶段）
7. 完成配置

### 5. 创建 OAuth 2.0 客户端 ID

1. 在左侧菜单选择"API 和服务" > "凭据"
2. 点击"创建凭据" > "OAuth 客户端 ID"
3. 选择应用类型："Web 应用"
4. 输入名称："RSS Reader Web Client"
5. 添加授权的重定向 URI：
   - 开发环境：`http://localhost:3000/api/auth/callback/google`
   - 生产环境：`https://your-domain.com/api/auth/callback/google`
6. 点击"创建"
7. 复制显示的客户端 ID 和客户端密钥

### 6. 配置环境变量

创建 `.env` 文件（不要提交到 Git）：

```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3000"
# 生成随机密钥: openssl rand -base64 32
NEXTAUTH_SECRET="your-generated-secret-key"

# Google OAuth 凭据（从 Google Cloud Console 获取）
GOOGLE_CLIENT_ID="your-actual-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-actual-client-secret"
```

### 7. 生成 NEXTAUTH_SECRET

在终端运行以下命令生成安全的密钥：

```bash
openssl rand -base64 32
```

将输出复制到 `NEXTAUTH_SECRET` 变量中。

## 数据库配置

### 开发环境（SQLite）

SQLite 适合开发和测试，无需额外配置。

```env
DATABASE_URL="file:./dev.db"
```

### 生产环境（PostgreSQL 推荐）

1. 创建 PostgreSQL 数据库
2. 修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. 更新 `.env`：

```env
DATABASE_URL="postgresql://username:password@host:5432/database?schema=public"
```

4. 运行迁移：

```bash
npx prisma migrate deploy
```

### 生产环境（MySQL）

1. 创建 MySQL 数据库
2. 修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

3. 更新 `.env`：

```env
DATABASE_URL="mysql://username:password@host:3306/database"
```

## 常见问题

### Q: OAuth 重定向 URI 不匹配

**A**: 确保 Google Cloud Console 中的重定向 URI 与应用运行的 URL 完全一致，包括协议（http/https）、端口号和路径。

### Q: 无法连接到数据库

**A**: 检查 `DATABASE_URL` 格式是否正确，确保数据库服务正在运行。

### Q: NextAuth 会话问题

**A**: 确保 `NEXTAUTH_SECRET` 已正确设置且足够长（至少 32 字符）。

### Q: 生产环境 Google 登录失败

**A**: 
1. 检查 `NEXTAUTH_URL` 是否指向正确的域名
2. 确保该域名已添加到 Google Cloud Console 的授权重定向 URI
3. 确认 OAuth 同意屏幕已发布（不是测试模式）

## 安全建议

1. **永远不要提交 `.env` 文件到 Git**
2. **使用强随机密钥**：`NEXTAUTH_SECRET` 应该是加密安全的随机字符串
3. **限制 OAuth 作用域**：仅请求必要的权限
4. **使用 HTTPS**：生产环境必须使用 HTTPS
5. **定期轮换密钥**：定期更新 API 密钥和 secrets

## 部署清单

部署到生产环境前检查：

- [ ] 所有环境变量已正确配置
- [ ] 数据库已迁移到生产数据库
- [ ] Google OAuth 重定向 URI 包含生产域名
- [ ] `NEXTAUTH_URL` 指向生产域名
- [ ] 使用 HTTPS
- [ ] OAuth 同意屏幕已发布
- [ ] 测试登录流程
- [ ] 测试 RSS 订阅功能

