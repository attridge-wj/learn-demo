import { AppDataSource } from '../../../database/connection'
import { AiChatHistoryEntity } from '../entities/sys_ai_chat_history.entity'
import type { QueryAiChatHistoryDto } from '../dto/index.dto'

export async function getAllAiChatHistories(query: QueryAiChatHistoryDto) {
  try {
    const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
    const qb = historyRepo.createQueryBuilder('history')
      .where('history.delFlag = :delFlag', { delFlag: 0 })

    if (query.sessionId) {
      qb.andWhere('history.sessionId = :sessionId', { sessionId: query.sessionId })
    }

    if (query.role) {
      qb.andWhere('history.role = :role', { role: query.role })
    }

    if (query.modelName) {
      qb.andWhere('history.modelName = :modelName', { modelName: query.modelName })
    }

    // if (query.spaceId) {
    //   qb.andWhere('history.spaceId = :spaceId', { spaceId: query.spaceId })
    // }

    if (query.chatType) {
      qb.andWhere('history.chatType = :chatType', { chatType: query.chatType })
    }

    if (query.context) {
      qb.andWhere('history.context LIKE :context', { context: `%${query.context}%` })
    }

    if (query.startTime) {
      qb.andWhere('history.createTime >= :startTime', { startTime: query.startTime })
    }

    if (query.endTime) {
      qb.andWhere('history.createTime <= :endTime', { endTime: query.endTime })
    }

    qb.orderBy('history.createTime', 'DESC')

    const histories = await qb.getMany()
    return histories
  } catch (error) {
    console.error('查询AI对话历史记录失败:', error)
    throw error
  }
} 