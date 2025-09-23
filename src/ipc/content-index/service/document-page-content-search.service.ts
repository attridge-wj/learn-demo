import { AppDataSource } from '../../../database/connection'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'

function addPrefixWildcardToMatchQuery(q: string): string {
  if (!q) return q
  const parts = q.split(/\s+/).filter(Boolean)
  const mapped = parts.map(p => {
    if (p === 'OR' || p === 'AND' || p === 'NOT') return p
    let field = ''
    let term = p
    const idx = p.indexOf(':')
    if (idx !== -1) {
      field = p.slice(0, idx + 1)
      term = p.slice(idx + 1)
    }
    if (!term || term.endsWith('*')) return p
    if (term.startsWith('"') || term.includes('"')) return p
    return field + term + '*'
  })
  return mapped.join(' ')
}


/**
 * 搜索文档页面内容
 */
export async function searchDocumentContent(request: {
  keyword: string
  cardId?: string
  spaceId?: string
  limit?: number
  offset?: number
}) {
  try {
    const { keyword, cardId, spaceId, limit = 30, offset = 0 } = request

    if (!keyword || keyword.trim() === '') {
      return []
    }

    // 构建查询条件
    let whereConditions = []
    if (cardId) {
      whereConditions.push('card_id = ?')
    }
    if (spaceId) {
      whereConditions.push('space_id = ?')
    }
    
    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
    const baseParams = [...(cardId ? [cardId] : []), ...(spaceId ? [spaceId] : []), limit, offset]

    // 进行分词搜索
    const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
    console.log('搜索关键词分词结果:', searchKeywords)
    
    if (searchKeywords.length === 0) {
      console.log('分词结果为空，返回空结果')
      return []
    }

    const segmentedKeyword = addPrefixWildcardToMatchQuery(searchKeywords.join(' '))
    console.log('分词搜索关键词:', segmentedKeyword)
    
    try {
      const results = await AppDataSource.query(`
        SELECT
          document_id as documentId,
          space_id as spaceId,
          card_id as cardId,
          file_name as fileName,
          file_type as fileType,
          file_path as filePath,
          origin_path as originPath,
          page_number as pageNumber,
          content,
          rank
        FROM document_page_content_fts
        WHERE content_segmented MATCH ? ${whereClause}
        ORDER BY rank
        LIMIT ? OFFSET ?
      `, [segmentedKeyword, ...baseParams])
      
      console.log('分词FTS5搜索结果数量:', results.length)
      return results
      
    } catch (error) {
      console.error('分词FTS5搜索失败:', error)
      console.error('错误详情:', error instanceof Error ? error.message : String(error))
      return []
    }
  } catch (error) {
    console.error('搜索文档页面内容失败:', error)
    throw error
  }
}

/**
 * 高级搜索文档页面内容
 */
export async function advancedSearchDocumentContent(request: {
  keyword: string
  cardId?: string
  spaceId?: string
  fileType?: string
  fileName?: string
  limit?: number
  offset?: number
}) {
  try {
    const { keyword, cardId, spaceId, fileType, fileName, limit = 10, offset = 0 } = request

    if (!keyword || keyword.trim() === '') {
      return []
    }

    let whereConditions = []
    if (cardId) {
      whereConditions.push('fts.card_id = ?')
    }
    if (spaceId) {
      whereConditions.push('fts.space_id = ?')
    }
    if (fileType) {
      whereConditions.push('fts.file_type = ?')
    }
    if (fileName) {
      whereConditions.push('fts.file_name LIKE ?')
    }
    
    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
    
    // 进行分词搜索
    const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
    if (searchKeywords.length === 0) {
      return []
    }

    const segmentedKeyword = addPrefixWildcardToMatchQuery(searchKeywords.join(' '))
    const params = [segmentedKeyword, ...(cardId ? [cardId] : []), ...(spaceId ? [spaceId] : []), ...(fileType ? [fileType] : []), ...(fileName ? [`%${fileName}%`] : []), limit, offset]
    
    const results = await AppDataSource.query(`
      SELECT 
        fts.document_id as documentId,
        fts.space_id as spaceId,
        fts.card_id as cardId,
        fts.file_name as fileName,
        fts.file_type as fileType,
        fts.file_path as filePath,
        fts.origin_path as originPath,
        fts.page_number as pageNumber,
        fts.content,
        rank
      FROM document_page_content_fts fts
      WHERE content_segmented MATCH ? ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `, params)

    return results
  } catch (error) {
    console.error('高级搜索文档页面内容失败:', error)
    throw error
  }
}

