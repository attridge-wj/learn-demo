import { AppDataSource } from '../../../database/connection'
import { AiChatSessionEntity } from '../entities/sys_ai_chat_session.entity'
import type { UpdateAiChatSessionDto } from '../dto/index.dto'

export async function updateAiChatSession(id: string, updateDto: UpdateAiChatSessionDto) {
  try {
    const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
    const session = await sessionRepo.findOne({ where: { id, delFlag: 0 } })
    
    if (!session) {
      throw new Error('AI对话会话不存在')
    }

    // 更新字段
    if (updateDto.title !== undefined) session.title = updateDto.title
    if (updateDto.modelName !== undefined) session.modelName = updateDto.modelName
    if (updateDto.promptTemplateId !== undefined) session.promptTemplateId = updateDto.promptTemplateId
    if (updateDto.spaceId !== undefined) session.spaceId = updateDto.spaceId
    if (updateDto.messageCount !== undefined) session.messageCount = updateDto.messageCount
    if (updateDto.totalTokens !== undefined) session.totalTokens = updateDto.totalTokens
    if (updateDto.lastMessageTime !== undefined) session.lastMessageTime = updateDto.lastMessageTime
    if (updateDto.chatType !== undefined) session.chatType = updateDto.chatType

    const result = await sessionRepo.save(session)
    return result
  } catch (error) {
    console.error('更新AI对话会话失败:', error)
    throw error
  }
} 