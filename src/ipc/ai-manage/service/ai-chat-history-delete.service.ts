import { AppDataSource } from '../../../database/connection'
import { AiChatHistoryEntity } from '../entities/sys_ai_chat_history.entity'

export async function deleteAiChatHistory(id: string) {
  try {
    const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
    const history = await historyRepo.findOne({ where: { id, delFlag: 0 } })
    if (!history) throw new Error('AI对话历史记录不存在')

    history.delFlag = 1
    const result = await historyRepo.save(history)
    return result
  } catch (error) {
    console.error('删除AI对话历史记录失败:', error)
    throw error
  }
} 