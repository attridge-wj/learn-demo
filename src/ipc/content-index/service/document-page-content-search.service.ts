import { AppDataSource } from '../../../database/connection'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { hashingEmbed, cosineSimilarity } from '../utils/hashing-embedding.util'

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

    let results: any[] = []
    
    // 优化：先尝试分词搜索，如果结果足够则直接返回
    const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
    console.log('搜索关键词分词结果:', searchKeywords)
    
    if (searchKeywords.length > 0) {
      const segmentedKeyword = addPrefixWildcardToMatchQuery(searchKeywords.join(' '))
      console.log('分词搜索关键词:', segmentedKeyword)
      
      try {
        const segmentedResults = await AppDataSource.query(`
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
        
        results = segmentedResults
        console.log('分词FTS5搜索结果数量:', results.length)
        
        // 如果分词搜索结果足够，直接返回，避免二次查询
        if (results.length >= limit * 0.8) {
          console.log('分词搜索结果充足，跳过原始关键词搜索')
          if (results.length > 0) {
            results = semanticReRankDocs(results, keyword)
          }
          console.log('最终搜索结果数量:', results.length)
          return results
        }
      } catch (error) {
        console.log('分词FTS5搜索失败:', error)
        console.log('错误详情:', error instanceof Error ? error.message : String(error))
      }
    }

    // 只有在分词搜索结果严重不足时才进行原始关键词搜索
    // 提高阈值，减少耗时的原始关键词搜索
    if (results.length === 0) {
      const original = addPrefixWildcardToMatchQuery(keyword)
      try {
        console.log('开始原始关键词搜索，关键词:', original)
        const startTime = Date.now()
        
        const originalResults = await AppDataSource.query(`
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
          WHERE content MATCH ? ${whereClause}
          ORDER BY rank
          LIMIT ? OFFSET ?
        `, [original, ...baseParams])
        
        const endTime = Date.now()
        const searchTime = endTime - startTime
        
        // 合并结果，去重
        const existingIds = new Set(results.map(r => r.documentId))
        const newResults = originalResults.filter(r => !existingIds.has(r.documentId))
        results = [...results, ...newResults]
        
        console.log(`原始关键词FTS5搜索耗时: ${searchTime}ms`)
        console.log('原始关键词FTS5搜索结果数量:', originalResults.length)
        console.log('合并后总结果数量:', results.length)
        
        // 性能警告
        if (searchTime > 1000) {
          console.warn(`⚠️ 原始关键词搜索耗时过长: ${searchTime}ms，建议优化`)
        }
      } catch (error) {
        console.log('原始关键词FTS5搜索失败:', error)
      }
    }

    // 语义重排序
    if (results.length > 0) {
      results = semanticReRankDocs(results, keyword)
    }

    console.log('最终搜索结果数量:', results.length)
    return results
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
    const q = addPrefixWildcardToMatchQuery(keyword)
    const params = [q, ...(cardId ? [cardId] : []), ...(spaceId ? [spaceId] : []), ...(fileType ? [fileType] : []), ...(fileName ? [`%${fileName}%`] : []), limit, offset]
    
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
      WHERE document_page_content_fts MATCH ? ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `, params)

    return semanticReRankDocs(results, keyword)
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
    const q = addPrefixWildcardToMatchQuery(keyword)
    const params = [q, ...(spaceId ? [spaceId] : []), ...(filePath ? [filePath] : []), ...(fileType ? [fileType] : []), ...(fileName ? [`%${fileName}%`] : []), limit, offset]
    
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
      WHERE document_page_content_fts MATCH ? ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `, params)

    return semanticReRankDocs(results, keyword)
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
    const params = [keyword, ...(cardId ? [cardId] : []), ...(spaceId ? [spaceId] : [])]
    
    const result = await AppDataSource.query(`
      SELECT COUNT(*) as count
      FROM document_page_content_fts fts
      WHERE document_page_content_fts MATCH ? ${whereClause}
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
 * 对文档结果做哈希向量重排
 */
function semanticReRankDocs(results: any[], queryText: string) {
  const qv = hashingEmbed(queryText)
  return results
    .map(item => {
      const tv = hashingEmbed(item.content || '')
      const score = cosineSimilarity(qv, tv)
      return { ...item, relevanceScore: score }
    })
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
} 