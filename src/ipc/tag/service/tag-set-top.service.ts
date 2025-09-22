import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'

export async function setTagTop(id: string, userId: number) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
      if (!tag) throw new Error('标签不存在')

      // 先将所有标签的isTop设置为0
      await tagRepo.update(
        { delFlag: 0 },
        { isTop: '0' }
      )

      // 将目标标签设置为置顶
      await tagRepo.update(
        { id },
        { isTop: '1' }
      )

      return { success: true }
    })
  } catch (error) {
    console.error('设置标签置顶失败:', error)
    throw error
  }
} 