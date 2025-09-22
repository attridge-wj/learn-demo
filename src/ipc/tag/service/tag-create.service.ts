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

export async function createTag(createTagDto: CreateTagDto, userId: number) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    
    let level = 0
    let parentName: string | undefined = undefined
    let fullName = createTagDto.name

    // 如果有父标签，获取父标签信息
    if (createTagDto.parentId) {
      const parentInfo = await TagHierarchyUtil.getParentTagInfo(createTagDto.parentId)
      if (parentInfo) {
        level = parentInfo.level + 1
        parentName = parentInfo.name
        fullName = TagHierarchyUtil.generateFullTagName(createTagDto.name, parentName)
      }
    }

    // 自动设置 sortOrder（如果未提供）
    let sortOrder = createTagDto.sortOrder
    if (sortOrder === undefined) {
      // 查询同级标签下的最大 sortOrder
      const whereCondition: any = {
        spaceId: createTagDto.spaceId,
        delFlag: 0
      }
      
      if (createTagDto.parentId) {
        whereCondition.parentId = createTagDto.parentId
      } else {
        whereCondition.parentId = null
      }
      
      const siblings = await tagRepo.find({
        where: whereCondition,
        select: ['sortOrder']
      })
      
      // 计算下一个排序值
      const maxIndex = siblings.length
      const parentSortPath = createTagDto.parentId ? await getParentSortPath(tagRepo, createTagDto.parentId) : ''
      sortOrder = parentSortPath ? `${parentSortPath}-${maxIndex}` : maxIndex.toString()
    }

    const tag = tagRepo.create({
      id: uuidv4(),
      ...createTagDto,
      name: fullName,
      level,
      parentName,
      sortOrder: sortOrder
    })
    const savedTag = await tagRepo.save(tag)
    console.log('savedTag', savedTag)
    return savedTag
  } catch (error) {
    console.error('创建标签失败:', error)
    throw error
  }
} 