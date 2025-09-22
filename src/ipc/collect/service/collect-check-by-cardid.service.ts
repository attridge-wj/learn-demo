import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'

export async function checkCollectByCardId(cardId: string, spaceId?: string) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 构建查询条件
    const whereCondition: any = { cardId, delFlag: 0 }
    if (spaceId) {
      whereCondition.spaceId = spaceId
    }
    
    // 查找是否存在该cardId的收藏
    const collect = await collectRepo.findOne({ 
      where: whereCondition
    })
    
    const isCollected = !!collect

    return {
      success: true,
      data: isCollected,
      message: isCollected ? '该卡片已被收藏' : '该卡片未被收藏'
    }
  } catch (error) {
    console.error('查询卡片收藏状态失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '查询卡片收藏状态失败'
    }
  }
}
