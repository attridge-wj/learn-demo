import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'

export async function deleteCollectByCardId(cardId: string, spaceId?: string) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 构建查询条件
    const whereCondition: any = { cardId, delFlag: 0 }
    if (spaceId) {
      whereCondition.spaceId = spaceId
    }
    
    // 查找所有包含该cardId的收藏
    const collects = await collectRepo.find({ 
      where: whereCondition
    })
    
    if (collects.length === 0) {
      return {
        success: false,
        data: null,
        message: '该卡片未被收藏'
      }
    }

    // 硬删除所有相关收藏
    await collectRepo.delete(whereCondition)

    return {
      success: true,
      data: {
        deletedCount: collects.length,
        cardId,
        spaceId
      },
      message: `成功删除 ${collects.length} 个相关收藏`
    }
  } catch (error) {
    console.error('通过cardId删除收藏失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '通过cardId删除收藏失败'
    }
  }
}
