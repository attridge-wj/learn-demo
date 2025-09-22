import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { QueryCardDto } from '../dto/query-card.dto'
import { toPlainObject } from '../index'

/**
 * 查询卡片列表
 * @param query 查询条件
 * @returns 卡片列表
 */
export async function getAllCards(query: QueryCardDto) {
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const queryBuilder = repo.createQueryBuilder('card')
    .select(['card.id', 'card.name', 'card.isCollect', 'card.boxId', 'card.text', 'card.markText', 'card.coverUrl', 'card.description', 'card.sourceId', 'card.createTime', 'card.updateTime', 'card.extraData', 'card.cardType', 'card.subType', 'card.url'])
    .where('card.delFlag = :delFlag', { delFlag: 0 })

  if (query.sourceId) {
    queryBuilder.andWhere('card.sourceId = :sourceId', { sourceId: query.sourceId });
  }

  const typeConditions = []
  let cardTypes: string[] = []
  let hasAttachment = false
  const allSubTypes = ['pdf', 'audio', 'video', 'img', 'card-mark', 'pdf-mark', 'audio-mark', 'video-mark']
  let subTypes = query.subType ? query.subType.split(',').filter(Boolean) : []
  let excludeSubTypes = allSubTypes.filter(type => !subTypes.includes(type))

  if (query.cardType) {
    cardTypes = query.cardType.split(',').filter(Boolean)
    hasAttachment = cardTypes.includes('attachment')
    if ((hasAttachment && cardTypes.length > 1) || subTypes.length === 0) {
      if (subTypes.length === 0 && hasAttachment) {
        typeConditions.push('card.cardType IN (:...cardTypes) AND card.subType NOT IN (:...excludeSubTypes)')
      } else {
        typeConditions.push('card.cardType IN (:...cardTypes)')
      }
    }

    if (subTypes.length > 0 && !hasAttachment) {
      typeConditions.push('card.cardType IN (:...cardTypes)')
    }
  }

  if (query.subType) {
    if (hasAttachment) {
      if (excludeSubTypes.length > 0) {
        typeConditions.push('(card.subType NOT IN (:...excludeSubTypes) AND card.subType IS NOT NULL AND  LENGTH(card.subType) > 0)')
      } else if (subTypes.length > 0) {
        typeConditions.push('card.subType IN (:...subTypes)')
      }
    } else if (subTypes.length > 0) {
      typeConditions.push('card.subType IN (:...subTypes)')
    }
  }

  if (typeConditions.length > 0) {
    if (hasAttachment && excludeSubTypes.length > 0) {
      queryBuilder.andWhere(`(${typeConditions.join(' OR ')})`, {
        cardTypes: subTypes.length > 0 ? cardTypes.filter(type => type !== 'attachment') : cardTypes,
        excludeSubTypes
      })
    } else {
      queryBuilder.andWhere(`(${typeConditions.join(' OR ')})`, {
        cardTypes,
        subTypes
      })
    }
  }

  if (query.markNumber) {
    queryBuilder.andWhere('card.markNumber > :markNumber', { markNumber: query.markNumber })
  }

  if (query.spaceId) {
    queryBuilder.andWhere('card.spaceId = :spaceId', { spaceId: query.spaceId })
  }

  if (query.boxId) {
    if (query.boxId === 'none') {
      queryBuilder.andWhere(
        '(card.boxId IS NULL OR card.boxId = :emptyString)',
        { emptyString: '' }
      )
    } else if (query.boxId !== 'all') {
      queryBuilder.andWhere('card.boxId = :boxId', { boxId: query.boxId })
    }
  }

  if (query.text) {
    queryBuilder.andWhere('card.text LIKE :text', { text: `%${query.text}%` })
  }

  if (query.name) {
    queryBuilder.andWhere('(card.name LIKE :name OR card.text LIKE :name OR card.date LIKE :name OR card.description LIKE :name)', 
      { name: `%${query.name}%` })
  }

  if (query.tagId) {
    if (query.tagId === 'none') {
      queryBuilder.andWhere(
        '(card.tagIds IS NULL OR card.tagIds = :emptyString)',
        { emptyString: '' }
      )
    } else {
      queryBuilder.andWhere('card.tagIds LIKE :tagId', { tagId: `%${query.tagId}%` })
    }
  }

  if (query.extraData) {
    queryBuilder.andWhere(
      `JSON_SEARCH(LOWER(card.extraData), 'one', LOWER(:extraDataSearch)) IS NOT NULL`,
      { extraDataSearch: `%${query.extraData}%` }
    )
  }

  if (query.keyword) {
    queryBuilder.andWhere(
      '(card.name LIKE :keyword OR card.text LIKE :keyword OR card.description LIKE :keyword OR JSON_SEARCH(LOWER(card.extraData), "one", LOWER(:keyword)) IS NOT NULL)',
      { keyword: `%${query.keyword}%` }
    )
  }

  if (query.startDate) {
    const startDate = new Date(query.startDate)
    startDate.setHours(0, 0, 0, 0)
    queryBuilder.andWhere('card.createTime >= :startDate', { startDate })
  }

  if (query.endDate) {
    const endDate = new Date(query.endDate)
    endDate.setHours(23, 59, 59, 999)
    queryBuilder.andWhere('card.createTime <= :endDate', { endDate })
  }

  if (query.sortType) {
    const [field, order] = query.sortType.split('_')
    if (field === 'createTime' || field === 'updateTime') {
      queryBuilder.orderBy(`card.${field}`, order.toUpperCase() as 'ASC' | 'DESC')
    }
  } else {
    queryBuilder.orderBy('card.updateTime', 'DESC')
  }

  const cards = await queryBuilder.getMany()
  return toPlainObject(cards)
} 