import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysRelateIdEntity } from '../entities/sys-relate-id.entity'
import { QueryCardPageDto } from '../dto/query-card.dto'
import { In } from 'typeorm'
import { toPlainObject } from '../index'

/**
 * 分页查询卡片
 * @param query 查询条件
 * @returns 分页结果
 */
export async function findCardPage(query: QueryCardPageDto & { page: number, pageSize: number }) {
  console.log(query, 'findpage')
  const { page = 1, pageSize = 10 } = query;
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const queryBuilder = repo.createQueryBuilder('card')
    .select(['card.id', 'card.name', 'card.text', 'card.isCollect', 'card.extraData', 'card.date', 'card.markNumber',
       'card.cardType', 'card.tagIds', 'card.subType', 'card.description', 'card.coverUrl', 'card.url', 'card.markText', 'card.sourceId'])
    .where('card.delFlag = :delFlag AND card.spaceId = :spaceId', { delFlag: 0, spaceId: query.spaceId })

  if (query.isCollect) {
    queryBuilder.andWhere('card.isCollect = :isCollect', { isCollect: query.isCollect });
    // 执行分页查询
    const [list, total] = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list: toPlainObject(list), total, page, pageSize };
  }

  const typeConditions = []
  let cardTypes: string[] = []
  let hasAttachment = false
  const allSubTypes = ['pdf', 'audio', 'video', 'img', 'card-mark', 'pdf-mark', 'audio-mark', 'video-mark', 'web-clip']
  let subTypes = query.subType ? query.subType.split(',').filter(Boolean) : []
  let excludeSubTypes = allSubTypes.filter(type => !subTypes.includes(type))

  if (query.cardType) {
    const normalTypes = query.cardType.split(',').filter(Boolean)
    // 存在relateId时需要将draw-board、mind-map、multi-table加入到cardTypes中
    cardTypes = query.relateId ? normalTypes.concat(['draw-board', 'mind-map', 'multi-table']) : normalTypes
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

  if (!query.cardType && !query.subType && !query.relateId) {
    return { list: [], total: 0 }
  }

  if (query.relateId && !query.cardType) {
    cardTypes = ['draw-board', 'mind-map', 'multi-table']
    typeConditions.push('card.cardType IN (:...cardTypes)')
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

  if (query.relateId) {
    // 查找所有cardId等于查询relateId的记录
    const relateIdEntities = await AppDataSource.getRepository(SysRelateIdEntity).find({ 
      where: { cardId: query.relateId } 
    })
    
    if (relateIdEntities && relateIdEntities.length > 0) {
      // 提取所有relateId字段的值
      const relateIds = relateIdEntities.map(entity => entity.relateId).filter((id: string) => id)
      
      queryBuilder.andWhere('card.id IN (:...relateIds)', { relateIds })
    } else {
      return { list: [], total: 0, page, pageSize }
    }
    
  }

  if (query.text) {
    queryBuilder.andWhere('card.text LIKE :text', { text: `%${query.text}%` })
  }

  if (query.name) {
    queryBuilder.andWhere('(card.name LIKE :name OR card.text LIKE :name OR card.date LIKE :name OR card.description LIKE :name OR card.markText LIKE :name)',
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
    queryBuilder.andWhere('card.extraData LIKE :extraData', { extraData: `%${query.extraData}%` })
  }

  // 查询出markNumber大于等于传入的markNumber的数据
  if (query.markNumber) {
    queryBuilder.andWhere('card.markNumber >= :markNumber', { markNumber: query.markNumber })
  }

  if (query.keyword) {
    queryBuilder.andWhere('(card.name LIKE :keyword OR card.text LIKE :keyword OR card.description LIKE :keyword)',
      { keyword: `%${query.keyword}%` })
  }

  if (query.startDate && query.endDate) {
    queryBuilder.andWhere('card.createTime BETWEEN :startDate AND :endDate', {
      startDate: query.startDate,
      endDate: query.endDate
    })
  } else if (query.startDate) {
    queryBuilder.andWhere('card.createTime >= :startDate', { startDate: query.startDate })
  } else if (query.endDate) {
    queryBuilder.andWhere('card.createTime <= :endDate', { endDate: query.endDate })
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