# 管理后台部署指南

## 📋 功能概述

管理后台提供以下核心功能：

### ✅ 已实现功能
1. **数据统计仪表板**
   - 用户统计（总数、新增、活跃度）
   - 订阅源和文章统计
   - 阅读行为统计
   - 用户增长趋势图表
   - 热门订阅源 Top 10

2. **用户管理**
   - 用户列表查看（支持搜索、筛选、分页）
   - 用户详情查看
   - 用户角色管理
   - 删除用户功能

3. **权限系统**
   - 基于角色的访问控制（user / admin）
   - 管理员操作日志记录
   - 环境变量配置管理员

4. **统计数据汇总**
   - 定时任务每日汇总统计数据
   - 用户活跃度追踪
   - 系统快照记录

### 🚧 待实现功能
- 订阅源管理
- 文章管理
- 系统设置管理

---

## 🚀 部署步骤

### 1. 更新数据库 Schema

首先需要更新数据库结构，添加管理后台所需的表和字段：

```bash
# 生成 Prisma 迁移
npx prisma migrate dev --name add_admin_features

# 或者直接推送到数据库
npx prisma db push

# 重新生成 Prisma Client
npx prisma generate
```

### 2. 配置环境变量

在 `.env` 文件中添加管理员邮箱配置：

```env
# 管理员邮箱（多个邮箱用逗号分隔）
ADMIN_EMAILS="your-admin-email@gmail.com,another-admin@gmail.com"
```

**注意：**
- 只有在 `ADMIN_EMAILS` 中列出的邮箱才能访问管理后台
- 用户首次登录后，系统会自动将其角色设置为 `admin`

### 3. 测试定时任务（可选）

统计数据汇总定时任务配置在 `vercel.json` 中：

```json
{
  "crons": [
    {
      "path": "/api/cron/aggregate-stats",
      "schedule": "0 1 * * *"  // 每天凌晨 1:00 执行
    }
  ]
}
```

本地测试定时任务：

```bash
# 使用 curl 测试（需要 CRON_SECRET）
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/aggregate-stats
```

### 4. 部署到 Vercel

```bash
# 推送代码到 Git 仓库
git add .
git commit -m "feat: add admin dashboard"
git push origin main

# Vercel 会自动部署
```

**Vercel 环境变量配置：**

在 Vercel 项目设置中添加以下环境变量：
1. `ADMIN_EMAILS` - 管理员邮箱列表
2. `CRON_SECRET` - 定时任务密钥（如果还没有的话）

---

## 📖 使用指南

### 访问管理后台

1. 使用管理员邮箱登录系统
2. 访问 `/admin` 路径
3. 系统会自动验证您的管理员权限

### 管理后台路由

- `/admin` - 数据统计仪表板
- `/admin/users` - 用户管理
- `/admin/users/[id]` - 用户详情（待实现）
- `/admin/feeds` - 订阅源管理（待实现）
- `/admin/articles` - 文章管理（待实现）
- `/admin/settings` - 系统设置（待实现）

### 权限说明

- **普通用户 (user)**: 只能访问前台功能
- **管理员 (admin)**: 可以访问管理后台的所有功能

---

## 🔒 安全注意事项

1. **保护管理员邮箱列表**
   - 不要将 `.env` 文件提交到版本控制
   - 定期审查管理员列表

2. **操作日志**
   - 所有管理员操作都会记录到 `AdminLog` 表
   - 包括操作类型、目标、时间、IP 地址等

3. **权限验证**
   - 每个管理后台 API 都会验证用户的管理员权限
   - 使用 `checkAdmin()` 函数进行统一验证

4. **定时任务安全**
   - Cron 端点使用 `CRON_SECRET` 进行保护
   - 只有携带正确密钥的请求才能执行

---

## 🐛 故障排查

### 无法访问管理后台

1. 检查您的邮箱是否在 `ADMIN_EMAILS` 中
2. 退出登录后重新登录，触发角色更新
3. 查看浏览器控制台是否有错误信息

### 统计数据不准确

1. 确保定时任务正常运行
2. 检查 Vercel Cron 日志
3. 手动触发统计任务进行测试

### 数据库错误

```bash
# 重新生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push
```

---

## 📊 数据库表结构

### 新增表

1. **UserActivity** - 用户活跃度统计
   - 记录每个用户每天的活动数据
   - 用于计算 DAU/WAU/MAU

2. **SystemStats** - 系统统计快照
   - 每天的系统整体统计数据
   - 用于趋势分析和历史回溯

3. **AdminLog** - 管理员操作日志
   - 记录所有管理员操作
   - 用于审计和安全追踪

### 修改的表

1. **User** - 用户表
   - 新增 `role` 字段（user / admin）
   - 新增 `lastActiveAt` 字段（最后活跃时间）
   - 新增索引提升查询性能

---

## 🎯 后续开发建议

### 高优先级
1. 用户详情页面
2. 批量操作功能
3. 数据导出功能

### 中优先级
1. 订阅源管理
2. 文章管理
3. 更多统计图表（使用 recharts）

### 低优先级
1. 系统设置界面
2. 邮件通知
3. API 使用限制管理

---

## 📝 开发日志

- **2025-12-10**: 初始版本完成
  - ✅ 数据库 Schema 更新
  - ✅ 权限系统实现
  - ✅ 数据统计仪表板
  - ✅ 用户管理功能
  - ✅ 定时任务配置

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
