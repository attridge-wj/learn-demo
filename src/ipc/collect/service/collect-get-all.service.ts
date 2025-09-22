import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import type { QueryCollectDto } from '../dto/index.dto'
import { CollectTreeUtil } from '../util/collect-tree.util'

export async function getAllCollects(query: QueryCollectDto) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    const qb = collectRepo.createQueryBuilder('collect')
      .where('collect.delFlag = :delFlag', { delFlag: 0 })

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

    // 排序：文件夹优先，然后按名称排序，最后按更新时间排序
    qb.orderBy('collect.isFolder', 'DESC')
      .addOrderBy('collect.name', 'ASC')
      .addOrderBy('collect.updateTime', 'DESC')

    const collects = await qb.getMany()
    
    // 使用自定义的 sortOrder 排序
    collects.sort((a, b) => {
      // 首先按 sortOrder 数值排序
      const sortOrderCompare = CollectTreeUtil.compareSortOrder(a.sortOrder, b.sortOrder);
      if (sortOrderCompare !== 0) {
        return sortOrderCompare;
      }
      // 如果 sortOrder 相同，文件夹优先
      if (a.isFolder !== b.isFolder) {
        return b.isFolder - a.isFolder;
      }
      // 最后按名称排序
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
    
    return {
      success: true,
      data: {
        list: collects,
        total: collects.length,
        query
      },
      message: '查询成功'
    }
  } catch (error) {
    console.error('查询收藏列表失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
} 