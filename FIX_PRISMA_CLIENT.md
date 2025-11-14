# 修复 Prisma Client 错误

## 问题
错误信息：`Unknown argument 'enableTranslation'` - Prisma Client 还没有包含新添加的字段。

## 解决步骤

### 1. 停止开发服务器
如果开发服务器正在运行，请先停止它（按 `Ctrl+C`）。

### 2. 检查环境变量
确保 `.env` 文件存在并包含以下变量：

```env
DATABASE_URL="your-database-url"
DIRECT_URL="your-database-url"  # 开发环境通常和 DATABASE_URL 相同
```

如果 `.env` 文件不存在，请从 `env.template` 复制：
```bash
cp env.template .env
```

然后编辑 `.env` 文件，填入你的数据库连接信息。

### 3. 推送数据库 Schema（添加新字段）

```bash
npx prisma db push
```

这个命令会：
- 在数据库中添加 `User.targetLanguage` 字段
- 在数据库中添加 `Feed.enableTranslation` 字段
- 自动重新生成 Prisma Client

### 4. 如果步骤 3 失败，手动生成 Prisma Client

```bash
npx prisma generate
```

### 5. 重启开发服务器

```bash
npm run dev
# 或
pnpm dev
```

## 验证

迁移成功后，你应该能够：
- ✅ 在设置页面设置翻译目标语言
- ✅ 在添加订阅时启用翻译
- ✅ 编辑订阅的翻译设置

## 如果仍有问题

### 方法 1: 使用 Prisma Migrate（推荐用于生产环境）

```bash
npx prisma migrate dev --name add_translation_fields
```

### 方法 2: 手动 SQL（如果上述方法都失败）

连接到你的数据库，运行以下 SQL：

```sql
-- 为 User 表添加 targetLanguage 字段
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "targetLanguage" TEXT DEFAULT 'zh';

-- 为 Feed 表添加 enableTranslation 字段
ALTER TABLE "Feed" ADD COLUMN IF NOT EXISTS "enableTranslation" BOOLEAN DEFAULT false;
```

然后运行：
```bash
npx prisma generate
```

