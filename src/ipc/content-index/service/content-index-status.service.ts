import { AppDataSource } from '../../../database/connection'
import type { IndexStatusDto } from '../dto/index.dto'

export async function getContentIndexStatus(spaceId?: string): Promise<IndexStatusDto> {
  try {
    // 构建条件
    let whereCondition = 'WHERE del_flag = 0'
    const params = []
    
    if (spaceId) {
      whereCondition += ' AND space_id = ?'
      params.push(spaceId)
    }
    
    // 获取总记录数
    const totalResult = await AppDataSource.query(`
      SELECT COUNT(*) as count FROM sys_card_base ${whereCondition}
    `, params)
    
    // 获取已索引记录数
    let indexedQuery = 'SELECT COUNT(*) as count FROM content_search_fts'
    let indexedParams: string[] = []
    
    if (spaceId) {
      indexedQuery = `
        SELECT COUNT(*) as count 
        FROM content_search_fts fts
        LEFT JOIN sys_card_base b ON fts.card_id = b.id
        WHERE b.space_id = ? AND b.del_flag = 0
      `
      indexedParams = [spaceId]
    }
    
    const indexedResult = await AppDataSource.query(indexedQuery, indexedParams)
    
    // 获取最后更新时间
    const lastUpdateResult = await AppDataSource.query(`
      SELECT MAX(create_time) as last_update FROM sys_card_base ${whereCondition}
    `, params)
    
    const totalRecords = totalResult[0]?.count || 0
    const indexedRecords = indexedResult[0]?.count || 0
    const isHealthy = indexedRecords > 0 && indexedRecords >= totalRecords * 0.9
    
    return {
      totalRecords,
      indexedRecords,
      lastUpdate: lastUpdateResult[0]?.last_update || '',
      isHealthy
    }
  } catch (error) {
    console.error('获取索引状态失败:', error)
    throw error
  }
} 