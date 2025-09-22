// AI对话历史记录相关DTO
export interface CreateAiChatHistoryDto {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  modelName?: string;
  promptTemplateId?: string;
  tokensUsed?: number;
  spaceId?: string;
  chatType?: string;
  context?: string;
}

export interface UpdateAiChatHistoryDto {
  id?: string;
  sessionId?: string;
  role?: string;
  content?: string;
  modelName?: string;
  promptTemplateId?: string;
  tokensUsed?: number;
  spaceId?: string;
  chatType?: string;
  context?: string;
}

export interface QueryAiChatHistoryDto {
  sessionId?: string;
  role?: string;
  modelName?: string;
  spaceId?: string;
  chatType?: string;
  context?: string;
  startTime?: string;
  endTime?: string;
}

// AI对话会话相关DTO
export interface CreateAiChatSessionDto {
  id: string;
  title: string;
  modelName?: string;
  promptTemplateId?: string;
  spaceId?: string;
  messageCount?: number;
  totalTokens?: number;
  lastMessageTime?: string;
  chatType?: string;
}

export interface UpdateAiChatSessionDto {
  id?: string;
  title?: string;
  modelName?: string;
  promptTemplateId?: string;
  spaceId?: string;
  messageCount?: number;
  totalTokens?: number;
  lastMessageTime?: string;
  chatType?: string;
}

export interface QueryAiChatSessionDto {
  id?: string;
  title?: string;
  modelName?: string;
  spaceId?: string;
  chatType?: string;
  startTime?: string;
  endTime?: string;
}

// 提示词模板相关DTO
export interface CreateAiPromptTemplateDto {
  id: string;
  name: string;
  description?: string;
  content: string;
  category?: string;
  modelName?: string;
  spaceId?: string;
  isDefault?: number;
}

export interface UpdateAiPromptTemplateDto {
  id?: string;
  name?: string;
  description?: string;
  content?: string;
  category?: string;
  modelName?: string;
  spaceId?: string;
  isDefault?: number;
}

export interface QueryAiPromptTemplateDto {
  name?: string;
  category?: string;
  modelName?: string;
  spaceId?: string;
  isDefault?: number;
}

export interface PromptTemplateIdsDto {
  ids: string[];
} 