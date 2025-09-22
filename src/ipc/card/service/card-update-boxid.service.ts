import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { In } from 'typeorm'

/**
 * 修改卡片所属boxId，包括递归修改所有子卡片
 * @param cardId 卡片ID
 * @param newBoxId 新的boxId
 * @param maxDepth 最大递归深度，默认100层
 * @returns 修改结果
 */
export async function updateCardBoxId(cardId: string, newBoxId: string, maxDepth: number = 100): Promise<{
  success: boolean
  updatedCount: number
  message: string
  depthInfo?: {
    maxDepth: number
    actualDepth: number
    totalNodes: number
  }
}> {
  const queryRunner = AppDataSource.createQueryRunner()
  
  try {
    await queryRunner.connect()
    await queryRunner.startTransaction()
    
    const cardRepo = queryRunner.manager.getRepository(SysCardBaseEntity)
    
    // 1. 检查卡片是否存在
    const card = await cardRepo.findOne({ 
      where: { id: cardId, delFlag: 0 } 
    })
    
    if (!card) {
      await queryRunner.rollbackTransaction()
      return {
        success: false,
        updatedCount: 0,
        message: '卡片不存在'
      }
    }
    
    // 2. 递归查找所有子卡片ID（使用CTE递归查询，效率最高）
    const childCardResult = await getChildCardIdsRecursive(cardId, queryRunner, maxDepth)
    
    if (!childCardResult.success) {
      await queryRunner.rollbackTransaction()
      return {
        success: false,
        updatedCount: 0,
        message: childCardResult.message
      }
    }
    
    // 3. 批量更新所有相关卡片（包括当前卡片和所有子卡片）
    const allCardIds = [cardId, ...childCardResult.cardIds]
    const updateResult = await cardRepo.update(
      { id: In(allCardIds) },
      { 
        boxId: newBoxId,
        updateTime: new Date().toISOString()
      }
    )
    
    await queryRunner.commitTransaction()
    
    return {
      success: true,
      updatedCount: updateResult.affected || 0,
      message: `成功修改 ${updateResult.affected || 0} 张卡片的boxId`,
      depthInfo: {
        maxDepth,
        actualDepth: childCardResult.actualDepth,
        totalNodes: childCardResult.cardIds.length + 1
      }
    }
    
  } catch (error) {
    await queryRunner.rollbackTransaction()
    console.error('修改卡片boxId失败:', error)
    return {
      success: false,
      updatedCount: 0,
      message: `修改失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  } finally {
    await queryRunner.release()
  }
}

/**
 * 使用递归CTE查询获取所有子卡片ID（支持无限层级，但有安全限制）
 * @param parentId 父卡片ID
 * @param queryRunner 查询运行器
 * @param maxDepth 最大递归深度
 * @returns 子卡片ID数组和深度信息
 */
async function getChildCardIdsRecursive(parentId: string, queryRunner: any, maxDepth: number = 10): Promise<{
  success: boolean
  cardIds: string[]
  actualDepth: number
  message: string
}> {
  try {
    // 使用递归CTE查询，一次性获取所有层级的子卡片
    // SQLite兼容版本，不使用string_to_array函数
    const result = await queryRunner.query(`
      WITH RECURSIVE card_tree AS (
        -- 基础查询：直接子卡片
        SELECT id, parent_id, 1 as level, id as path
        FROM sys_card_base 
        WHERE parent_id = ? AND del_flag = 0
        
        UNION ALL
        
        -- 递归查询：子卡片的子卡片
        SELECT c.id, c.parent_id, ct.level + 1, ct.path || ',' || c.id
        FROM sys_card_base c
        INNER JOIN card_tree ct ON c.parent_id = ct.id
        WHERE c.del_flag = 0 
          AND ct.level < ?  -- 限制最大深度
          AND c.id != ct.path  -- 防止直接自引用
          AND instr(ct.path, ',' || c.id || ',') = 0  -- 防止循环引用（SQLite兼容）
      )
      SELECT id, level FROM card_tree
      ORDER BY level, id
    `, [parentId, maxDepth])
    
    if (result.length === 0) {
      return {
        success: true,
        cardIds: [],
        actualDepth: 0,
        message: '没有找到子卡片'
      }
    }
    
    const cardIds = result.map((row: any) => row.id)
    const actualDepth = Math.max(...result.map((row: any) => row.level))
    
    // 检查是否达到最大深度限制
    if (actualDepth >= maxDepth) {
      console.warn(`警告: 卡片树达到最大深度限制 ${maxDepth}，可能存在更深层的子卡片`)
    }
    
    return {
      success: true,
      cardIds,
      actualDepth,
      message: `找到 ${cardIds.length} 张子卡片，最大深度 ${actualDepth}`
    }
    
  } catch (error) {
    console.error('递归查询子卡片失败:', error)
    return {
      success: false,
      cardIds: [],
      actualDepth: 0,
      message: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

/**
 * 获取卡片及其子卡片的详细信息（支持无限层级）
 * @param cardId 卡片ID
 * @param maxDepth 最大递归深度，默认10层（用于显示）
 * @returns 卡片树结构
 */
export async function getCardTreeInfo(cardId: string, maxDepth: number = 10): Promise<{
  card: SysCardBaseEntity | null
  children: SysCardBaseEntity[]
  totalCount: number
  depthInfo: {
    maxDepth: number
    actualDepth: number
    hasMoreLevels: boolean
  }
}> {
  const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)
  
  // 获取当前卡片
  const card = await cardRepo.findOne({ 
    where: { id: cardId, delFlag: 0 } 
  })
  
  if (!card) {
    return {
      card: null,
      children: [],
      totalCount: 0,
      depthInfo: {
        maxDepth,
        actualDepth: 0,
        hasMoreLevels: false
      }
    }
  }
  
  // 获取所有子卡片（限制深度用于显示）
  const childResult = await getChildCardIdsRecursive(cardId, AppDataSource.createQueryRunner(), maxDepth)
  
  if (!childResult.success) {
    return {
      card,
      children: [],
      totalCount: 0,
      depthInfo: {
        maxDepth,
        actualDepth: 0,
        hasMoreLevels: false
      }
    }
  }
  
  // 获取直接子卡片（第一层）
  const directChildren = await cardRepo.find({
    where: { parentId: cardId, delFlag: 0 },
    order: { createTime: 'ASC' }
  })
  
  return {
    card,
    children: directChildren,
    totalCount: childResult.cardIds.length,
    depthInfo: {
      maxDepth,
      actualDepth: childResult.actualDepth,
      hasMoreLevels: childResult.actualDepth >= maxDepth
    }
  }
}

/**
 * 检测卡片树中是否存在循环引用
 * @param cardId 卡片ID
 * @returns 检测结果
 */
export async function detectCircularReference(cardId: string): Promise<{
  hasCircular: boolean
  circularPath?: string[]
  message: string
}> {
  const queryRunner = AppDataSource.createQueryRunner()
  
  try {
    await queryRunner.connect()
    
    // SQLite兼容版本
    const result = await queryRunner.query(`
      WITH RECURSIVE card_tree AS (
        SELECT id, parent_id, 1 as level, id as path
        FROM sys_card_base 
        WHERE id = ? AND del_flag = 0
        
        UNION ALL
        
        SELECT c.id, c.parent_id, ct.level + 1, ct.path || ',' || c.id
        FROM sys_card_base c
        INNER JOIN card_tree ct ON c.parent_id = ct.id
        WHERE c.del_flag = 0 
          AND ct.level < 1000  -- 设置一个较大的限制用于检测
          AND c.id != ct.path  -- 防止直接自引用
          AND instr(ct.path, ',' || c.id || ',') = 0  -- 防止循环引用
      )
      SELECT path, level
      FROM card_tree 
      WHERE instr(path, ',' || id || ',') > 0  -- 检测循环引用（SQLite兼容）
      LIMIT 1
    `, [cardId])
    
    if (result.length > 0) {
      const circularPath = result[0].path.split(',').filter((id: string) => id)
      return {
        hasCircular: true,
        circularPath,
        message: `检测到循环引用: ${circularPath.join(' -> ')}`
      }
    }
    
    return {
      hasCircular: false,
      message: '未检测到循环引用'
    }
    
  } catch (error) {
    console.error('检测循环引用失败:', error)
    return {
      hasCircular: false,
      message: `检测失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  } finally {
    await queryRunner.release()
  }
} 