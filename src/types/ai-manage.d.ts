/**
 * AI管理模块类型定义
 */

// 对话类型
export type ChatType = 'chat' | 'card' | 'doc'

// AI对话历史记录相关类型
export interface CreateAiChatHistoryDto {
  id: string
  sessionId: string
  role: string
  content: string
  modelName?: string
  promptTemplateId?: string
  tokensUsed?: number
  spaceId?: string
  chatType?: ChatType
  context?: string
}

export interface UpdateAiChatHistoryDto {
  id?: string
  sessionId?: string
  role?: string
  content?: string
  modelName?: string
  promptTemplateId?: string
  tokensUsed?: number
  spaceId?: string
  chatType?: ChatType
  context?: string
}

export interface QueryAiChatHistoryDto {
  sessionId?: string
  role?: string
  modelName?: string
  spaceId?: string
  chatType?: ChatType
  context?: string
  startTime?: string
  endTime?: string
}

export interface AiChatHistoryEntity {
  id: string
  sessionId: string
  role: string
  content: string
  modelName?: string
  promptTemplateId?: string
  tokensUsed?: number
  spaceId?: string
  chatType?: ChatType
  context?: string
  delFlag: number
  createBy: number
  createTime: string
  updateBy: number
  updateTime: string
}

// AI对话会话相关类型
export interface CreateAiChatSessionDto {
  id: string
  title: string
  modelName?: string
  promptTemplateId?: string
  spaceId?: string
  messageCount?: number
  totalTokens?: number
  lastMessageTime?: string
  chatType?: ChatType
}

export interface UpdateAiChatSessionDto {
  id?: string
  title?: string
  modelName?: string
  promptTemplateId?: string
  spaceId?: string
  messageCount?: number
  totalTokens?: number
  lastMessageTime?: string
  chatType?: ChatType
}

export interface QueryAiChatSessionDto {
  id?: string
  title?: string
  modelName?: string
  spaceId?: string
  chatType?: ChatType
  startTime?: string
  endTime?: string
}

export interface AiChatSessionEntity {
  id: string
  title: string
  modelName?: string
  promptTemplateId?: string
  spaceId?: string
  messageCount?: number
  totalTokens?: number
  lastMessageTime?: string
  chatType?: ChatType
  delFlag: number
  createBy: number
  createTime: string
  updateBy: number
  updateTime: string
}

// 提示词模板相关类型
export interface CreateAiPromptTemplateDto {
  id: string
  name: string
  description?: string
  content: string
  category?: string
  modelName?: string
  spaceId?: string
  isDefault?: number
}

export interface UpdateAiPromptTemplateDto {
  id?: string
  name?: string
  description?: string
  content?: string
  category?: string
  modelName?: string
  spaceId?: string
  isDefault?: number
}

export interface QueryAiPromptTemplateDto {
  name?: string
  category?: string
  modelName?: string
  spaceId?: string
  isDefault?: number
}

export interface PromptTemplateIdsDto {
  ids: string[]
}

export interface AiPromptTemplateEntity {
  id: string
  name: string
  description?: string
  content: string
  category?: string
  modelName?: string
  spaceId?: string
  isDefault?: number
  useCount?: number
  delFlag: number
  createBy: number
  createTime: string
  updateBy: number
  updateTime: string
}

// AI管理API接口类型
export interface AiManageApi {
  chatHistory: {
    create: (data: CreateAiChatHistoryDto) => Promise<AiChatHistoryEntity>
    queryAll: (query?: QueryAiChatHistoryDto) => Promise<AiChatHistoryEntity[]>
    findOne: (id: string) => Promise<AiChatHistoryEntity>
    update: (id: string, data: UpdateAiChatHistoryDto) => Promise<AiChatHistoryEntity>
    delete: (id: string) => Promise<AiChatHistoryEntity>
    deleteBatch: (ids: string[]) => Promise<{ success: boolean; count: number }>
  }
  chatSession: {
    create: (data: CreateAiChatSessionDto) => Promise<AiChatSessionEntity>
    queryAll: (query?: QueryAiChatSessionDto) => Promise<AiChatSessionEntity[]>
    findOne: (id: string) => Promise<AiChatSessionEntity>
    update: (id: string, data: UpdateAiChatSessionDto) => Promise<AiChatSessionEntity>
    delete: (id: string) => Promise<AiChatSessionEntity>
    deleteBatch: (ids: string[]) => Promise<{ success: boolean; count: number }>
  }
  promptTemplate: {
    create: (data: CreateAiPromptTemplateDto) => Promise<AiPromptTemplateEntity>
    queryAll: (query?: QueryAiPromptTemplateDto) => Promise<AiPromptTemplateEntity[]>
    findOne: (id: string) => Promise<AiPromptTemplateEntity>
    update: (id: string, data: UpdateAiPromptTemplateDto) => Promise<AiPromptTemplateEntity>
    delete: (id: string) => Promise<AiPromptTemplateEntity>
    findByIds: (data: PromptTemplateIdsDto) => Promise<AiPromptTemplateEntity[]>
    incrementUseCount: (id: string) => Promise<AiPromptTemplateEntity>
    getDefault: (spaceId?: string) => Promise<AiPromptTemplateEntity>
  }
}

// 扩展全局Window接口
declare global {
  interface Window {
    aiManageApi: AiManageApi
  }
} 