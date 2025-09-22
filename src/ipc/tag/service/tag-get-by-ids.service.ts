import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'

export async function getTagsByIds(ids: string[]) {
  try {
    if (!ids || ids.length === 0) return []

    const tagRepo = AppDataSource.getRepository(TagEntity)
    const tags = await tagRepo.createQueryBuilder('tag')
      .select(['tag.id', 'tag.name', 'tag.color'])
      .where('tag.id IN (:...ids)', { ids })
      .andWhere('tag.delFlag = :delFlag', { delFlag: 0 })
      .getMany()

    return tags
  } catch (error) {
    console.error('查询标签列表失败:', error)
    throw error
  }
} 