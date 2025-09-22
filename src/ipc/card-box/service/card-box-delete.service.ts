import { AppDataSource } from '../../../database/connection'
import { CardBoxEntity } from '../entities/sys_card_box.entity'
import { SysCardBaseEntity } from '../../card/entities/sys-card-base.entity'
import { In } from 'typeorm'

export async function deleteCardBox(id: string) {
  try {
    const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
    const cardBox = await cardBoxRepo.findOne({ where: { id, delFlag: 0 } })
    if (!cardBox) throw new Error('卡片盒不存在')
    
    // 软删除卡片盒
    await cardBoxRepo.update(id, { delFlag: 1 })
    
    // 查找并软删除所有boxId为该卡片盒ID的卡片
    const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)
    const cards = await cardRepo.find({ where: { boxId: id, delFlag: 0 } })
    
    if (cards.length > 0) {
      const cardIds = cards.map(card => card.id)
      
      // 软删除主表卡片
      await cardRepo.update({ id: In(cardIds) }, { delFlag: 1, updateTime: new Date().toISOString() })
      
      console.log(`已删除卡片盒 ${id} 及其包含的 ${cards.length} 张卡片`)
    }
    
    return { success: true, deletedCardsCount: cards.length }
  } catch (error) {
    console.error('删除卡片盒失败:', error)
    throw error
  }
} 