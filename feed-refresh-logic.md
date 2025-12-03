# Glean 文章刷新逻辑文档

## 概述

本文档详细描述了 Glean RSS 阅读器项目中文章（Feed Entry）的刷新机制。系统通过后台 Worker 定时抓取 RSS Feed，解析并存储新文章，同时支持用户手动触发刷新。

## 架构组件

### 1. 核心模块

- **Worker 服务** (`backend/apps/worker/`): 后台任务处理服务，使用 arq 任务队列
- **Feed Fetcher** (`backend/apps/worker/glean_worker/tasks/feed_fetcher.py`): Feed 抓取任务
- **RSS 解析器** (`backend/packages/rss/glean_rss/`): RSS/Atom Feed 解析和获取
- **Feed Service** (`backend/packages/core/glean_core/services/feed_service.py`): Feed 业务逻辑
- **API 路由** (`backend/apps/api/glean_api/routers/feeds.py`): Feed 相关 API 端点

### 2. 数据模型

#### Feed 模型
```python
class Feed:
    id: str                    # Feed UUID
    url: str                   # Feed URL（唯一）
    title: str                 # Feed 标题
    status: FeedStatus         # 状态：ACTIVE, ERROR, DISABLED
    error_count: int           # 连续错误次数
    last_fetched_at: datetime  # 最后抓取时间
    last_entry_at: datetime    # 最新文章发布时间
    next_fetch_at: datetime    # 下次抓取计划时间
    etag: str                  # HTTP ETag（用于条件请求）
    last_modified: str         # HTTP Last-Modified（用于条件请求）
```

#### Entry 模型
```python
class Entry:
    id: str                    # Entry UUID
    feed_id: str               # 所属 Feed ID
    guid: str                  # 文章 GUID（用于去重）
    url: str                   # 文章链接
    title: str                 # 文章标题
    content: str               # 文章内容（HTML）
    summary: str               # 文章摘要
    author: str                # 作者
    published_at: datetime     # 发布时间
```

## 刷新触发机制

### 1. 定时自动刷新

**调度配置** (`backend/apps/worker/glean_worker/main.py`)

- **执行频率**: 每 15 分钟执行一次（在整点、15分、30分、45分）
- **任务函数**: `scheduled_fetch()`
- **实现方式**: 使用 arq 的 cron 功能

```python
cron_jobs = [
    cron(feed_fetcher.scheduled_fetch, minute={0, 15, 30, 45}),
]
```

**执行流程**:
1. `scheduled_fetch()` 调用 `fetch_all_feeds()`
2. 查询所有状态为 `ACTIVE` 且 `next_fetch_at <= now` 的 Feed
3. 为每个符合条件的 Feed 入队 `fetch_feed_task` 任务

### 2. 手动刷新

#### 2.1 单个 Feed 刷新

**API 端点**: `POST /feeds/{subscription_id}/refresh`

**实现位置**: `backend/apps/api/glean_api/routers/feeds.py:212`

**流程**:
1. 验证用户权限和订阅存在
2. 获取订阅对应的 Feed ID
3. 将 `fetch_feed_task` 任务入队到 Redis 队列
4. 返回任务状态（queued）

**前端调用**:
- Hook: `useRefreshFeed()` (`frontend/apps/web/src/hooks/useSubscriptions.ts:108`)
- API Client: `FeedService.refreshFeed()` (`frontend/packages/api-client/src/services/feeds.ts:73`)

#### 2.2 批量刷新所有 Feed

**API 端点**: `POST /feeds/refresh-all`

**实现位置**: `backend/apps/api/glean_api/routers/feeds.py:244`

**流程**:
1. 获取用户所有订阅
2. 为每个订阅的 Feed 入队刷新任务
3. 返回入队数量

**前端调用**:
- Hook: `useRefreshAllFeeds()` (`frontend/apps/web/src/hooks/useSubscriptions.ts:123`)

### 3. 订阅时自动刷新

**触发时机**: 用户订阅新 Feed 时

**实现位置**: 
- `backend/apps/api/glean_api/routers/feeds.py:118` (discover_feed)
- `backend/apps/api/glean_api/routers/feeds.py:334` (import_opml)

**流程**:
1. 创建订阅后
2. 立即将 `fetch_feed_task` 任务入队
3. 确保新订阅的 Feed 能立即获取文章

## 刷新执行流程

### 核心任务: `fetch_feed_task`

**位置**: `backend/apps/worker/glean_worker/tasks/feed_fetcher.py:18`

