import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'

export async function getOneTag(id: string) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
    if (!tag) throw new Error('标签不存在')
    return tag
  } catch (error) {
    console.error('查询标签失败:', error)
    throw error
  }
} 