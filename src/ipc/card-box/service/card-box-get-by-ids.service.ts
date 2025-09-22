import { AppDataSource } from '../../../database/connection'
import { CardBoxEntity } from '../entities/sys_card_box.entity'
import type { CardBoxIdsDto } from '../dto/index.dto'

export async function getCardBoxesByIds(cardBoxIdsDto: CardBoxIdsDto) {
  try {
    const { ids } = cardBoxIdsDto
    if (!ids || ids.length === 0) return []

    const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
    const cardBoxes = await cardBoxRepo.createQueryBuilder('box')
      .select(['box.id', 'box.name'])
      .where('box.id IN (:...ids)', { ids })
      .andWhere('box.delFlag = :delFlag', { delFlag: 0 })
      .orderBy('box.updateTime', 'DESC')
      .getMany()

    return cardBoxes
  } catch (error) {
    console.error('批量获取卡片盒详情失败:', error)
    throw error
  }
} 