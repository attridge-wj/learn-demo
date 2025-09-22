import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import type { QueryTagDto } from '../dto/index.dto'
import { TagHierarchyUtil } from '../util/tag-hierarchy.util'

export async function getAllTags(query: QueryTagDto) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const qb = tagRepo.createQueryBuilder('tag')
      .where('tag.delFlag = :delFlag', { delFlag: 0 })

    if (query.type) {
      qb.andWhere('tag.type = :type', { type: query.type })
    }

    if (query.name) {
      qb.andWhere('tag.name LIKE :name', { name: `%${query.name}%` })
    }

    if (query.spaceId) {
      qb.andWhere('tag.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.parentId !== undefined) {
      if (query.parentId === null) {
        qb.andWhere('tag.parentId IS NULL')
      } else {
        qb.andWhere('tag.parentId = :parentId', { parentId: query.parentId })
      }
    }

    if (query.level !== undefined) {
      qb.andWhere('tag.level = :level', { level: query.level })
    }

    qb.orderBy('IFNULL(tag.isTop, 0)', 'DESC')
      .addOrderBy('tag.level', 'ASC')
      .addOrderBy('tag.name', 'ASC')
      .addOrderBy('tag.updateTime', 'DESC')

    const tags = await qb.getMany()
    
    // 使用自定义的 sortOrder 排序
    tags.sort((a, b) => {
      // 首先按 sortOrder 数值排序
      const sortOrderCompare = TagHierarchyUtil.compareSortOrder(a.sortOrder, b.sortOrder);
      if (sortOrderCompare !== 0) {
        return sortOrderCompare;
      }
      // 如果 sortOrder 相同，按名称排序
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
    
    return {
      success: true,
      data: tags,
      message: '查询成功'
    }
  } catch (error) {
    console.error('查询标签列表失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
} 