# AI对话会话功能使用示例

## 概述

AI对话会话功能提供了一个新的实体类 `AiChatSessionEntity`，用于存储对话列表信息。每个对话会话对应一个 `sessionId`，存储该对话的基本信息，包括标题、模型、消息数量等。

## 对话类型

系统支持三种对话类型：

- **chat**: 普通对话
- **card**: 知识卡片问答
- **doc**: 文档问答

这些类型与前端对应，用于区分不同的对话场景。

## 实体关系

- `sys_ai_chat_session` (对话会话表) - 存储对话列表信息
- `sys_ai_chat_history` (对话历史记录表) - 存储具体的消息内容

关系：`sys_ai_chat_session.id` 与 `sys_ai_chat_history.sessionId` 关联

## IPC接口

### 对话会话相关接口

#### 1. 创建对话会话
```typescript
// 前端调用
const result = await window.aiManageApi.chatSession.create({
  id: 'session_123',
  title: '用户的问题标题',
  modelName: 'gpt-3.5-turbo',
  promptTemplateId: 'template_1',
  chatType: 'chat' // chat-对话，card-知识卡片问答，doc-文档问答
})
```

#### 2. 获取对话会话列表
```typescript
// 前端调用
const sessions = await window.aiManageApi.chatSession.queryAll({
  chatType: 'chat', // 可选：chat-对话，card-知识卡片问答，doc-文档问答
  startTime: '2024-01-01',
  endTime: '2024-12-31'
})
```

#### 3. 获取单个对话会话
```typescript
// 前端调用
const session = await window.aiManageApi.chatSession.findOne('session_123')
```

#### 4. 更新对话会话
```typescript
// 前端调用
const result = await window.aiManageApi.chatSession.update('session_123', {
  title: '新的标题',
  messageCount: 10
})
```

#### 5. 删除对话会话
```typescript
// 前端调用
const result = await window.aiManageApi.chatSession.delete('session_123')
```

#### 6. 批量删除对话会话
```typescript
// 前端调用
const result = await window.aiManageApi.chatSession.deleteBatch(['session_123', 'session_456'])
```

## 自动创建逻辑

当创建AI对话历史记录时，系统会自动处理对话会话的创建：

1. **用户消息**：当创建第一条用户消息时，自动创建对话会话记录
2. **助手回复**：当创建助手回复时，自动更新会话的token统计
3. **标题生成**：自动截取用户第一条消息的前100个字符作为对话标题

## 使用场景

### 1. 对话列表展示
```typescript
// 获取所有对话会话
const sessions = await window.aiManageApi.chatSession.queryAll({
  chatType: 'chat' // 可选：按类型筛选
})

// 在UI中展示对话列表
sessions.forEach(session => {
  console.log(`对话: ${session.title}`)
  console.log(`类型: ${session.chatType}`)
  console.log(`消息数: ${session.messageCount}`)
  console.log(`Token使用: ${session.totalTokens}`)
  console.log(`最后消息时间: ${session.lastMessageTime}`)
})
```

### 2. 获取特定对话的消息
```typescript
// 获取该对话的所有消息
const messages = await window.aiManageApi.chatHistory.queryAll({
  sessionId: sessionId
})
```

## 数据结构

### AiChatSessionEntity 字段说明

- `id`: 主键ID（即会话ID，与历史记录表的sessionId对应）
- `title`: 对话标题（第一个用户问题）
- `modelName`: AI模型名称
- `promptTemplateId`: 使用的提示词模板ID
- `spaceId`: 空间ID
- `messageCount`: 对话消息数量
- `totalTokens`: 总token使用量
- `lastMessageTime`: 最后消息时间
- `chatType`: 对话类型（chat-对话，card-知识卡片问答，doc-文档问答）
- `createTime`: 创建时间
- `updateTime`: 更新时间

## 注意事项

1. 对话会话记录会在创建第一条用户消息时自动创建
2. 会话标题会自动截取用户第一条消息的前100个字符
3. 消息数量和token统计会在每次创建历史记录时自动更新
4. 删除对话会话会同时删除相关的历史记录（软删除） 