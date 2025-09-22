import { DataSource } from 'typeorm'

// 搜索选项接口
export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  highlight?: boolean
  snippetLength?: number
}

// 搜索结果接口
export interface SearchResult {
  id: string
  name: string
  text: string
  description: string
  cardType: string
  subType: string
  createTime: string
  updateTime: string
  highlight?: {
    name?: string
    text?: string
    description?: string
    richText?: string
    fileContent?: string
    drawboardContent?: string
    mindMapContent?: string
  }
}

/**
 * 使用FTS虚拟表进行全文搜索
 */
export async function searchCards(dataSource: DataSource, options: SearchOptions): Promise<SearchResult[]> {
  try {
    const { query, limit = 50, offset = 0, highlight = true, snippetLength = 100 } = options
    
    if (!query.trim()) {
      return []
    }

    let sql: string
    let params: any[] = []

    if (highlight) {
              // 使用高亮搜索
        sql = `
          SELECT 
            b.id,
            b.name,
            b.text,
            b.description,
            b.card_type as cardType,
            b.sub_type as subType,
            b.create_time as createTime,
            b.update_time as updateTime,
            snippet(card_fts, 0, '<mark>', '</mark>', '...', ${snippetLength}) as name_highlight,
            snippet(card_fts, 1, '<mark>', '</mark>', '...', ${snippetLength}) as text_highlight,
            snippet(card_fts, 2, '<mark>', '</mark>', '...', ${snippetLength}) as description_highlight,
            snippet(card_fts, 8, '<mark>', '</mark>', '...', ${snippetLength}) as rich_text_highlight,
            snippet(card_fts, 7, '<mark>', '</mark>', '...', ${snippetLength}) as file_content_highlight,
            snippet(card_fts, 6, '<mark>', '</mark>', '...', ${snippetLength}) as drawboard_content_highlight,
            snippet(card_fts, 5, '<mark>', '</mark>', '...', ${snippetLength}) as mind_map_content_highlight
          FROM card_fts
          JOIN sys_card_base b ON card_fts.rowid = b.id
          WHERE card_fts MATCH ?
          ORDER BY rank
          LIMIT ? OFFSET ?
        `
      params = [query, limit, offset]
    } else {
      // 简单搜索
      sql = `
        SELECT 
          b.id,
          b.name,
          b.text,
          b.description,
          b.card_type as cardType,
          b.sub_type as subType,
          b.create_time as createTime,
          b.update_time as updateTime
        FROM card_fts
        JOIN sys_card_base b ON card_fts.rowid = b.id
        WHERE card_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `
      params = [query, limit, offset]
    }

    const results = await dataSource.query(sql, params)

    return results.map((row: any) => ({
      id: row.id,
      name: row.name,
      text: row.text,
      description: row.description,
      cardType: row.cardType,
      subType: row.subType,
      createTime: row.createTime,
      updateTime: row.updateTime,
      ...(highlight && {
        highlight: {
          name: row.name_highlight,
          text: row.text_highlight,
          description: row.description_highlight,
          richText: row.rich_text_highlight,
          fileContent: row.file_content_highlight,
          drawboardContent: row.drawboard_content_highlight,
          mindMapContent: row.mind_map_content_highlight
        }
      })
    }))
  } catch (error) {
    console.error('搜索失败:', error)
    throw error
  }
}

/**
 * 获取搜索结果总数
 */
export async function getSearchCount(dataSource: DataSource, query: string): Promise<number> {
  try {
    const result = await dataSource.query(`
      SELECT COUNT(*) as count
      FROM card_fts
      WHERE card_fts MATCH ?
    `, [query])
    
    return result[0]?.count || 0
  } catch (error) {
    console.error('获取搜索结果总数失败:', error)
    throw error
  }
}

/**
 * 搜索建议（自动完成）
 */
export async function getSearchSuggestions(dataSource: DataSource, query: string, limit: number = 10): Promise<string[]> {
  try {
    const results = await dataSource.query(`
      SELECT DISTINCT name
      FROM card_fts
      WHERE card_fts MATCH ? AND name IS NOT NULL
      ORDER BY rank
      LIMIT ?
    `, [query, limit])
    
    return results.map((row: any) => row.name).filter(Boolean)
  } catch (error) {
    console.error('获取搜索建议失败:', error)
    throw error
  }
} 