/**
 * 文件搜索
 */
export async function searchFiles(request: {
  keyword: string
  spaceId?: string
  filePath?: string
  fileType?: string
  fileName?: string
  limit?: number
  offset?: number
}) {
  try {
    const { keyword, spaceId, filePath, fileType, fileName, limit = 10, offset = 0 } = request

    if (!keyword || keyword.trim() === '') {
      return []
    }

    let whereConditions = []
    if (spaceId) {
      whereConditions.push('fts.space_id = ?')
    }
    if (filePath) {
      whereConditions.push('fts.file_path = ?')
    }
    if (fileType) {
      whereConditions.push('fts.file_type = ?')
    }
    if (fileName) {
      whereConditions.push('fts.file_name LIKE ?')
    }
    
    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
    
    // 进行分词搜索
    const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
    if (searchKeywords.length === 0) {
      return []
    }

    const segmentedKeyword = addPrefixWildcardToMatchQuery(searchKeywords.join(' '))
    const params = [segmentedKeyword, ...(spaceId ? [spaceId] : []), ...(filePath ? [filePath] : []), ...(fileType ? [fileType] : []), ...(fileName ? [`%${fileName}%`] : []), limit, offset]
    
    const results = await AppDataSource.query(`
      SELECT 
        fts.document_id as documentId,
        fts.space_id as spaceId,
        fts.card_id as cardId,
        fts.file_name as fileName,
        fts.file_type as fileType,
        fts.file_path as filePath,
        fts.origin_path as originPath,
        fts.page_number as pageNumber,
        fts.content,
        rank
      FROM document_page_content_fts fts
      WHERE content_segmented MATCH ? ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `, params)

    return results
  } catch (error) {
    console.error('文件搜索失败:', error)
    throw error
  }
}

/**
 * 获取文档页面内容搜索统计
 */
export async function getDocumentContentSearchCount(keyword: string, cardId?: string, spaceId?: string): Promise<number> {
  try {
    if (!keyword || keyword.trim() === '') {
      return 0
    }

    let whereConditions = []
    if (cardId) {
      whereConditions.push('fts.card_id = ?')
    }
    if (spaceId) {
      whereConditions.push('fts.space_id = ?')
    }
    
    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
    
    // 进行分词搜索
    const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
    if (searchKeywords.length === 0) {
      return 0
    }

    const segmentedKeyword = addPrefixWildcardToMatchQuery(searchKeywords.join(' '))
    const params = [segmentedKeyword, ...(cardId ? [cardId] : []), ...(spaceId ? [spaceId] : [])]
    
    const result = await AppDataSource.query(`
      SELECT COUNT(*) as count
      FROM document_page_content_fts fts
      WHERE content_segmented MATCH ? ${whereClause}
    `, params)

    return parseInt(result[0]?.count || '0', 10)
  } catch (error) {
    console.error('获取文档页面内容搜索统计失败:', error)
    throw error
  }
}

/**
 * 获取文档页面内容索引状态
 */
export async function getDocumentContentIndexStatus() {
  try {
    // 获取总记录数
    let totalRecords = 0
    let indexedRecords = 0
    let lastUpdate: string | null = null

    const rows = await AppDataSource.query(`
      SELECT COUNT(*) as count FROM document_page_content
    `)
    totalRecords = rows[0]?.count || 0

    const ftsRows = await AppDataSource.query(`
      SELECT COUNT(*) as count FROM document_page_content_fts
    `)
    indexedRecords = ftsRows[0]?.count || 0

    const lastUpdateRows = await AppDataSource.query(`
      SELECT MAX(create_time) as lastUpdate FROM document_page_content
    `)
    lastUpdate = lastUpdateRows[0]?.lastUpdate || null

    // 判断索引健康状态
    const isHealthy = indexedRecords > 0 && indexedRecords >= totalRecords * 0.9

    return {
      totalRecords,
      indexedRecords,
      lastUpdate,
      isHealthy
    }
  } catch (error) {
    console.error('获取文档页面内容索引状态失败:', error)
    throw error
  }
}

