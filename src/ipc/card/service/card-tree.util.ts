import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { toPlainObject } from '../index'
import store from '../../../utils/store';
/**
 * 构建树形结构的通用函数
 * @param items 要构建树形结构的项目数组
 * @param parentId 父级ID，默认为null（根级）
 * @returns 树形结构数组
 */
export function buildCardTree(items: any[], parentId: string | null = null): any[] {
  const tree: any[] = []
  
  for (const item of items) {
    // 处理parentId为空字符串或null的情况
    const itemParentId = item.parentId || null
    if (itemParentId === parentId) {
      const node = {
        ...toPlainObject(item),
        children: buildCardTree(items, item.id)
      }
      
      // 如果没有子节点，则移除children属性
      if (node.children.length === 0) {
        delete node.children
      }
      
      tree.push(node)
    }
  }
  
  return tree
}

/**
 * 查询卡片集数据的通用函数
 * @param boxIds 卡片盒ID数组，如果为空则查询所有
 * @returns 卡片数据数组
 */
export async function queryCardSetData(boxIds?: string[]) {
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const spaceId = store.get('spaceId')
  // 一次性查询所有卡片集数据，使用索引优化查询
  const queryBuilder = repo.createQueryBuilder('card')
    .select([
      'card.id',
      'card.name', 
      'card.coverUrl',
      'card.cardType',
      'card.parentId',
      'card.createTime',
      'card.updateTime',
      'card.extraData',
      'card.spaceId',
      'card.boxId',
      'card.isCollect',
      'card.tagIds'
    ])
    .where('card.delFlag = :delFlag', { delFlag: 0 })
    .andWhere('card.cardType IN (:...cardTypes)', { 
      cardTypes: ['mind-map', 'draw-board', 'multi-table'] 
    })
    .andWhere('card.spaceId = :spaceId', { spaceId })
    .orderBy('card.createTime', 'ASC')

  return await queryBuilder.getMany()
}


export async function queryCardSetDataByBoxIds(boxIds?: string[]) {
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  
  // 一次性查询所有卡片集数据，使用索引优化查询
  const queryBuilder = repo.createQueryBuilder('card')
    .select([
      'card.id',
      'card.name', 
      'card.coverUrl',
      'card.cardType',
      'card.parentId',
      'card.createTime',
      'card.updateTime',
      'card.extraData',
      'card.spaceId',
      'card.boxId',
      'card.isCollect',
      'card.tagIds'
    ])
    .where('card.delFlag = :delFlag', { delFlag: 0 })
    .andWhere('card.cardType IN (:...cardTypes)', { 
      cardTypes: ['mind-map', 'draw-board', 'multi-table'] 
    })
    .orderBy('card.createTime', 'ASC')

  // 如果指定了boxIds，则过滤包含指定boxId或boxId为空的数据
  if (boxIds && boxIds.length > 0) {
    if (boxIds.length === 1 && boxIds[0] === '') {
      queryBuilder.andWhere('card.boxId IS NULL OR card.boxId = :emptyString', { emptyString: '' })
    } else {
      queryBuilder.andWhere('card.boxId IN (:...boxIds)', { boxIds })
    }
  }

  return await queryBuilder.getMany()
}

/**
 * 通过单个boxId获取卡片集树形结构
 * @param boxId 卡片盒ID
 * @returns 树形结构数组
 */
export async function getCardSetTree(boxId: string) {
  try {
    const boxIds: string[] = [boxId]
    const cards = await queryCardSetDataByBoxIds(boxIds)
    
    if (!cards || cards.length === 0) {
      return []
    }

    // return buildCardTree(cards)
    return cards;
    
  } catch (error) {
    console.error('获取卡片集树形结构失败:', error)
    throw new Error('获取卡片集树形结构失败')
  }
}

/**
 * 通过boxIds数组获取多个卡片盒的树形结构
 * @param boxIds 卡片盒ID数组
 * @returns 对象格式：{ boxId: [对应boxId的卡片树] }
 */
export async function getCardSetTreeByBoxIds(boxIds: string[]) {
  try {
    if (!boxIds || boxIds.length === 0) {
      return {}
    }
    const cards = await queryCardSetData(boxIds)
    
    if (!cards || cards.length === 0) {
      return {}
    }

    // 按boxId分组构建树形结构
    const result: { [boxId: string]: any[] } = {}
    
    for (const boxId of boxIds) {
      // 过滤出当前boxId的卡片，包括空字符串和null的情况
      const boxCards = cards.filter(card => {
        // 如果当前boxId是空字符串，则匹配空字符串和null
        if (boxId === '') {
          return card.boxId === '' || card.boxId === null
        }
        // 否则严格匹配
        return card.boxId === boxId
      })
      
      if (boxCards.length > 0) {
        // 构建当前boxId的树形结构
        result[boxId] = boxCards;
      } else {
        // 如果没有卡片，返回空数组
        result[boxId] = []
      }
    }
    
    return result
    
  } catch (error) {
    console.error('获取卡片集树形结构失败:', error)
    throw new Error('获取卡片集树形结构失败')
  }
} 