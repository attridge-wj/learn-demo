import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import { In } from 'typeorm'
import type { GetCardIdsByTypeDto } from '../dto/index.dto'

/**
 * 通过卡片类型获取被收藏的卡片ID列表
 * @param query 查询条件
 * @returns 卡片ID数组
 */
export async function getCardIdsByType(query: GetCardIdsByTypeDto) {
  try {
    // 验证数据库连接
    if (!AppDataSource.isInitialized) {
      throw new Error('数据库未初始化')
    }

    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 处理 cardTypes 参数，支持字符串和数组两种格式
    let cardTypes: string[]
    if (typeof query.cardTypes === 'string') {
      cardTypes = query.cardTypes.split(',').map(type => type.trim()).filter(Boolean)
    } else {
      cardTypes = query.cardTypes.filter(Boolean)
    }
    
    if (cardTypes.length === 0) {
      return {
        success: true,
        data: [],
        message: '未指定卡片类型'
      }
    }
    
    // 构建查询条件
    const whereCondition: any = {
      delFlag: 0,
      isFolder: 0, // 只查询非文件夹的收藏项
      cardType: In(cardTypes)
    }
    
    // 如果指定了空间ID，则添加空间过滤条件
    if (query.spaceId) {
      whereCondition.spaceId = query.spaceId
    }
    
    // 查询收藏项，只返回卡片ID，添加超时保护
    const collects = await Promise.race([
      collectRepo.find({
        where: whereCondition,
        select: ['cardId']
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('查询超时')), 10000)
      )
    ]) as CollectEntity[]
    
    // 提取卡片ID，过滤掉空值
    const cardIds = collects
      .map(collect => collect.cardId)
      .filter(cardId => cardId) // 过滤掉 null 或 undefined
    
    return {
      success: true,
      data: cardIds,
      message: `成功获取 ${cardIds.length} 个被收藏的卡片ID`
    }
  } catch (error) {
    console.error('通过卡片类型获取收藏卡片ID失败:', error)
    console.error('错误堆栈:', error instanceof Error ? error.stack : '未知错误')
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '查询失败'
    }
  }
}
