import { AppDataSource } from '../../../database/connection'
import { AiChatHistoryEntity } from '../entities/sys_ai_chat_history.entity'
import { AiChatSessionEntity } from '../entities/sys_ai_chat_session.entity'
import type { CreateAiChatHistoryDto } from '../dto/index.dto'

export async function createAiChatHistory(createDto: CreateAiChatHistoryDto) {
  try {
    const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
    const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
    
    // 创建历史记录
    const history = historyRepo.create({
      ...createDto,
      chatType: createDto.chatType || 'chat',
      delFlag: 0
    })
    const result = await historyRepo.save(history)
    
    // 如果是用户的第一条消息，创建或更新对话会话记录
    if (createDto.role === 'user') {
      // 检查是否已存在该sessionId的会话记录
      const existingSession = await sessionRepo.findOne({ 
        where: { 
          id: createDto.sessionId, 
          delFlag: 0 
        } 
      })
      
      if (!existingSession) {
        // 创建新的对话会话记录
        const session = sessionRepo.create({
          id: createDto.sessionId,
          title: createDto.content.length > 100 ? createDto.content.substring(0, 100) + '...' : createDto.content,
          modelName: createDto.modelName,
          promptTemplateId: createDto.promptTemplateId,
          spaceId: createDto.spaceId,
          messageCount: 1,
          totalTokens: createDto.tokensUsed || 0,
          lastMessageTime: new Date().toISOString(),
          chatType: createDto.chatType || 'chat'
        })
        await sessionRepo.save(session)
      } else {
        // 更新现有会话的消息数量和最后消息时间
        existingSession.messageCount = (existingSession.messageCount || 0) + 1
        existingSession.lastMessageTime = new Date().toISOString()
        await sessionRepo.save(existingSession)
      }
    } else if (createDto.role === 'assistant') {
      // 如果是助手的回复，更新会话的token统计
      const existingSession = await sessionRepo.findOne({ 
        where: { 
          id: createDto.sessionId, 
          delFlag: 0 
        } 
      })
      
      if (existingSession) {
        existingSession.totalTokens = (existingSession.totalTokens || 0) + (createDto.tokensUsed || 0)
        existingSession.lastMessageTime = new Date().toISOString()
        await sessionRepo.save(existingSession)
      }
    }
    
    return result
  } catch (error) {
    console.error('创建AI对话历史记录失败:', error)
    throw error
  }
} 