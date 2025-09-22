import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import type { QueryCollectDto } from '../dto/index.dto'
import { CollectTreeUtil } from '../util/collect-tree.util'

export async function getCollectTree(query: QueryCollectDto) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    const qb = collectRepo.createQueryBuilder('collect')
      .where('collect.delFlag = :delFlag', { delFlag: 0 })
    console.log(query.spaceId, 'query.spaceId');
    
    // 基础查询条件
    if (query.spaceId) {
      qb.andWhere('collect.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.cardId) {
      qb.andWhere('collect.cardId = :cardId', { cardId: query.cardId })
    }

    if (query.directoryId !== undefined) {
      if (query.directoryId === null) {
        qb.andWhere('collect.directoryId IS NULL')
      } else {
        qb.andWhere('collect.directoryId = :directoryId', { directoryId: query.directoryId })
      }
    }

    if (query.cardType) {
      qb.andWhere('collect.cardType = :cardType', { cardType: query.cardType })
    }

    if (query.subType) {
      qb.andWhere('collect.subType = :subType', { subType: query.subType })
    }

    if (query.name) {
      qb.andWhere('collect.name LIKE :name', { name: `%${query.name}%` })
    }

    if (query.url) {
      qb.andWhere('collect.url LIKE :url', { url: `%${query.url}%` })
    }

    if (query.isFolder !== undefined) {
      qb.andWhere('collect.isFolder = :isFolder', { isFolder: query.isFolder })
    }

    const collects = await qb.getMany()
    console.log(collects, 'collects')
    
    
    // 构建树结构
    const tree = CollectTreeUtil.buildCollectTree(collects)
    
    // 添加统计信息
    const stats = {
      totalCount: collects.length,
      folderCount: collects.filter(c => c.isFolder === 1).length,
      cardCount: collects.filter(c => c.isFolder === 0).length,
      topLevelCount: collects.filter(c => !c.directoryId).length,
      hasChildren: tree.some(item => item.children && item.children.length > 0)
    }
    console.log(tree, 'tree')
    
    return {
      success: true,
      data: {
        list: tree,
        stats,
        query
      },
      message: '查询成功'
    }
  } catch (error) {
    console.error('获取收藏树失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
} 