#### 步骤 1: 获取 Feed 信息

```python
stmt = select(Feed).where(Feed.id == feed_id)
feed = result.scalar_one_or_none()
```

- 从数据库查询 Feed 记录
- 如果 Feed 不存在，返回错误

#### 步骤 2: HTTP 条件请求

```python
fetch_result = await fetch_feed(feed.url, feed.etag, feed.last_modified)
```

**实现位置**: `backend/packages/rss/glean_rss/discoverer.py:83`

**HTTP 条件请求机制**:
- 如果 Feed 有 `etag`，添加 `If-None-Match` 头
- 如果 Feed 有 `last_modified`，添加 `If-Modified-Since` 头
- 如果服务器返回 304 Not Modified，直接返回，不进行解析

**优势**:
- 减少带宽消耗
- 提高刷新效率
- 尊重服务器缓存策略

#### 步骤 3: 解析 Feed 内容

```python
parsed_feed = await parse_feed(content, feed.url)
```

**实现位置**: `backend/packages/rss/glean_rss/parser.py:107`

**解析过程**:
1. 使用 `feedparser` 库解析 XML 内容
2. 提取 Feed 元数据（标题、描述、站点 URL、语言、图标等）
3. 解析所有 Entry（文章）
4. 提取每篇文章的 GUID、URL、标题、内容、摘要、作者、发布时间

#### 步骤 4: 更新 Feed 元数据

```python
feed.title = parsed_feed.title or feed.title
feed.description = parsed_feed.description or feed.description
feed.site_url = parsed_feed.site_url or feed.site_url
feed.language = parsed_feed.language or feed.language
feed.icon_url = parsed_feed.icon_url or feed.icon_url
feed.status = FeedStatus.ACTIVE
feed.error_count = 0
feed.fetch_error_message = None
feed.last_fetched_at = datetime.now(UTC)
```

**缓存头更新**:
```python
if cache_headers and "etag" in cache_headers:
    feed.etag = cache_headers["etag"]
if cache_headers and "last-modified" in cache_headers:
    feed.last_modified = cache_headers["last-modified"]
```

#### 步骤 5: 处理新文章

```python
for parsed_entry in parsed_feed.entries:
    # 检查文章是否已存在（通过 GUID 去重）
    stmt = select(Entry).where(
        Entry.feed_id == feed.id, 
        Entry.guid == parsed_entry.guid
    )
    existing_entry = result.scalar_one_or_none()
    
    if existing_entry:
        continue  # 跳过已存在的文章
    
    # 创建新文章
    entry = Entry(
        feed_id=feed.id,
        guid=parsed_entry.guid,
        url=parsed_entry.url,
        title=parsed_entry.title,
        author=parsed_entry.author,
        content=parsed_entry.content,
        summary=parsed_entry.summary,
        published_at=parsed_entry.published_at,
    )
    session.add(entry)
    new_entries += 1
```

**去重机制**:
- 使用 `feed_id + guid` 唯一约束确保同一 Feed 中文章不重复
- 如果文章已存在，跳过处理

**最新文章时间跟踪**:
```python
if parsed_entry.published_at and (
    latest_entry_time is None or 
    parsed_entry.published_at > latest_entry_time
):
    latest_entry_time = parsed_entry.published_at
```

#### 步骤 6: 更新 Feed 状态并计划下次刷新

```python
if latest_entry_time:
    feed.last_entry_at = latest_entry_time

# 计划下次刷新（15分钟后）
feed.next_fetch_at = datetime.now(UTC) + timedelta(minutes=15)

await session.commit()
```

### 错误处理机制

#### 错误捕获

```python
except Exception as e:
    feed.error_count += 1
    feed.fetch_error_message = str(e)
    feed.last_fetched_at = datetime.now(UTC)
```

#### 错误计数和禁用

```python
# 连续错误达到 10 次后禁用 Feed
if feed.error_count >= 10:
    feed.status = FeedStatus.ERROR
```

#### 指数退避重试

```python
# 计算重试延迟（指数退避，最多 60 分钟）
retry_minutes = min(60, 15 * (2 ** min(feed.error_count - 1, 5)))
feed.next_fetch_at = datetime.now(UTC) + timedelta(minutes=retry_minutes)
```

**重试策略**:
- 第 1 次错误: 15 分钟后重试
- 第 2 次错误: 30 分钟后重试
- 第 3 次错误: 60 分钟后重试
- 第 4+ 次错误: 60 分钟后重试（上限）

