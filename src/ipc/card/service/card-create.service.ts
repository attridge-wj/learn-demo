import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../entities/sys-card-drawboard.entity'
import { SysCardFileEntity } from '../entities/sys-card-file.entity'
import { SysCardMermaidEntity } from '../entities/sys-card-mermaid.entity'
import { SysCardMindMapEntity } from '../entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../entities/sys-card-multi-table.entity'
import { SysCardRichTextEntity } from '../entities/sys-card-rich-text.entity'
import { CreateCardDto } from '../dto/create-card.dto'
import { toPlainObject } from '../index'
import { v4 as uuidv4 } from 'uuid'
import { updateCardDateForDiary } from './card-date.service'
import { extractPlainText, extractMultiTableText } from '../../content-index/utils/plain-text.util'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { CardDerivedTextEntity } from '../../content-index/entities/card-derived-text.entity'
import { calculateFileMd5 } from '../../../common/util/file-hash.util'
import { resolveFilePath } from '../../../common/util/file-content-parse'
import { BrowserWindow } from 'electron'

/**
 * 创建卡片及子表
 * @param cardData 卡片数据
 * @returns 创建的卡片
 */
export async function createCard(cardData: CreateCardDto) {
  console.log(cardData.sourceId, 'cardData.sourceId---------')
  
  // 检查卡片数量限制
  const existingRepo = AppDataSource.getRepository(SysCardBaseEntity)
  const totalCardCount = await existingRepo.count({
    where: {
      delFlag: 0
    }
  })
  
  if (totalCardCount >= 80) {
    // 通知渲染进程卡片数量限制
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('card:limitReached', {
          currentCount: totalCardCount,
          limit: 100,
          message: '卡片数量已达到上限（100张），无法继续创建新卡片'
        })
      }
    })
    return false;
  }
  
  // 检查是否存在已删除的记录
  const existingCard = await existingRepo.findOne({
    where: {
      id: cardData.id,
      delFlag: 1
    }
  })

  if (existingCard) {
    // 如果存在已删除记录则恢复
    await existingRepo.update(
      { id: cardData.id },
      {
        delFlag: 0,
        updateTime: new Date().toISOString()
      }
    )

    // 更新源卡片的标注个数
    if (existingCard.sourceId) {
      await existingRepo.createQueryBuilder()
        .update(SysCardBaseEntity)
        .set({
          markNumber: () => 'COALESCE(mark_number, 0) + 1',
          updateTime: new Date().toISOString()
        })
        .where('id = :id AND del_flag = 0', { id: existingCard.sourceId })
        .execute()
    }

    return toPlainObject(existingCard)
  }

  // 更新源卡片的标记数
  if (cardData.sourceId) {
    console.log(cardData.sourceId, 'cardData.sourceId---before')
    await existingRepo.createQueryBuilder()
      .update(SysCardBaseEntity)
      .set({
        markNumber: () => 'COALESCE(mark_number, 0) + 1', 
        updateTime: new Date().toISOString()
      })
      .where('id = :id AND del_flag = 0', { id: cardData.sourceId })
      .execute()
  }

  // 正式进入创建部分
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  // 自动补充 md5（优先使用传入，其次尝试根据 localPath 计算）
  const toCreate: CreateCardDto = { ...cardData }
  try {
    if (!toCreate.md5 && toCreate.localPath) {
      const realPath = resolveFilePath(toCreate.localPath)
      toCreate.md5 = await calculateFileMd5(realPath)
    }
  } catch (e) {
    console.warn('计算卡片 md5 失败，跳过自动填充:', e)
  }
  const card = repo.create(toCreate)
  const saved = await repo.save(card)

  const derivedRepo = AppDataSource.getRepository(CardDerivedTextEntity)
  const baseName = saved.name || ''
  const baseSpaceId = saved.spaceId || ''

  // 子表插入
  switch (card.cardType) {
    case 'draw-board':
      await AppDataSource.getRepository(SysCardDrawboardEntity).save({ id: uuidv4(), cardId: saved.id, content: cardData.content })
      // 提取纯文本并分词写入 card_derived_text（TypeORM）
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
        const plain = [baseText, extractPlainText(contentStr)].join(' ')
        const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
        await derivedRepo.save({ cardId: saved.id, cardType: 'draw-board', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
      } catch (e) {
        console.warn('提取/分词画板内容失败，跳过 card_derived_text 更新:', e)
      }
      break
    case 'attachment':
      await AppDataSource.getRepository(SysCardFileEntity).save({ id: uuidv4(), cardId: saved.id, content: cardData.content, fileSize: cardData.fileSize })
      // 附件：聚合 base + 文件 content
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
        const plain = [baseText, extractPlainText(contentStr)].join(' ')
        const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
        await derivedRepo.save({ cardId: saved.id, cardType: 'attachment', name: baseName, spaceId: baseSpaceId, text: segmented })
      } catch (e) {
        console.warn('提取/分词附件失败，跳过 card_derived_text 更新:', e)
      }
      break
    case 'mermaid':
      await AppDataSource.getRepository(SysCardMermaidEntity).save({ id: uuidv4(), cardId: saved.id, content: cardData.content })
      // 也写入基础字段，以便能按名称/描述检索
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const segmented = ChineseSegmentUtil.toSearchKeywords(baseText)
        await derivedRepo.save({ cardId: saved.id, cardType: 'mermaid', name: baseName, spaceId: baseSpaceId, text: segmented })
      } catch (e) {
        console.warn('分词 mermaid 基础字段失败，跳过 card_derived_text 更新:', e)
      }
      break
    case 'mind-map':
      await AppDataSource.getRepository(SysCardMindMapEntity).save({ id: uuidv4(), cardId: saved.id, content: cardData.content, cardMap: cardData.cardMap })
      // mind-map: content + cardMap + base 字段
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
        const cardMapStr = cardData.cardMap ? (typeof cardData.cardMap === 'string' ? cardData.cardMap : JSON.stringify(cardData.cardMap)) : ''
        const plain = [baseText, extractPlainText(contentStr), extractPlainText(cardMapStr)].filter(Boolean).join(' ')
        const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
        await derivedRepo.save({ cardId: saved.id, cardType: 'mind-map', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
      } catch (e) {
        console.warn('提取/分词思维导图失败，跳过 card_derived_text 更新:', e)
      }
      break
    case 'multi-table':
      await AppDataSource.getRepository(SysCardMultiTableEntity).save({ id: uuidv4(), cardId: saved.id, data: cardData.data, attrList: cardData.attrList, viewList: cardData.viewList, currentViewId: cardData.currentViewId, relationTableId: cardData.relationTableId })
      // multi-table: 聚合 base + data/attrList/viewList
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const multiTableText = extractMultiTableText(cardData.data, cardData.attrList, cardData.viewList)
        const plain = [baseText, multiTableText].filter(Boolean).join(' ')
        if (plain) {
          const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
          await derivedRepo.save({ cardId: saved.id, cardType: 'multi-table', name: baseName, spaceId: baseSpaceId, text: segmented })
        }
      } catch (e) {
        console.warn('提取/分词多维表失败，跳过 card_derived_text 更新:', e)
      }
      break
    case 'card':
    case 'card-date':
    case 'diary':
    default:
      await AppDataSource.getRepository(SysCardRichTextEntity).save({ id: uuidv4(), cardId: saved.id, content: cardData.content })
      // 提取纯文本并分词写入 card_derived_text（统一入口）
      try {
        const description = saved.description || ''
        const markText = saved.markText || ''
        const baseText = [baseName, description, markText].join(' ')
        const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
        const plain = [baseText, extractPlainText(contentStr)].join(' ')
        const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
        await derivedRepo.save({ cardId: saved.id, cardType: card.cardType || 'card', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
      } catch (e) {
        console.warn('提取/分词富文本失败，跳过 card_derived_text 更新:', e)
      }
      break
  }

  // 增加一步操作，如果是日记，则需要查看当前日期是否有card-date类型的数据，如果没有则创建，如果有则更新
  if (card.cardType === 'diary') {
    const result = await updateCardDateForDiary(card.date, card.spaceId)
    if (!result.success) {
      console.warn('更新日期卡片失败:', result.message)
    }
  }

  return toPlainObject(saved)
} 