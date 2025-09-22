import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysRelateIdEntity } from '../entities/sys-relate-id.entity'
import { Like } from 'typeorm'
import { toPlainObject } from '../index'

/**
 * 查询引用了指定卡片的列表
 * @param id 卡片ID
 * @returns 引用卡片列表
 */
export async function findRelateCards(id: string) {
  if (!id) {
    return { code: 400, message: '卡片ID不能为空' }
  }

  try {
    const relateRepo = AppDataSource.getRepository(SysRelateIdEntity)
    const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)

    // 从relateId表中查询所有引用了该卡片的记录
    const relateEntities = await relateRepo.find({
      where: {
        relateId: id
      }
    })
    console.log(relateEntities,id, 'relateEntities---------------');
    

    if (!relateEntities.length) {
      return []
    }

    // 获取所有引用卡片的ID
    const cardIds = relateEntities.map(entity => entity.cardId).filter(id => id && id.trim() !== '')

    if (cardIds.length === 0) {
      return []
    }

    // 查询这些卡片的详细信息
    const cards = await cardRepo.createQueryBuilder('card')
      .select([
        'card.id',
        'card.cardType',
        'card.subType', 
        'card.extraData',
        'card.name'
      ])
      .where('card.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('card.id IN (:...cardIds)', { cardIds })
      .getMany()

    return toPlainObject(cards)
  } catch (error) {
    console.error('查询引用卡片失败:', error)
    return { code: 500, message: '查询引用卡片失败' }
  }
} 