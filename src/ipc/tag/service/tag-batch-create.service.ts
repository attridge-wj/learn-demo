import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import { v4 as uuidv4 } from 'uuid'
import type { CreateTagDto } from '../dto/index.dto'
import { TagHierarchyUtil } from '../util/tag-hierarchy.util'

// 获取父级排序路径
async function getParentSortPath(tagRepo: any, parentId: string): Promise<string> {
  const parent = await tagRepo.findOne({
    where: { id: parentId, delFlag: 0 },
    select: ['sortOrder']
  })
  return parent?.sortOrder || ''
}

export async function batchCreateTag(createTagDtos: CreateTagDto[], userId: number) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    
    // 验证所有父标签是否存在且在同一空间
    const parentIds = createTagDtos
      .map(dto => dto.parentId)
      .filter((id): id is string => Boolean(id)) // 过滤掉 undefined 并类型断言
      .filter((id, index, arr) => arr.indexOf(id) === index) // 去重
    
    if (parentIds.length > 0) {
      const existingParents = await tagRepo.find({
        where: { id: parentIds, delFlag: 0 }
      })
      
      const existingIds = existingParents.map(parent => parent.id)
      const missingIds = parentIds.filter(id => !existingIds.includes(id))
      
      if (missingIds.length > 0) {
        return {
          success: false,
          data: null,
          message: `父标签不存在: ${missingIds.join(', ')}`
        }
      }
    }

    // 验证所有标签是否在同一空间
    const spaceIds = createTagDtos
      .map(dto => dto.spaceId)
      .filter((id, index, arr) => id && arr.indexOf(id) === index) // 去重
    
    if (spaceIds.length > 1) {
      return {
        success: false,
        data: null,
        message: '批量创建时所有标签必须在同一空间'
      }
    }

    // 批量创建标签
    const tags = await Promise.all(createTagDtos.map(async (dto, index) => {
      let level = 0
      let parentName: string | undefined = undefined
      let fullName = dto.name

      // 如果有父标签，获取父标签信息
      if (dto.parentId) {
        const parentInfo = await TagHierarchyUtil.getParentTagInfo(dto.parentId)
        if (parentInfo) {
          level = parentInfo.level + 1
          parentName = parentInfo.name
          fullName = TagHierarchyUtil.generateFullTagName(dto.name, parentName)
        }
      }

      // 自动设置 sortOrder（如果未提供）
      let sortOrder = dto.sortOrder
      if (sortOrder === undefined) {
        // 查询同级标签下的最大 sortOrder
        const whereCondition: any = {
          spaceId: dto.spaceId,
          delFlag: 0
        }
        
        if (dto.parentId) {
          whereCondition.parentId = dto.parentId
        } else {
          whereCondition.parentId = null
        }
        
        const siblings = await tagRepo.find({
          where: whereCondition,
          select: ['sortOrder']
        })
        
        // 计算下一个排序值
        const maxIndex = siblings.length + index
        const parentSortPath = dto.parentId ? await getParentSortPath(tagRepo, dto.parentId) : ''
        sortOrder = parentSortPath ? `${parentSortPath}-${maxIndex}` : maxIndex.toString()
      }

      return tagRepo.create({
        id: uuidv4(),
        ...dto,
        name: fullName,
        level,
        parentName,
        sortOrder: sortOrder,
        createBy: userId,
        createTime: new Date().toISOString(),
        updateBy: userId,
        updateTime: new Date().toISOString()
      })
    }))
    
    const savedTags = await tagRepo.save(tags)
    
    return {
      success: true,
      data: {
        tags: savedTags,
        count: savedTags.length
      },
      message: `成功批量创建 ${savedTags.length} 个标签`
    }
  } catch (error) {
    console.error('批量创建标签失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '批量创建标签失败'
    }
  }
}
