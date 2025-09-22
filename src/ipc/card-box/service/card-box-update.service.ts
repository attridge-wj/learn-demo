import { AppDataSource } from '../../../database/connection'
import { CardBoxEntity } from '../entities/sys_card_box.entity'
import type { UpdateCardBoxDto } from '../dto/index.dto'

export async function updateCardBox(id: string, updateDto: UpdateCardBoxDto) {
  try {
    const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
    const cardBox = await cardBoxRepo.findOne({ where: { id, delFlag: 0 } })
    if (!cardBox) throw new Error('卡片盒不存在')

    const result = await cardBoxRepo.update(id, {
      ...updateDto,
      updateTime: new Date().toISOString()
    })

    return {
      ...cardBox,
      ...updateDto,
      updateTime: new Date().toISOString()
    }
  } catch (error) {
    console.error('更新卡片盒失败:', error)
    throw error
  }
} 