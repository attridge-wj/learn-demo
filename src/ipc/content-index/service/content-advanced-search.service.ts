import { AppDataSource } from '../../../database/connection'
import type { AdvancedSearchRequestDto, SearchResultDto } from '../dto/index.dto'
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

export async function advancedSearchContent(request: AdvancedSearchRequestDto): Promise<SearchResultDto[]> {
  try {
    const { keyword, spaceId, fields = ['text'], limit = 10, offset = 0 } = request

    // 将字段定向到派生文本 FTS 的 text 列
    const fieldQuery = addPrefixWildcardToMatchQuery(`text:${keyword}`)

    const spaceFilter = spaceId ? 'AND b.space_id = ?' : ''
    const params = spaceId ? [fieldQuery, spaceId, limit, offset] : [fieldQuery, limit, offset]
    
    const results: any[] = await AppDataSource.query(`
      SELECT 
        dt.card_id as id,
        COALESCE(b.name, '') AS name,
        COALESCE(b.text, '') AS text,
        COALESCE(b.description, '') AS description,
        COALESCE(b.extra_data, '') AS extra_data,
        COALESCE(b.mark_text, '') AS mark_text,
        '' as rich_text,
        '' as file_content,
        '' as drawboard_content,
        '' as mind_map_content,
        dt.text AS derived_text,
        COALESCE(b.text, '') AS highlight,
        0 AS rank
      FROM card_derived_text_fts dt
      LEFT JOIN sys_card_base b ON b.id = dt.card_id AND b.del_flag = 0
      WHERE dt MATCH ? ${spaceFilter}
      LIMIT ? OFFSET ?
    `, params)

    return semanticReRank(results, keyword)
  } catch (error) {
    console.error('高级搜索失败:', error)
    throw error
  }
}

function buildSearchText(row: any): string {
  return [
    row.name || '',
    row.text || '',
    row.description || '',
    row.rich_text || '',
    row.file_content || '',
    row.drawboard_content || '',
    row.mind_map_content || '',
    row.derived_text || ''
  ].join(' ')
}

function semanticReRank(results: any[], queryText: string) {
  const qv = hashingEmbed(queryText)
  return results
    .map(item => {
      const tv = hashingEmbed(buildSearchText(item))
      const score = cosineSimilarity(qv, tv)
      return { ...item, relevanceScore: score }
    })
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
} 