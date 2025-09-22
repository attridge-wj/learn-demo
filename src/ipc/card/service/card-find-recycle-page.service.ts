import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { toPlainObject } from '../index'

/**
 * 回收站分页查询
 * @param query 查询条件
 * @returns 分页结果
 */
export async function findRecyclePage(query: { page: number, spaceId: string, pageSize: number, name?: string, cardType?: string, subType?: string, sortType?: string }) {
  const { page = 1, pageSize = 40 } = query;
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const queryBuilder = repo.createQueryBuilder('card')
    .select(['card.id', 'card.name', 'card.text', 'card.isCollect', 'card.extraData', 'card.date', 'card.cardType', 'card.tagIds', 'card.subType', 'card.description', 'card.coverUrl', 'card.url'])
    .where('card.delFlag = :delFlag AND card.spaceId = :spaceId', { delFlag: 1, spaceId: query.spaceId })
  
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

  if (!query.cardType && !query.subType) {
    return { list: [], total: 0 }
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

  if (query.name) {
    queryBuilder.andWhere('(card.name LIKE :name OR card.text LIKE :name OR card.date LIKE :name OR card.description LIKE :name)',
      { name: `%${query.name}%` })
  }

  if (query.sortType) {
    switch (query.sortType) {
      case 'createTime_desc':
        queryBuilder.orderBy('card.createTime', 'DESC')
        break
      case 'createTime_asc':
        queryBuilder.orderBy('card.createTime', 'ASC')
        break
      case 'updateTime_desc':
        queryBuilder.orderBy('card.updateTime', 'DESC')
        break
      case 'updateTime_asc':
        queryBuilder.orderBy('card.updateTime', 'ASC')
        break
      case 'name_asc':
        queryBuilder.orderBy('card.name', 'ASC')
        break
      case 'name_desc':
        queryBuilder.orderBy('card.name', 'DESC')
        break
      default:
        queryBuilder.orderBy('card.updateTime', 'DESC')
    }
  } else {
    queryBuilder.orderBy('card.updateTime', 'DESC')
  }

  const [list, total] = await queryBuilder
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .getManyAndCount()

  return { list: toPlainObject(list), total, page, pageSize }
} 