#### 任务重试

```python
# arq 任务级别重试（5 分钟后）
raise Retry(defer=timedelta(minutes=5))
```

## Worker 配置

### Worker 设置

**位置**: `backend/apps/worker/glean_worker/main.py:59`

```python
class WorkerSettings:
    functions = [
        feed_fetcher.fetch_feed_task,
        feed_fetcher.fetch_all_feeds,
        cleanup.cleanup_read_later,
        bookmark_metadata.fetch_bookmark_metadata_task,
    ]
    
    cron_jobs = [
        cron(feed_fetcher.scheduled_fetch, minute={0, 15, 30, 45}),
        cron(cleanup.scheduled_cleanup, minute=0),
    ]
    
    max_jobs = 20          # 最大并发任务数
    job_timeout = 300      # 任务超时时间（5分钟）
    keep_result = 3600     # 任务结果保留时间（1小时）
```

### Redis 队列

- **队列系统**: arq (基于 Redis)
- **任务队列**: Redis 作为消息队列存储待执行任务
- **任务执行**: Worker 进程从队列中取出任务并执行

## 刷新时间策略

### 正常刷新间隔

- **默认间隔**: 15 分钟
- **实现**: `feed.next_fetch_at = datetime.now(UTC) + timedelta(minutes=15)`

### 刷新条件

Feed 会被刷新当且仅当:
1. `status == FeedStatus.ACTIVE`
2. `next_fetch_at` 为 `None` 或 `next_fetch_at <= now`

### 刷新优先级

1. **手动刷新**: 立即入队，不受 `next_fetch_at` 限制
2. **定时刷新**: 只刷新到期的 Feed
3. **订阅时刷新**: 立即入队新 Feed

## 性能优化

### 1. HTTP 条件请求

- 使用 ETag 和 Last-Modified 头
- 避免重复下载未更新的 Feed
- 减少带宽和解析开销

### 2. 去重机制

- 数据库唯一约束 (`feed_id`, `guid`)
- 查询时检查已存在文章
- 避免重复存储

### 3. 批量处理

- `fetch_all_feeds()` 批量查询到期 Feed
- 并发执行多个 `fetch_feed_task`（最多 20 个）
- 提高整体刷新效率

### 4. 错误隔离

- 单个 Feed 错误不影响其他 Feed
- 错误计数和自动禁用机制
- 指数退避避免频繁重试失败 Feed

## 前端集成

### 刷新 Feed Hook

**位置**: `frontend/apps/web/src/hooks/useSubscriptions.ts`

```typescript
// 单个 Feed 刷新
export function useRefreshFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subscriptionId: string) => 
      feedService.refreshFeed(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: subscriptionKeys.lists() 
      })
    },
  })
}

// 刷新所有 Feed
export function useRefreshAllFeeds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => feedService.refreshAllFeeds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: subscriptionKeys.lists() 
      })
    },
  })
}
```

### UI 触发点

- **Layout 组件**: 提供"刷新所有"按钮 (`frontend/apps/web/src/components/Layout.tsx:102`)
- **订阅页面**: 可添加单个 Feed 刷新按钮
- **自动触发**: 订阅新 Feed 时自动刷新

## 数据流图

```
┌─────────────┐
│  定时任务    │ (每15分钟)
│ scheduled_  │
│   fetch     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│fetch_all_   │ 查询到期 Feed
│  feeds()    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Redis 队列  │ 入队任务
└──────┬──────┘
       │
       ▼
┌─────────────┐
│fetch_feed_  │ 执行刷新任务
│   task()    │
└──────┬──────┘
       │
       ├──► HTTP 条件请求
       │    (ETag/Last-Modified)
       │
       ├──► 解析 Feed (feedparser)
       │
       ├──► 检查新文章 (GUID 去重)
       │
       ├──► 保存新文章到数据库
       │
       └──► 更新 Feed 状态和下次刷新时间
```

## 总结

Glean 的文章刷新机制具有以下特点:

1. **自动化**: 定时任务每 15 分钟自动刷新所有到期 Feed
2. **高效**: HTTP 条件请求减少不必要的下载
3. **可靠**: 完善的错误处理和重试机制
4. **灵活**: 支持手动触发刷新
5. **去重**: 基于 GUID 的文章去重机制
6. **可扩展**: 基于 Redis 队列的分布式任务处理

该设计确保了用户能够及时获取最新的文章内容，同时最大程度地减少服务器和网络资源的消耗。

