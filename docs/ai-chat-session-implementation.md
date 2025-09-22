# AI对话会话功能实现总结

## 功能概述

在现有的AI管理模块中，新增了一个对话会话实体类 `AiChatSessionEntity`，用于存储对话列表信息。这个功能解决了查看对话历史记录不方便的问题，现在可以通过对话会话列表快速浏览和管理对话。

## 实现的功能

### 1. 新增实体类

**文件**: `src/ipc/ai-manage/entities/sys_ai_chat_session.entity.ts`

- 创建了 `AiChatSessionEntity` 实体类
- 继承自 `BaseEntity`，包含基础字段（id, delFlag, createTime等）
- 包含对话会话相关字段：
  - `id`: 主键ID（即会话ID，与历史记录表的sessionId对应）
  - `title`: 对话标题（第一个用户问题）
  - `modelName`: AI模型名称
  - `promptTemplateId`: 使用的提示词模板ID
  - `spaceId`: 空间ID
  - `messageCount`: 对话消息数量
  - `totalTokens`: 总token使用量
  - `lastMessageTime`: 最后消息时间
  - `chatType`: 对话类型（chat-对话，card-知识卡片问答，doc-文档问答）

### 2. 新增DTO接口

**文件**: `src/ipc/ai-manage/dto/index.dto.ts`

添加了以下DTO接口：
- `CreateAiChatSessionDto`: 创建对话会话
- `UpdateAiChatSessionDto`: 更新对话会话
- `QueryAiChatSessionDto`: 查询对话会话

### 3. 新增服务类

创建了以下服务类：

- `src/ipc/ai-manage/service/ai-chat-session-get-all.service.ts` - 获取所有对话会话
- `src/ipc/ai-manage/service/ai-chat-session-create.service.ts` - 创建对话会话
- `src/ipc/ai-manage/service/ai-chat-session-update.service.ts` - 更新对话会话
- `src/ipc/ai-manage/service/ai-chat-session-delete.service.ts` - 删除对话会话

### 4. 新增IPC接口

**文件**: `src/ipc/ai-manage/index.ts`

添加了以下IPC处理程序：

- `ai-chat-session:create` - 创建对话会话
- `ai-chat-session:getAll` - 获取对话会话列表
- `ai-chat-session:getOne` - 获取单个对话会话
- `ai-chat-session:update` - 更新对话会话
- `ai-chat-session:delete` - 删除对话会话
- `ai-chat-session:deleteBatch` - 批量删除对话会话


### 5. 自动创建逻辑

**文件**: `src/ipc/ai-manage/service/ai-chat-history-create.service.ts`

修改了AI对话历史记录创建服务，增加了自动创建对话会话的逻辑：

- 当创建用户消息时，自动检查并创建对话会话记录
- 当创建助手回复时，自动更新会话的token统计
- 自动截取用户第一条消息的前100个字符作为对话标题

### 6. 数据库配置

**文件**: `src/database/connection.ts`

- 在数据库连接中添加了 `AiChatSessionEntity` 实体类
- 确保新表在应用启动时自动创建

### 7. 性能优化

**文件**: `src/database/add-indexes.ts`

为AI对话会话表添加了索引优化：


- `space_id` 索引：提升按空间查询的性能
- `model_name` 索引：提升按模型查询的性能
- `title` 索引：提升标题搜索的性能
- `chat_type` 索引：提升按对话类型查询的性能
- `create_time` 索引：提升按时间排序的性能
- `last_message_time` 索引：提升按最后消息时间查询的性能

## 使用方式

### 1. 自动创建

当创建AI对话历史记录时，系统会自动处理对话会话的创建：

```typescript
// 创建用户消息时，自动创建对话会话
await window.aiManageApi.chatHistory.create({
  id: 'msg_1',
  sessionId: 'session_123', // 这个sessionId会作为对话会话的id
  role: 'user',
  content: '你好，请帮我解释一下什么是人工智能？',
  modelName: 'gpt-3.5-turbo',
  chatType: 'chat' // chat-对话，card-知识卡片问答，doc-文档问答
})
```

### 2. 获取对话列表

```typescript
// 获取所有对话会话
const sessions = await window.aiManageApi.chatSession.queryAll({
  chatType: 'chat' // 可选：按对话类型筛选
})
```

### 3. 获取特定对话的消息

```typescript
// 获取该对话的所有消息
const messages = await window.aiManageApi.chatHistory.queryAll({
  sessionId: 'session_123'
})
```

## 数据结构关系

```
sys_ai_chat_session (对话会话表)
├── id: 主键 (即会话ID，与历史记录表的sessionId对应)
├── title: 对话标题
├── modelName: AI模型
├── messageCount: 消息数量
├── totalTokens: 总token使用量
├── lastMessageTime: 最后消息时间
└── chatType: 对话类型

sys_ai_chat_history (对话历史记录表)
├── id: 主键
├── sessionId: 会话ID (关联会话表的id)
├── role: 角色 (user/assistant)
├── content: 消息内容
├── modelName: AI模型
├── tokensUsed: 使用的token数量
├── chatType: 对话类型
└── context: 上下文内容 (知识库及文档的文字内容)
```

## 优势

1. **便捷的对话管理**：通过对话会话列表可以快速浏览所有对话
2. **自动统计**：自动统计每个对话的消息数量和token使用量
3. **性能优化**：通过索引提升查询性能
4. **向后兼容**：不影响现有的AI对话历史记录功能
5. **自动创建**：无需手动创建对话会话，系统会自动处理

## 注意事项

1. 对话会话记录会在创建第一条用户消息时自动创建
2. 会话标题会自动截取用户第一条消息的前100个字符
3. 消息数量和token统计会在每次创建历史记录时自动更新
4. 删除对话会话会同时删除相关的历史记录（软删除）
 