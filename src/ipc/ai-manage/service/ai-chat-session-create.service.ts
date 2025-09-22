import { AppDataSource } from '../../../database/connection'
import { AiChatSessionEntity } from '../entities/sys_ai_chat_session.entity'
import type { CreateAiChatSessionDto } from '../dto/index.dto'

export async function createAiChatSession(createDto: CreateAiChatSessionDto) {
  try {
    const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
    
    // 检查是否已存在相同的id
    const existingSession = await sessionRepo.findOne({ 
      where: { 
        id: createDto.id, 
        delFlag: 0 
      } 
    })
    
    if (existingSession) {
      throw new Error('该会话ID已存在')
    }

    const session = sessionRepo.create({
      id: createDto.id,
      title: createDto.title,
      modelName: createDto.modelName,
      promptTemplateId: createDto.promptTemplateId,
      spaceId: createDto.spaceId,
      messageCount: createDto.messageCount || 0,
      totalTokens: createDto.totalTokens || 0,
      lastMessageTime: createDto.lastMessageTime || new Date().toISOString(),
      chatType: createDto.chatType || 'chat'
    })

    const result = await sessionRepo.save(session)
    return result
  } catch (error) {
    console.error('创建AI对话会话失败:', error)
    throw error
  }
} 