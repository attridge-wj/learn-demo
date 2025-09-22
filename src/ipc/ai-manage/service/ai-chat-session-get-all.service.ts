import { AppDataSource } from '../../../database/connection'
import { AiChatSessionEntity } from '../entities/sys_ai_chat_session.entity'
import type { QueryAiChatSessionDto } from '../dto/index.dto'

export async function getAllAiChatSessions(query: QueryAiChatSessionDto) {
  try {
    const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
    const qb = sessionRepo.createQueryBuilder('session')
      .where('session.delFlag = :delFlag', { delFlag: 0 })

    // 添加查询条件
    if (query.id) {
      qb.andWhere('session.id = :id', { id: query.id })
    }

    if (query.title) {
      qb.andWhere('session.title LIKE :title', { title: `%${query.title}%` })
    }

    if (query.modelName) {
      qb.andWhere('session.modelName = :modelName', { modelName: query.modelName })
    }

    // if (query.spaceId) {
    //   qb.andWhere('session.spaceId = :spaceId', { spaceId: query.spaceId })
    // }

    if (query.chatType) {
      qb.andWhere('session.chatType = :chatType', { chatType: query.chatType })
    }

    if (query.startTime) {
      qb.andWhere('session.createTime >= :startTime', { startTime: query.startTime })
    }

    if (query.endTime) {
      qb.andWhere('session.createTime <= :endTime', { endTime: query.endTime })
    }

    // 按创建时间倒序排列
    qb.orderBy('session.createTime', 'DESC')

    const sessions = await qb.getMany()
    return sessions
  } catch (error) {
    console.error('获取AI对话会话列表失败:', error)
    throw error
  }
} 