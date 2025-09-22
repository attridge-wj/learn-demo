import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { TagEntity } from '../../tag/entities/sys_tag.entity'
import { StatisticsQueryDto } from '../dto/statistics.dto'

/**
 * 统计卡片数据
 * @param query 查询条件
 * @returns 统计数据
 */
export async function getCardStatistics(query: StatisticsQueryDto) {
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const baseQuery = repo.createQueryBuilder('card')
    .where('card.delFlag = :delFlag', { delFlag: 0 })

  if (query.spaceId) {
    baseQuery.andWhere('card.spaceId = :spaceId', { spaceId: query.spaceId })
  }

  // 统计卡片集合数量(draw-board,mind-map,multi-table)
  const cardSetCount = await baseQuery.clone()
    .andWhere('card.cardType IN (:...types)', {
      types: ['draw-board', 'mind-map', 'multi-table']
    })
    .getCount()

  // 统计标记数量(markNumber >= 1) 
  const markCount = await baseQuery.clone()
    .andWhere('card.markNumber >= :markNumber', { markNumber: 1 })
    .getCount()

  // 统计日记数量
  const diaryCount = await baseQuery.clone()
    .andWhere('card.cardType = :type', { type: 'diary' })
    .getCount()

  // 统计普通卡片数量(排除draw-board,mind-map,multi-table)
  const cardCount = await baseQuery.clone()
    .andWhere('card.cardType NOT IN (:...types)', {
      types: ['draw-board', 'mind-map', 'multi-table']
    })
    .getCount()

  // 统计附件数量
  const attachmentCount = await baseQuery.clone()
    .andWhere('card.cardType = :type', { type: 'attachment' })
    .getCount()

  // 统计标签数量，标签来自模块D:\chuangye\rebirth-electron\src\ipc\tag
  const tagRepo = AppDataSource.getRepository(TagEntity)
  const tagCount = await tagRepo.createQueryBuilder('tag')
    .where('tag.delFlag = :delFlag', { delFlag: 0 })
    .getCount()

  return {
    cardCount,
    cardSetCount,
    diaryCount,
    markCount,
    attachmentCount,
    tagCount
  }
} 