# Vercel 部署检查清单 ✅

在部署之前，请确保完成以下所有步骤。

## 📋 部署前准备

### 1. 代码准备
- [ ] 代码已提交到 GitHub
- [ ] 所有功能已在本地测试通过
- [ ] 没有 TypeScript 或 ESLint 错误
- [ ] `.gitignore` 配置正确（不包含 `.env` 文件）

### 2. Google OAuth 配置
- [ ] 已在 Google Cloud Console 创建 OAuth 客户端
- [ ] 已配置 OAuth 同意屏幕
- [ ] 已获取 Client ID 和 Client Secret
- [ ] OAuth 同意屏幕状态为"已发布"（生产环境必需）

## 🚀 Vercel 配置步骤

### 3. Vercel 项目设置
- [ ] 已在 Vercel 导入 GitHub 仓库
- [ ] 项目名称已设置
- [ ] Framework 检测为 Next.js

### 4. Vercel Postgres 数据库
- [ ] 已在 Vercel Storage 创建 Postgres 数据库
- [ ] 数据库已连接到项目
- [ ] 确认以下环境变量自动生成：
  - `POSTGRES_URL`
  - `POSTGRES_URL_NON_POOLING`

### 5. 环境变量配置

在 Vercel 项目设置 → Environment Variables 中添加：

#### 数据库变量
- [ ] `DATABASE_URL` = `${POSTGRES_URL}`
- [ ] `DIRECT_URL` = `${POSTGRES_URL_NON_POOLING}`

#### NextAuth 变量
- [ ] `NEXTAUTH_URL` = `https://your-app-name.vercel.app`
- [ ] `NEXTAUTH_SECRET` = （使用 `openssl rand -base64 32` 生成）

#### Google OAuth 变量
- [ ] `GOOGLE_CLIENT_ID` = 你的 Client ID
- [ ] `GOOGLE_CLIENT_SECRET` = 你的 Client Secret

**所有变量都应用于**: Production, Preview, Development

### 6. Google OAuth 重定向 URI 更新
- [ ] 在 Google Cloud Console 的 OAuth 客户端中添加：
  ```
  https://your-app-name.vercel.app/api/auth/callback/google
  ```
- [ ] 保存更改

### 7. 数据库初始化

使用 Vercel CLI：

```bash
# 安装 Vercel CLI（如果还没有）
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

- [ ] Prisma Client 已生成
- [ ] 数据库模式已推送成功
- [ ] 可以使用 `npx prisma studio` 查看数据库

### 8. 首次部署
- [ ] 点击 Vercel "Deploy" 按钮，或运行 `vercel --prod`
- [ ] 构建成功（无错误）
- [ ] 部署成功

## ✅ 部署后验证

### 9. 功能测试
- [ ] 访问应用 URL: `https://your-app-name.vercel.app`
- [ ] 首页正常加载
- [ ] Google 登录功能正常
- [ ] 能够成功登录
- [ ] 能够添加 RSS 订阅
- [ ] 能够查看文章列表
- [ ] 文章可以正确打开
- [ ] 已读/未读状态正常工作
- [ ] 刷新订阅功能正常
- [ ] 删除订阅功能正常

### 10. 性能和监控
- [ ] 检查 Vercel Analytics（如果启用）
- [ ] 检查 Function Logs 无异常错误
- [ ] 页面加载速度正常（< 3秒）
- [ ] 检查 Lighthouse 分数（可选）

### 11. 安全检查
- [ ] 环境变量未暴露在客户端
- [ ] 数据库连接字符串安全
- [ ] API 路由有适当的认证保护
- [ ] CORS 配置正确（如果适用）

## 🔧 故障排查

如果遇到问题：

### 登录失败
1. 检查 `NEXTAUTH_URL` 是否正确
2. 检查 Google OAuth 重定向 URI
3. 查看 Vercel Function Logs

### 数据库连接失败
1. 检查 `DATABASE_URL` 和 `DIRECT_URL`
2. 确认数据库模式已推送
3. 重新运行 `npx prisma generate`

### 构建失败
1. 检查 Vercel Build Logs
2. 确认所有依赖已正确安装
3. 检查 TypeScript 类型错误

### 环境变量问题
1. 确认所有变量已添加到 Vercel
2. 确认变量应用于正确的环境
3. 部署后重新触发构建

## 📊 部署后优化

### 性能优化
- [ ] 配置图片优化
- [ ] 启用缓存策略
- [ ] 考虑使用 Edge Runtime（部分路由）

### 监控设置
- [ ] 设置 Vercel 错误通知
- [ ] 配置 Uptime 监控（可选）
- [ ] 设置数据库备份策略

### 域名配置（可选）
- [ ] 添加自定义域名
- [ ] 配置 DNS
- [ ] 更新 `NEXTAUTH_URL`
- [ ] 更新 Google OAuth 重定向 URI

## 📝 部署信息记录

记录以下信息以便后续维护：

| 项目 | 值 |
|------|-----|
| Vercel 项目名 | _____________ |
| 生产 URL | https://_____________.vercel.app |
| 数据库区域 | _____________ |
| Google OAuth Client ID | _____________ |
| 部署日期 | _____________ |

## 🎉 部署完成

恭喜！你的 RSS 阅读器现已在 Vercel 上运行。

### 下一步
- 分享给用户测试
- 监控应用性能
- 根据反馈迭代改进
- 考虑添加更多功能

## 📚 相关文档

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - 详细部署指南
- [README.md](./README.md) - 项目文档
- [ENV_SETUP.md](./ENV_SETUP.md) - 环境配置指南

---

**提示**: 保存此清单的副本，以便未来部署或环境更新时使用。

