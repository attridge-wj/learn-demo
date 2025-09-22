# AI对话历史记录 Context 字段使用示例

## 概述

AI对话历史记录实体新增了 `context` 字段，用于在知识库问答及文档问答时存储知识库及文档的文字内容。这个字段可以帮助记录对话的上下文信息，便于后续的对话分析和追踪。

## Context 字段说明

### 字段定义
- **字段名**: `context`
- **类型**: `text`
- **可空**: `true`
- **用途**: 存储知识库及文档的文字内容

### 使用场景

1. **知识卡片问答 (card)**
   - 存储被查询的知识卡片内容
   - 记录知识库的上下文信息

2. **文档问答 (doc)**
   - 存储被查询的文档内容
   - 记录文档的上下文信息

3. **普通对话 (chat)**
   - 通常为空
   - 可根据需要存储对话上下文

## 使用示例

### 1. 创建知识卡片问答记录

```typescript
// 创建知识卡片问答的历史记录
await window.aiManageApi.chatHistory.create({
  id: 'msg_1',
  sessionId: 'session_123',
  role: 'user',
  content: '这个知识卡片讲了什么？',
  modelName: 'gpt-3.5-turbo',
  chatType: 'card',
  context: '这是一个关于人工智能的知识卡片，主要介绍了AI的基本概念、发展历程和应用领域...'
})
```

### 2. 创建文档问答记录

```typescript
// 创建文档问答的历史记录
await window.aiManageApi.chatHistory.create({
  id: 'msg_2',
  sessionId: 'session_123',
  role: 'assistant',
  content: '根据文档内容，我可以为您解释...',
  modelName: 'gpt-3.5-turbo',
  chatType: 'doc',
  context: '文档标题：项目开发规范\n\n第一章 代码规范\n1.1 命名规范\n变量命名应使用驼峰命名法...'
})
```

### 3. 查询包含特定上下文的记录

```typescript
// 查询包含特定关键词的上下文记录
const histories = await window.aiManageApi.chatHistory.queryAll({
  chatType: 'card',
  context: '人工智能' // 查询包含"人工智能"关键词的上下文
})
```

### 4. 更新记录的上下文

```typescript
// 更新历史记录的上下文信息
await window.aiManageApi.chatHistory.update('msg_1', {
  context: '更新后的知识卡片内容：人工智能（AI）是计算机科学的一个分支...'
})
```

## 查询功能

### 支持的操作

1. **模糊查询**: 使用 `LIKE` 操作符进行模糊匹配
2. **类型筛选**: 结合 `chatType` 进行类型筛选
3. **组合查询**: 可以与其他字段组合进行复杂查询

### 查询示例

```typescript
// 查询所有知识卡片问答记录
const cardHistories = await window.aiManageApi.chatHistory.queryAll({
  chatType: 'card'
})

// 查询包含特定关键词的文档问答记录
const docHistories = await window.aiManageApi.chatHistory.queryAll({
  chatType: 'doc',
  context: '项目规范'
})

// 查询特定会话的所有记录
const sessionHistories = await window.aiManageApi.chatHistory.queryAll({
  sessionId: 'session_123'
})
```

## 数据结构

### 完整的 AiChatHistoryEntity 结构

```typescript
interface AiChatHistoryEntity {
  id: string                    // 主键ID
  sessionId: string             // 会话ID
  role: string                  // 角色 (user/assistant)
  content: string               // 消息内容
  modelName?: string            // AI模型名称
  promptTemplateId?: string     // 提示词模板ID
  tokensUsed?: number           // 使用的token数量
  spaceId?: string              // 空间ID
  chatType?: ChatType           // 对话类型
  context?: string              // 上下文内容
  delFlag: number               // 删除标志
  createBy: number              // 创建者
  createTime: string            // 创建时间
  updateBy: number              // 更新者
  updateTime: string            // 更新时间
}
```

## 最佳实践

### 1. Context 内容格式

- **知识卡片**: 存储完整的知识卡片内容
- **文档**: 存储相关的文档片段或摘要
- **长度控制**: 建议控制在合理长度内，避免过长的内容

### 2. 查询优化

- **关键词**: 使用有意义的关键词进行查询
- **类型结合**: 结合 `chatType` 进行精确查询
- **时间范围**: 结合时间范围进行查询

### 3. 数据管理

- **定期清理**: 定期清理过长的context内容
- **备份策略**: 重要对话的context内容需要备份
- **隐私保护**: 注意context内容中可能包含的敏感信息

## 注意事项

1. **存储限制**: context字段为text类型，可以存储大量文本
2. **查询性能**: 对context字段的模糊查询可能影响性能
3. **数据一致性**: 确保context内容与对话内容的一致性
4. **版本控制**: 考虑context内容的版本管理需求 