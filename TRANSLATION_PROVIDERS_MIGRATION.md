# 翻译服务提供商迁移说明

## 概述

本次更新将翻译服务的 API Key 配置从服务端环境变量迁移到用户前端设置，并新增了小牛翻译和微软翻译两个翻译服务提供商。

## 数据库变更

### 新增字段

在 `User` 表中新增以下字段：

- `translationProvider` (String?) - 翻译服务提供商: `google`, `niutrans`, `microsoft`
- `googleTranslateApiKey` (String?) - Google 翻译 API Key
- `niutransApiKey` (String?) - 小牛翻译 API Key
- `niutransApiSecret` (String?) - 小牛翻译 API Secret
- `microsoftTranslateApiKey` (String?) - 微软翻译 API Key
- `microsoftTranslateRegion` (String?) - 微软翻译服务区域

## 迁移步骤

### 1. 运行数据库迁移

```bash
# 方法 1: 使用 Prisma Migrate（推荐）
npx prisma migrate dev --name add_translation_providers

# 方法 2: 使用 Prisma DB Push（开发环境）
npx prisma db push
```

### 2. 重新生成 Prisma 客户端

```bash
npx prisma generate
```

## 功能说明

### 设置页面

访问 `/settings` 页面，在"翻译设置"部分可以：

1. **选择翻译服务提供商**
   - Google 翻译
   - 小牛翻译
   - 微软翻译

2. **配置各服务的 API Key**
   - **Google 翻译**: 只需配置 API Key
   - **小牛翻译**: 需要配置 API Key 和 API Secret
   - **微软翻译**: 需要配置 API Key 和服务区域

### 获取 API Key

#### Google 翻译
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择项目
3. 启用 Cloud Translation API
4. 创建 API 密钥

#### 小牛翻译
1. 访问 [小牛翻译官网](https://niutrans.com/)
2. 注册并登录账户
3. 在个人中心获取 API Key 和 API Secret

#### 微软翻译
1. 访问 [Azure 门户](https://azure.microsoft.com/zh-cn/services/cognitive-services/translator/)
2. 创建认知服务资源
3. 选择 Translator 服务
4. 获取 API Key 和服务区域（如 `global`, `eastus`, `westeurope`）

## 注意事项

1. **安全性**: API Key 存储在数据库中，请确保数据库安全
2. **迁移**: 如果之前使用环境变量配置 Google 翻译，需要手动在设置页面配置
3. **默认值**: 如果没有配置翻译服务提供商，默认使用 Google 翻译
4. **验证**: 配置 API Key 后，系统会在翻译时验证配置是否正确

## 代码变更

### 修改的文件

1. `prisma/schema.prisma` - 添加新字段
2. `lib/translate.ts` - 支持多个翻译服务提供商
3. `app/api/user/settings/route.ts` - 支持保存和读取翻译配置
4. `app/settings/page.tsx` - 添加翻译服务配置 UI
5. `app/api/articles/[id]/translate/route.ts` - 从用户设置读取翻译配置

## 回滚

如果需要回滚到使用环境变量的方式，可以：

1. 恢复之前的代码版本
2. 运行数据库迁移回滚
3. 重新配置环境变量

