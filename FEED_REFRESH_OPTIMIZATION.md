# Feed 刷新模块优化总结

## 概述

根据 `feed-refresh-logic.md` 文档中的方案，对 RSS 阅读器的刷新模块进行了全面优化，实现了更高效、更可靠的 Feed 刷新机制。

## 主要优化内容

### 1. 数据库 Schema 优化

**新增字段**：
- `status`: Feed 状态枚举（ACTIVE, ERROR, DISABLED）
- `errorCount`: 连续错误次数
- `errorMessage`: 最后一次错误信息
- `etag`: HTTP ETag（用于条件请求）
- `lastModified`: HTTP Last-Modified（用于条件请求）
- `nextFetchAt`: 下次抓取计划时间
- `lastEntryAt`: 最新文章发布时间

**迁移文件**: `prisma/migrations/20251203103608_add_feed_refresh_optimization/`

### 2. RSS 解析器优化

**文件**: `lib/rss-parser.ts`

**主要改进**：
- 支持 HTTP 条件请求（ETag/Last-Modified）
- 返回缓存头信息，支持 304 Not Modified 响应
- 减少不必要的带宽消耗和解析开销

**新增接口**:
```typescript
interface RSSParseResult {
  feed: Parser.Output<unknown>
  cacheHeaders?: {
    etag?: string
    "last-modified"?: string
  }
  notModified?: boolean
}
```

### 3. 刷新服务模块

**文件**: `lib/feed-refresh-service.ts`

**核心功能**：
- `refreshFeed()`: 刷新单个 Feed，支持强制刷新
- `refreshFeeds()`: 批量刷新多个 Feed
- `getFeedsToRefresh()`: 获取需要刷新的 Feed 列表（基于状态和 nextFetchAt）

**关键特性**：
- ✅ HTTP 条件请求支持（ETag/Last-Modified）
- ✅ 304 Not Modified 处理（无需解析和更新）
- ✅ 指数退避重试机制
- ✅ 错误计数和自动禁用（连续错误 10 次后禁用）
- ✅ 基于 nextFetchAt 的智能调度
- ✅ 最新文章时间跟踪（lastEntryAt）

**重试策略**：
- 第 1 次错误: 15 分钟后重试
- 第 2 次错误: 30 分钟后重试
- 第 3 次错误: 60 分钟后重试
- 第 4+ 次错误: 60 分钟后重试（上限）

### 4. 刷新 API 优化

**文件**: `app/api/feeds/refresh/route.ts`

**改进**：
- 使用新的刷新服务模块
- 支持基于 nextFetchAt 的智能筛选
- 返回详细的刷新结果

### 5. 定时任务优化

**文件**: `app/api/cron/refresh-feeds/route.ts`

**改进**：
- 只刷新状态为 ACTIVE 的 Feed
- 只刷新 nextFetchAt <= now 的 Feed
- 大幅减少不必要的刷新操作
- 提高整体刷新效率

**执行频率**: 每 15 分钟执行一次（在整点、15分、30分、45分）

### 6. 添加订阅逻辑优化

**更新的文件**：
- `app/api/feeds/route.ts`
- `app/api/feeds/batch/route.ts`
- `app/api/feeds/import/route.ts`

**改进**：
- 新订阅自动设置状态为 ACTIVE
- 设置初始 nextFetchAt（15 分钟后）
- 初始化错误计数为 0

## 性能优化

### 1. HTTP 条件请求
- 使用 ETag 和 Last-Modified 头
- 避免重复下载未更新的 Feed
- 减少带宽和解析开销

### 2. 智能调度
- 基于 nextFetchAt 的精确调度
- 只刷新到期的 Feed
- 避免频繁刷新

### 3. 错误隔离
- 单个 Feed 错误不影响其他 Feed
- 错误计数和自动禁用机制
- 指数退避避免频繁重试失败 Feed

### 4. 去重机制
- 数据库唯一约束 (`feedId`, `guid`)
- 查询时检查已存在文章
- 避免重复存储

## 数据流

```
定时任务（每15分钟）
    ↓
getFeedsToRefresh() - 查询需要刷新的 Feed
    ↓
refreshFeeds() - 批量刷新
    ↓
refreshFeed() - 单个 Feed 刷新
    ├── HTTP 条件请求（ETag/Last-Modified）
    ├── 304 Not Modified? → 跳过解析
    ├── 解析 Feed 内容
    ├── 检查新文章（GUID 去重）
    ├── 保存新文章
    ├── 更新 Feed 元数据和缓存头
    ├── 更新 nextFetchAt（15分钟后）
    └── 错误处理（指数退避）
```

## 使用说明

### 手动刷新单个 Feed

```typescript
import { refreshFeed } from "@/lib/feed-refresh-service"

// 正常刷新（检查 nextFetchAt）
const result = await refreshFeed(feedId)

// 强制刷新（忽略 nextFetchAt）
const result = await refreshFeed(feedId, { forceRefresh: true })
```

### 批量刷新

```typescript
import { refreshFeeds } from "@/lib/feed-refresh-service"

const results = await refreshFeeds([feedId1, feedId2, feedId3])
```

### 获取需要刷新的 Feed

```typescript
import { getFeedsToRefresh } from "@/lib/feed-refresh-service"

// 获取所有需要刷新的 Feed
const feedIds = await getFeedsToRefresh()

// 获取特定用户需要刷新的 Feed
const feedIds = await getFeedsToRefresh(userId)
```

## 数据库迁移

运行以下命令应用迁移：

```bash
npx prisma migrate dev
```

或在生产环境：

```bash
npx prisma migrate deploy
```

## 注意事项

1. **迁移前备份**: 在生产环境应用迁移前，请确保备份数据库
2. **现有 Feed**: 迁移后，所有现有 Feed 的状态将自动设置为 ACTIVE
3. **nextFetchAt**: 现有 Feed 的 nextFetchAt 为 null，将在下次定时任务时刷新
4. **错误计数**: 现有 Feed 的 errorCount 初始化为 0

## 后续优化建议

1. **监控和告警**: 添加 Feed 错误率监控和告警机制
2. **用户界面**: 在前端显示 Feed 状态和错误信息
3. **手动重试**: 允许用户手动重试失败的 Feed
4. **批量操作**: 支持批量启用/禁用 Feed
5. **刷新历史**: 记录刷新历史，便于分析和调试

