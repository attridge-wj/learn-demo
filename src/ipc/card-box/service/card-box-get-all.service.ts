import { AppDataSource } from '../../../database/connection'
import { CardBoxEntity } from '../entities/sys_card_box.entity'
import type { QueryCardBoxDto } from '../dto/index.dto'

export async function getAllCardBoxes(query: QueryCardBoxDto) {
  try {
    const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
    const qb = cardBoxRepo.createQueryBuilder('cardBox')
      .where('cardBox.delFlag = :delFlag', { delFlag: 0 })

    if (query.name) {
      qb.andWhere('cardBox.name LIKE :name', { name: `%${query.name}%` })
    }

    if (query.spaceId) {
      qb.andWhere('cardBox.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.shareMode) {
      qb.andWhere('cardBox.shareMode = :shareMode', { shareMode: query.shareMode })
    }

    if (query.type) {
      qb.andWhere('cardBox.type = :type', { type: query.type })
    }

    if (query.addLocation !== undefined) {
      qb.andWhere('cardBox.addLocation = :addLocation', { addLocation: query.addLocation })
    }

    qb.orderBy('cardBox.updateTime', 'DESC')

    const cardBoxes = await qb.getMany()
    return cardBoxes
  } catch (error) {
    console.error('查询卡片盒列表失败:', error)
    throw error
  }
} 