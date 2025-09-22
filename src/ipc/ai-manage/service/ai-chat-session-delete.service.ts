import { AppDataSource } from '../../../database/connection'
import { AiChatSessionEntity } from '../entities/sys_ai_chat_session.entity'

export async function deleteAiChatSession(id: string) {
  try {
    const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
    const session = await sessionRepo.findOne({ where: { id, delFlag: 0 } })
    
    if (!session) {
      throw new Error('AI对话会话不存在')
    }

    // 软删除
    session.delFlag = 1
    const result = await sessionRepo.save(session)
    return result
  } catch (error) {
    console.error('删除AI对话会话失败:', error)
    throw error
  }
} 