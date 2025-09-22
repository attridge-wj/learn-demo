# AI管理模块API使用说明

## 概述

AI管理模块提供了AI对话历史记录和提示词模板的管理功能，通过 `window.aiManageApi` 在渲染进程中调用。

## API结构

```typescript
window.aiManageApi = {
  chatHistory: {
    // AI对话历史记录相关API
  },
  promptTemplate: {
    // 提示词模板相关API
  }
}
```

## AI对话历史记录API

### 创建对话记录
```typescript
const history = await window.aiManageApi.chatHistory.create({
  id: 'unique-id',
  userId: 'user-id',
  sessionId: 'session-id',
  role: 'user', // 'user' 或 'assistant'
  content: '用户消息内容',
  modelName: 'gpt-3.5-turbo',
  promptTemplateId: 'template-id',
  tokensUsed: 100,
  spaceId: 'space-id'
})
```

### 查询对话记录列表
```typescript
const histories = await window.aiManageApi.chatHistory.queryAll({
  userId: 'user-id',
  sessionId: 'session-id',
  role: 'user',
  modelName: 'gpt-3.5-turbo',
  spaceId: 'space-id',
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z'
})
```

### 查询单个对话记录
```typescript
const history = await window.aiManageApi.chatHistory.findOne('history-id')
```

### 更新对话记录
```typescript
const updatedHistory = await window.aiManageApi.chatHistory.update('history-id', {
  content: '更新后的内容',
  tokensUsed: 150
})
```

### 删除对话记录
```typescript
await window.aiManageApi.chatHistory.delete('history-id')
```

### 批量删除对话记录
```typescript
const result = await window.aiManageApi.chatHistory.deleteBatch(['id1', 'id2', 'id3'])
```

## 提示词模板API

### 创建提示词模板
```typescript
const template = await window.aiManageApi.promptTemplate.create({
  id: 'unique-id',
  name: '模板名称',
  description: '模板描述',
  content: '提示词内容',
  category: '写作',
  modelName: 'gpt-3.5-turbo',
  spaceId: 'space-id',
  userId: 'user-id',
  isDefault: 0 // 0-否，1-是
})
```

### 查询提示词模板列表
```typescript
const templates = await window.aiManageApi.promptTemplate.queryAll({
  name: '模板名称',
  category: '写作',
  modelName: 'gpt-3.5-turbo',
  spaceId: 'space-id',
  userId: 'user-id',
  isDefault: 1
})
```

### 查询单个提示词模板
```typescript
const template = await window.aiManageApi.promptTemplate.findOne('template-id')
```

### 更新提示词模板
```typescript
const updatedTemplate = await window.aiManageApi.promptTemplate.update('template-id', {
  name: '新名称',
  content: '新内容',
  isDefault: 1
})
```

### 删除提示词模板
```typescript
await window.aiManageApi.promptTemplate.delete('template-id')
```

### 批量获取提示词模板
```typescript
const templates = await window.aiManageApi.promptTemplate.findByIds({
  ids: ['id1', 'id2', 'id3']
})
```

### 增加使用次数
```typescript
const template = await window.aiManageApi.promptTemplate.incrementUseCount('template-id')
```

### 获取默认模板
```typescript
const defaultTemplate = await window.aiManageApi.promptTemplate.getDefault('space-id')
```

## 数据类型定义

### AI对话历史记录
```typescript
interface AiChatHistory {
  id: string
  userId: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  modelName?: string
  promptTemplateId?: string
  tokensUsed?: number
  spaceId?: string
  createTime: string
  updateTime: string
  delFlag: number
}
```

### 提示词模板
```typescript
interface AiPromptTemplate {
  id: string
  name: string
  description?: string
  content: string
  category?: string
  modelName?: string
  spaceId?: string
  userId: string
  isDefault: number
  useCount: number
  createTime: string
  updateTime: string
  delFlag: number
}
```

## 使用示例

### 完整的AI对话流程
```typescript
// 1. 获取默认提示词模板
const defaultTemplate = await window.aiManageApi.promptTemplate.getDefault()

// 2. 创建用户消息记录
const userMessage = await window.aiManageApi.chatHistory.create({
  id: generateId(),
  userId: currentUserId,
  sessionId: sessionId,
  role: 'user',
  content: userInput,
  modelName: 'gpt-3.5-turbo',
  promptTemplateId: defaultTemplate?.id,
  spaceId: currentSpaceId
})

// 3. 调用AI接口获取回复
const aiResponse = await callAI(userInput, defaultTemplate?.content)

// 4. 创建AI回复记录
const assistantMessage = await window.aiManageApi.chatHistory.create({
  id: generateId(),
  userId: currentUserId,
  sessionId: sessionId,
  role: 'assistant',
  content: aiResponse.content,
  modelName: 'gpt-3.5-turbo',
  tokensUsed: aiResponse.tokensUsed,
  spaceId: currentSpaceId
})

// 5. 如果使用了模板，增加使用次数
if (defaultTemplate) {
  await window.aiManageApi.promptTemplate.incrementUseCount(defaultTemplate.id)
}
```

### 管理提示词模板
```typescript
// 创建新模板
const newTemplate = await window.aiManageApi.promptTemplate.create({
  id: generateId(),
  name: '代码助手',
  description: '用于代码相关的AI助手',
  content: '你是一个专业的代码助手，请帮助用户解决编程问题。',
  category: '编程',
  modelName: 'gpt-3.5-turbo',
  userId: currentUserId,
  spaceId: currentSpaceId,
  isDefault: 0
})

// 查询所有编程类模板
const programmingTemplates = await window.aiManageApi.promptTemplate.queryAll({
  category: '编程',
  spaceId: currentSpaceId
})

// 设置为默认模板
await window.aiManageApi.promptTemplate.update(newTemplate.id, {
  isDefault: 1
})
```

## 注意事项

1. 所有API调用都会自动添加当前空间的 `spaceId`
2. 删除操作都是软删除，数据不会真正从数据库中删除
3. 查询结果按创建时间倒序排列
4. 使用 `createInvoke` 包装的API会自动处理空间ID
5. 使用 `createInvokeWithId` 包装的API适用于需要传递ID参数的场景 