import { AppDataSource } from '../../../database/connection'
import type { SearchRequestDto, SearchResultDto } from '../dto/index.dto'
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

function hasCJK(s: string): boolean {
  return /[\u4E00-\u9FFF]/.test(s)
}

function sanitizeForFts(input: string): string {
  if (!input) return ''
  const stripped = input.replace(/[\'(){}\[\]+~^]|\s{2,}/g, ' ').trim()
  return stripped
}

function removeWildcards(q: string): string {
  if (!q) return q
  const parts = q.split(/\s+/).filter(Boolean)
  return parts
    .map(p => {
      if (p === 'OR' || p === 'AND' || p === 'NOT') return p
      const idx = p.indexOf(':')
      if (idx !== -1) {
        const field = p.slice(0, idx + 1)
        const term = p.slice(idx + 1).replace(/\*+$/g, '')
        return field + term
      }
      return p.replace(/\*+$/g, '')
    })
    .join(' ')
}

export async function searchContent(request: SearchRequestDto): Promise<SearchResultDto[]> {
  const { keyword, spaceId, cardType, limit = 30, offset = 0 } = request
  if (!keyword || keyword.trim() === '') return []

  const searchKeywords = ChineseSegmentUtil.extractKeywords(keyword)
  const spaceFilter = spaceId ? 'AND space_id = ?' : ''
  
  // 处理多种卡片类型
  let typeFilter = ''
  let cardTypes: string[] = []
  if (cardType && cardType.trim()) {
    cardTypes = cardType.split(',').filter(Boolean)
    if (cardTypes.length > 0) {
      const placeholders = cardTypes.map(() => '?').join(',')
      typeFilter = `AND card_type IN (${placeholders})`
    }
  }
  
  const baseParams: any[] = []
  if (spaceId) baseParams.push(spaceId)
  if (cardTypes.length > 0) baseParams.push(...cardTypes)

  const runFts = async (q: string) => {
    const sql = `
      SELECT card_id as id, MAX(name) as name, MAX(card_type) as card_type, MAX(text) as text
      FROM card_derived_text_fts
      WHERE card_derived_text_fts MATCH ? ${spaceFilter} ${typeFilter}
      GROUP BY card_id
      LIMIT ? OFFSET ?
    `
    const params = [q, ...baseParams, limit, offset]
    return AppDataSource.query(sql, params)
  }

  let rows: any[] = []
  // 1) 关键词分词 + 前缀通配
  if (searchKeywords.length > 0) {
    const q = addPrefixWildcardToMatchQuery(sanitizeForFts(searchKeywords.join(' ')))
    try { rows = await runFts(q) } catch {}

    // 1b) 若未命中，尝试去掉通配做精确匹配
    if (rows.length === 0) {
      const qExact = removeWildcards(q)
      try { rows = await runFts(qExact) } catch {}
    }
  }

  // 2) 原始关键字 + 前缀通配
  if (rows.length === 0) {
    const q = addPrefixWildcardToMatchQuery(sanitizeForFts(keyword))
    try { rows = await runFts(q) } catch {}

    // 2b) 若未命中，尝试无通配精确匹配
    if (rows.length === 0) {
      const qExact = removeWildcards(q)
      try { rows = await runFts(qExact) } catch {}
    }
  }

  // 3) 中文兜底 LIKE（使用未分词的 origin_text）
  if (rows.length === 0 && hasCJK(keyword)) {
    const like = `%${keyword}%`
    const likeSql = `
      SELECT card_id as id, name, card_type, COALESCE(origin_text, text) as text
      FROM card_derived_text
      WHERE COALESCE(origin_text, text) LIKE ? ${spaceFilter} ${typeFilter}
      GROUP BY card_id
      LIMIT ? OFFSET ?
    `
    rows = await AppDataSource.query(likeSql, [like, ...baseParams, limit, offset])
  }

  // 结果去重（双保险）
  const seen = new Set<string>()
  const mapped: SearchResultDto[] = []
  for (const r of rows) {
    const id = r.id
    if (id && !seen.has(id)) {
      seen.add(id)
      mapped.push({
        id: id,
        name: r.name || '',
        text: r.text || '',
        cardType: r.card_type || undefined,
      })
    }
  }

  const reranked = semanticReRank(mapped, keyword)
  return reranked
}

function buildSearchText(row: SearchResultDto): string {
  return [row.name || '', row.text || ''].join(' ')
}

function semanticReRank(results: SearchResultDto[], queryText: string) {
  const qv = hashingEmbed(queryText)
  return results
    .map(item => {
      const tv = hashingEmbed(buildSearchText(item))
      const score = cosineSimilarity(qv, tv)
      return { ...item, rank: score }
    })
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
} 