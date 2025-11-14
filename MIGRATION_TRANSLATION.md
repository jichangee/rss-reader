# 翻译功能数据库迁移说明

## 概述

本次更新添加了翻译功能，需要在数据库中添加新字段。

## 数据库变更

### 1. User 表
- 新增字段：`targetLanguage` (String?, 默认值: "zh")
  - 用于存储用户设置的翻译目标语言

### 2. Feed 表
- 新增字段：`enableTranslation` (Boolean, 默认值: false)
  - 用于标记订阅是否启用翻译

## 迁移步骤

### 方法 1: 使用 Prisma Migrate（推荐）

```bash
# 生成迁移文件
npx prisma migrate dev --name add_translation_fields

# 如果是在生产环境
npx prisma migrate deploy
```

### 方法 2: 使用 Prisma DB Push（开发环境）

```bash
# 直接推送schema变更到数据库
npx prisma db push
```

### 方法 3: 手动SQL（如果上述方法不可用）

```sql
-- 为 User 表添加 targetLanguage 字段
ALTER TABLE "User" ADD COLUMN "targetLanguage" TEXT DEFAULT 'zh';

-- 为 Feed 表添加 enableTranslation 字段
ALTER TABLE "Feed" ADD COLUMN "enableTranslation" BOOLEAN DEFAULT false;
```

## 注意事项

1. **备份数据**：在执行迁移前，请务必备份数据库
2. **默认值**：现有用户的 `targetLanguage` 将默认为 "zh"（中文）
3. **现有订阅**：所有现有订阅的 `enableTranslation` 默认为 false，需要用户手动启用
4. **翻译API**：需要配置 `GOOGLE_TRANSLATE_API_KEY` 环境变量才能使用翻译功能

## 环境变量配置

在 `.env` 文件中添加：

```env
GOOGLE_TRANSLATE_API_KEY="your-google-translate-api-key-here"
```

获取 Google Translate API 密钥：
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择项目
3. 启用 Cloud Translation API
4. 创建 API 密钥
5. 将密钥添加到环境变量

## 功能说明

### 设置页面
- 访问路径：`/settings`
- 功能：设置默认的翻译目标语言

### 添加订阅
- 在添加订阅时可以选择是否启用翻译
- 每个订阅可以独立设置翻译开关

### 编辑订阅
- 在侧边栏的订阅列表中，鼠标悬停可以看到编辑按钮
- 可以修改订阅的翻译设置

### 翻译行为
- 只有启用了翻译的订阅，其文章才会被翻译
- 翻译在获取文章时实时进行，不存储翻译结果
- 如果未配置 API 密钥，翻译功能将被禁用，文章显示原文

