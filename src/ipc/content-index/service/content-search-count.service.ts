import { AppDataSource } from '../../../database/connection'

function sanitizeForFts(input: string): string {
  if (!input) return ''
  return input.replace(/[\'(){}\[\]+~^]|\s{2,}/g, ' ').trim()
}

export async function getSearchCount(keyword: string, spaceId?: string): Promise<number> {
  try {
    if (!keyword || keyword.trim() === '') {
      return 0
    }

    const key = sanitizeForFts(keyword)

    const spaceFilter = spaceId ? 'AND space_id = ?' : ''
    const params: any[] = [key]
    if (spaceId) params.push(spaceId)

    const result = await AppDataSource.query(`
      SELECT COUNT(*) as count
      FROM card_derived_text_fts
      WHERE card_derived_text_fts MATCH ? ${spaceFilter}
    `, params)
    
    return result[0]?.count || 0
  } catch (error) {
    console.error('搜索统计失败:', error)
    throw error
  }
} 