import { AppDataSource } from '../../../database/connection'

export async function optimizeContentIndex(): Promise<void> {
  try {
    console.log('开始优化全文索引...')
    await AppDataSource.query('INSERT INTO content_search_fts(content_search_fts) VALUES("optimize")')
    console.log('全文索引优化完成')
  } catch (error) {
    console.error('优化索引失败:', error)
    throw error
  }
} 