/**
 * 重建文档页面内容索引
 */
export async function rebuildDocumentContentIndex(): Promise<{ success: number; failed: number }> {
  try {
    console.log('开始重建文档页面内容FTS索引...')

    // 清空现有索引
    await AppDataSource.query(`DELETE FROM document_page_content_fts`)

    // 重新插入数据
    const result = await AppDataSource.query(`
      INSERT INTO document_page_content_fts(document_id, space_id, card_id, file_name, file_type, file_path, origin_path, page_number, content, content_segmented)
      SELECT document_id, COALESCE(space_id, ''), COALESCE(card_id, ''), COALESCE(file_name, ''), COALESCE(file_type, ''), COALESCE(file_path, ''), COALESCE(origin_path, ''), page_number, COALESCE(content, ''), COALESCE(content, '')
      FROM document_page_content
    `)

    // 更新分词字段
    console.log('开始更新分词字段...')
    const documents = await AppDataSource.query(`
      SELECT document_id, content FROM document_page_content
    `)
    
    let updatedCount = 0
    for (const doc of documents) {
      const content = doc.content || ''
      const segmentedContent = ChineseSegmentUtil.toSearchKeywords(content)
      
      await AppDataSource.query(`
        UPDATE document_page_content_fts 
        SET content_segmented = ? 
        WHERE document_id = ?
      `, [segmentedContent, doc.document_id])
      
      updatedCount++
    }
    
    console.log(`分词字段更新完成，共更新 ${updatedCount} 个文档`)

    console.log('文档页面内容FTS索引重建完成')
    return { success: result.affectedRows || 0, failed: 0 }
  } catch (error) {
    console.error('重建文档页面内容FTS索引失败:', error)
    throw error
  }
}

/**
 * 优化文档页面内容索引
 */
export async function optimizeDocumentContentIndex(): Promise<void> {
  try {
    console.log('开始优化文档页面内容FTS索引...')
    await AppDataSource.query(`INSERT INTO document_page_content_fts(document_page_content_fts) VALUES('optimize')`)
    console.log('文档页面内容FTS索引优化完成')
  } catch (error) {
    console.error('优化文档页面内容FTS索引失败:', error)
    throw error
  }
}

/**
 * 清理未知类型的文档索引
 */
export async function cleanUnknownTypeDocuments(): Promise<{ deletedCount: number; ftsDeletedCount: number }> {
  try {
    console.log('开始清理未知类型的文档索引...')
    
    // 先查询要删除的记录数量
    const countResult = await AppDataSource.query(`
      SELECT COUNT(*) as count 
      FROM document_page_content 
      WHERE file_type = 'unknown'
    `)
    const totalCount = parseInt(countResult[0]?.count || '0', 10)
    
    if (totalCount === 0) {
      console.log('没有找到未知类型的文档，无需清理')
      return { deletedCount: 0, ftsDeletedCount: 0 }
    }
    
    console.log(`找到 ${totalCount} 个未知类型的文档，开始清理...`)
    
    // 先删除 FTS5 表中的记录
    const ftsDeleteResult = await AppDataSource.query(`
      DELETE FROM document_page_content_fts 
      WHERE file_type = 'unknown'
    `)
    console.log(`FTS5 表删除记录数: ${ftsDeleteResult.affectedRows || 0}`)
    
    // 再删除主表中的记录
    const deleteResult = await AppDataSource.query(`
      DELETE FROM document_page_content 
      WHERE file_type = 'unknown'
    `)
    console.log(`主表删除记录数: ${deleteResult.affectedRows || 0}`)
    
    const deletedCount = deleteResult.affectedRows || 0
    const ftsDeletedCount = ftsDeleteResult.affectedRows || 0
    console.log(`清理完成，共删除 ${deletedCount} 个未知类型的文档索引（主表）和 ${ftsDeletedCount} 个 FTS5 索引记录`)
    
    return { deletedCount, ftsDeletedCount }
  } catch (error) {
    console.error('清理未知类型文档索引失败:', error)
    throw error
  }
} 
