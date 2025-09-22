import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'

export async function cancelTagTop(id: string, userId: number) {
  try {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
    if (!tag) throw new Error('标签不存在')
    if (tag.isTop !== '1') throw new Error('该标签未置顶')

    await tagRepo.update(
      { id },
      { isTop: '0' }
    )
    return { success: true }
  } catch (error) {
    console.error('取消标签置顶失败:', error)
    throw error
  }
} 