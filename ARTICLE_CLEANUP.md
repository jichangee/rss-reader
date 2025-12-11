# 文章自动清理功能

## 📋 功能说明

为了减轻数据库压力，系统会自动清理旧的已读文章。这个功能集成在订阅刷新的定时任务中。

### 清理规则

系统会删除满足以下**所有条件**的文章：

1. ✅ **已读时间超过 7 天** - 最后一次被标记为已读的时间在 7 天前
2. ✅ **不在稍后读列表** - 文章未被任何用户添加到稍后读
3. ✅ **已被至少一个用户阅读** - 文章有阅读记录

### 保留的文章

以下文章**不会被删除**：

- ❌ 未读的文章
- ❌ 在任何用户的稍后读列表中的文章
- ❌ 7 天内被阅读过的文章
- ❌ 从未被阅读过的文章

---

## 🕐 自动清理

### 执行时间

- **每天早上 8:00**（北京时间）
- 与订阅刷新同时执行
- 配置在 `vercel.json` 中：`0 8 * * *`

### 执行流程

```
刷新订阅 → 添加新文章 → 清理旧文章 → 记录日志
```

### 日志输出

```json
{
  "executedAt": "2025-12-10T08:00:00.000Z",
  "duration": "15432ms",
  "users": 10,
  "totalFeeds": 50,
  "successfulRefreshes": 48,
  "failedRefreshes": 2,
  "newArticles": 123,
  "deletedArticles": 456  // 清理的文章数
}
```

---

## 🔧 手动清理

### 使用管理后台

1. 访问 `/admin/articles`
2. 点击右上角"清理旧文章"按钮
3. 确认操作
4. 等待清理完成

### 使用 API

**端点：** `POST /api/admin/articles/cleanup`

**权限：** 需要管理员权限

**请求体：**
```json
{
  "days": 7  // 可选，默认 7 天
}
```

**响应：**
```json
{
  "success": true,
  "message": "成功清理 456 篇旧文章",
  "details": {
    "days": 7,
    "candidateArticles": 500,
    "deletedArticles": 456,
    "duration": "2345ms"
  }
}
```

### 使用 curl 测试

```bash
curl -X POST https://your-domain.com/api/admin/articles/cleanup \
  -H "Content-Type: application/json" \
  -d '{"days": 7}' \
  -b "cookies.txt"
```

---

## 📊 清理统计

### 查看清理记录

在管理后台的"系统设置"页面可以查看操作日志，筛选 `cleanup_old_articles` 操作。

### 日志信息包括：

- 执行时间
- 管理员信息（自动执行时为系统）
- 清理的文章数量
- 执行耗时
- IP 地址

---

## ⚙️ 配置选项

### 修改清理周期

编辑 `/app/api/cron/refresh-feeds/route.ts`：

```typescript
// 当前：7 天
const oneWeekAgo = new Date()
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

// 修改为 14 天
const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
```

### 手动清理自定义天数

```bash
curl -X POST https://your-domain.com/api/admin/articles/cleanup \
  -H "Content-Type: application/json" \
  -d '{"days": 30}' \  # 清理 30 天前的文章
  -b "cookies.txt"
```

---

## 🔍 技术细节

### 数据库查询

1. **查找候选文章**
```sql
SELECT DISTINCT articleId 
FROM ReadArticle 
WHERE readAt < (NOW() - INTERVAL '7 days')
```

2. **排除稍后读**
```sql
SELECT articleId 
FROM ReadLater 
WHERE articleId IN (...)
```

3. **批量删除**
```sql
DELETE FROM Article 
WHERE id IN (...)
```

### 级联删除

删除文章时，Prisma 会自动级联删除：
- `ReadArticle` 记录（已读记录）
- `ReadLater` 记录（稍后读记录，但前面已排除）

---

## 📈 性能优化

### 批量操作

- 使用 `deleteMany` 批量删除，减少数据库往返
- 使用 `distinct` 去重，避免重复查询

### 查询优化

- 在 `readAt` 字段上有索引
- 使用 `select` 只查询必要字段

### 错误处理

- 清理失败不影响订阅刷新
- 所有操作都有日志记录
- 自动捕获异常并记录

---

## 🛡️ 安全考虑

### 数据保护

1. **不删除稍后读** - 用户标记的重要文章会被保留
2. **保留新文章** - 只删除旧的已读文章
3. **可恢复性** - 文章仍可通过 RSS 源重新获取

### 权限控制

- 手动清理需要管理员权限
- 自动清理使用 Cron Secret 保护
- 操作日志记录所有清理活动

---

## 🚨 故障排查

### 清理失败

**问题：** 定时任务执行但未清理文章

**检查：**
1. 查看 Vercel Logs 中的清理日志
2. 确认是否有符合条件的文章
3. 检查数据库连接状态

### 误删文章

**恢复方法：**
1. 订阅刷新时会重新获取文章
2. 手动刷新对应的订阅源
3. 联系管理员查看操作日志

---

## 📝 最佳实践

### 建议配置

- **默认 7 天**：适合大多数场景
- **14 天**：用户活跃度低的情况
- **3 天**：文章量很大的情况

### 监控建议

1. 定期检查操作日志
2. 监控数据库大小变化
3. 关注用户反馈

### 备份策略

- 定期备份数据库
- 保存重要的操作日志
- 记录清理统计数据

---

## 📚 相关资源

- [Vercel Cron 文档](https://vercel.com/docs/cron-jobs)
- [Prisma 删除操作](https://www.prisma.io/docs/concepts/components/prisma-client/crud#delete)
- 管理后台：`/admin/articles`

---

## 更新日志

- **2025-12-10**: 初始版本，7 天自动清理
  - 集成到订阅刷新 Cron
  - 添加手动清理 API
  - 添加管理后台按钮

---

## 🤝 反馈与支持

如有问题或建议，请：
1. 查看操作日志
2. 检查 Vercel Logs
3. 提交 Issue
