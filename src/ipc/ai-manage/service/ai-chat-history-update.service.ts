import { AppDataSource } from '../../../database/connection'
import { AiChatHistoryEntity } from '../entities/sys_ai_chat_history.entity'
import type { UpdateAiChatHistoryDto } from '../dto/index.dto'

export async function updateAiChatHistory(id: string, updateDto: UpdateAiChatHistoryDto) {
  try {
    const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
    const history = await historyRepo.findOne({ where: { id, delFlag: 0 } })
    if (!history) throw new Error('AI对话历史记录不存在')

    Object.assign(history, updateDto)
    const result = await historyRepo.save(history)
    return result
  } catch (error) {
    console.error('更新AI对话历史记录失败:', error)
    throw error
  }
} 