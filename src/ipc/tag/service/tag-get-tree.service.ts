import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import type { QueryTagDto } from '../dto/index.dto'
import { TagHierarchyUtil } from '../util/tag-hierarchy.util'

export async function getTagTree(query: QueryTagDto) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const qb = tagRepo.createQueryBuilder('tag')
      .where('tag.delFlag = :delFlag', { delFlag: 0 })
    
    // 基础查询条件
    if (query.spaceId) {
      qb.andWhere('tag.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.type) {
      qb.andWhere('tag.type = :type', { type: query.type })
    }

    if (query.name) {
      qb.andWhere('tag.name LIKE :name', { name: `%${query.name}%` })
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

    const tags = await qb.getMany()
    
    // 构建树结构
    const tree = TagHierarchyUtil.buildTagTree(tags)
    
    // 添加统计信息
    const stats = {
      totalCount: tags.length,
      topLevelCount: tags.filter(t => !t.parentId).length,
      hasChildren: tree.some(item => item.children && item.children.length > 0)
    }
    
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
    console.error('获取标签树失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
}

export async function getTagSubTree(parentId: string, query: QueryTagDto = {}) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const qb = tagRepo.createQueryBuilder('tag')
      .where('tag.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('tag.parentId = :parentId', { parentId })
    
    // 基础查询条件
    if (query.spaceId) {
      qb.andWhere('tag.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.type) {
      qb.andWhere('tag.type = :type', { type: query.type })
    }

    if (query.name) {
      qb.andWhere('tag.name LIKE :name', { name: `%${query.name}%` })
    }

    const tags = await qb.getMany()
    
    // 构建子树结构
    const tree = TagHierarchyUtil.buildTagTree(tags, parentId)
    
    return {
      success: true,
      data: {
        list: tree,
        parentId,
        count: tags.length
      },
      message: '查询成功'
    }
  } catch (error) {
    console.error('获取标签子树失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
}

export async function getTagPath(tagId: string) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    
    // 获取标签路径（从根到指定标签的路径）
    const getPath = async (currentTagId: string): Promise<TagEntity[]> => {
      const tag = await tagRepo.findOne({
        where: { id: currentTagId, delFlag: 0 }
      })
      
      if (!tag) return []
      
      if (tag.parentId) {
        const parentPath = await getPath(tag.parentId)
        return [...parentPath, tag]
      } else {
        return [tag]
      }
    }
    
    const path = await getPath(tagId)
    
    return {
      success: true,
      data: {
        path,
        tagId
      },
      message: '查询成功'
    }
  } catch (error) {
    console.error('获取标签路径失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
}