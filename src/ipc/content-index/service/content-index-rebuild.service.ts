import { AppDataSource } from '../../../database/connection'
import { extractPlainText, extractMultiTableText } from '../utils/plain-text.util'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { CardDerivedTextEntity } from '../entities/card-derived-text.entity'

export async function rebuildContentIndex(spaceId?: string): Promise<void> {
  try {
    console.log('开始重建全文索引...')
    
    const derivedRepo = AppDataSource.getRepository(CardDerivedTextEntity)
    await derivedRepo.clear()

    const spaceFilter = spaceId ? 'AND b.space_id = ?' : ''
    const spaceParam = spaceId ? [spaceId] : []

    // 画板：base + content
    const drawRows: Array<{ card_id: string, space_id: string, name?: string, description?: string, mark_text?: string, content: string }> = await AppDataSource.query(`
      SELECT b.id as card_id, b.space_id, b.name, b.description, b.mark_text, d.content
      FROM sys_card_base b 
      JOIN sys_card_drawboard d ON d.card_id = b.id
      WHERE b.del_flag = 0 ${spaceFilter}
    `, spaceParam)
    for (const row of drawRows) {
      const baseText = [row.name || '', row.description || '', row.mark_text || ''].join(' ')
      const contentStr = typeof row.content === 'string' ? row.content : JSON.stringify(row.content ?? '')
      const plain = [baseText, extractPlainText(contentStr)].join(' ')
      const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
      await derivedRepo.save({ cardId: row.card_id, name: row.name || '', spaceId: row.space_id || '', cardType: 'draw-board', text: segmented, originText: plain })
    }

    // 思维导图：base + content + card_map
    const mindRows: Array<{ card_id: string, space_id: string, name?: string, description?: string, mark_text?: string, content: any, card_map: any }> = await AppDataSource.query(`
      SELECT b.id as card_id, b.space_id, b.name, b.description, b.mark_text, m.content, m.card_map
      FROM sys_card_base b 
      JOIN sys_card_mind_map m ON m.card_id = b.id
      WHERE b.del_flag = 0 ${spaceFilter}
    `, spaceParam)
    for (const row of mindRows) {
      const baseText = [row.name || '', row.description || '', row.mark_text || ''].join(' ')
      const contentStr = typeof row.content === 'string' ? row.content : JSON.stringify(row.content ?? '')
      const cardMapStr = typeof row.card_map === 'string' ? row.card_map : JSON.stringify(row.card_map ?? '')
      const plain = [baseText, extractPlainText(contentStr), extractPlainText(cardMapStr)].filter(Boolean).join(' ')
      const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
      await derivedRepo.save({ cardId: row.card_id, name: row.name || '', spaceId: row.space_id || '', cardType: 'mind-map', text: segmented, originText: plain })
    }

    // 多维表：base + data/attrList/viewList
    const multiRows: Array<{ card_id: string, space_id: string, name?: string, description?: string, mark_text?: string, data: any, attr_list: any, view_list: any }> = await AppDataSource.query(`
      SELECT b.id as card_id, b.space_id, b.name, b.description, b.mark_text, m.data, m.attr_list, m.view_list
      FROM sys_card_base b 
      JOIN sys_card_multi_table m ON m.card_id = b.id
      WHERE b.del_flag = 0 ${spaceFilter}
    `, spaceParam)
    for (const row of multiRows) {
      const baseText = [row.name || '', row.description || '', row.mark_text || ''].join(' ')
      const multiTableText = extractMultiTableText(row.data, row.attr_list, row.view_list)
      const plain = [baseText, multiTableText].filter(Boolean).join(' ')
      if (plain) {
        const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
        await derivedRepo.save({ cardId: row.card_id, name: row.name || '', spaceId: row.space_id || '', cardType: 'multi-table', text: segmented, originText: plain })
      }
    }

    // 富文本（card/card-date/diary）：base + content
    const richRows: Array<{ card_id: string, space_id: string, name?: string, description?: string, mark_text?: string, content: string }> = await AppDataSource.query(`
      SELECT b.id as card_id, b.space_id, b.name, b.description, b.mark_text, r.content
      FROM sys_card_base b 
      JOIN sys_card_rich_text r ON r.card_id = b.id
      WHERE b.del_flag = 0 ${spaceFilter}
    `, spaceParam)
    for (const row of richRows) {
      const baseText = [row.name || '', row.description || '', row.mark_text || ''].join(' ')
      const contentStr = typeof row.content === 'string' ? row.content : JSON.stringify(row.content ?? '')
      const plain = [baseText, extractPlainText(contentStr)].join(' ')
      const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
      await derivedRepo.save({ cardId: row.card_id, name: row.name || '', spaceId: row.space_id || '', cardType: 'card', text: segmented, originText: plain })
    }

    // 附件（file）：base + content
    const fileRows: Array<{ card_id: string, space_id: string, name?: string, description?: string, mark_text?: string, content: string }> = await AppDataSource.query(`
      SELECT b.id as card_id, b.space_id, b.name, b.description, b.mark_text, f.content
      FROM sys_card_base b 
      JOIN sys_card_file f ON f.card_id = b.id
      WHERE b.del_flag = 0 ${spaceFilter}
    `, spaceParam)
    for (const row of fileRows) {
      const baseText = [row.name || '', row.description || '', row.mark_text || ''].join(' ')
      const contentStr = typeof row.content === 'string' ? row.content : JSON.stringify(row.content ?? '')
      const plain = [baseText, extractPlainText(contentStr)].join(' ')
      const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
      await derivedRepo.save({ cardId: row.card_id, name: row.name || '', spaceId: row.space_id || '', cardType: 'attachment', text: segmented, originText: plain })
    }

    console.log('全文索引重建完成')
  } catch (error) {
    console.error('重建索引失败:', error)
    throw error
  }
} 