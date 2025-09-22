import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../entities/sys-card-drawboard.entity'
import { SysCardFileEntity } from '../entities/sys-card-file.entity'
import { SysCardMermaidEntity } from '../entities/sys-card-mermaid.entity'
import { SysCardMindMapEntity } from '../entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../entities/sys-card-multi-table.entity'
import { SysCardRichTextEntity } from '../entities/sys-card-rich-text.entity'
import { UpdateCardDto } from '../dto/update-card.dto'
import { v4 as uuidv4 } from 'uuid'
import { updateCardDateForDiary } from './card-date.service'
import { extractPlainText, extractMultiTableText } from '../../content-index/utils/plain-text.util'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { CardDerivedTextEntity } from '../../content-index/entities/card-derived-text.entity'
import { calculateFileMd5 } from '../../../common/util/file-hash.util'
import { resolveFilePath } from '../../../common/util/file-content-parse'
import { CollectEntity } from '../../collect/entities/sys_collect.entity'
import { CardHandleUtil } from '../util/card-handle'
import { getMainWindow } from '../../../window-manage'
import { Not } from 'typeorm'

/**
 * 更新卡片及子表
 * @param id 卡片ID
 * @param cardData 卡片数据
 * @returns 更新后的卡片
 */
export async function updateCard(id: string, cardData: UpdateCardDto) {
  
  if (['card', 'diary', 'mark', 'formula'].includes(cardData?.cardType || '')) {
    getMainWindow()?.webContents.send('card:list:refresh', {
      source: 'update-card',
      id: cardData.id,
      spaceId: cardData.spaceId,
    })
  }
  
  try {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    
    const metadata = repo.metadata
    const validColumns = metadata.columns.map(col => col.propertyName)
    
    const excludeFields = ['content', 'delFlag', 'markList', 'fileSize', 'dataId', 'config', 'cardMap', 'data', 'attrList', 'viewList', 'currentViewId', 'relationTableId', 'parentId', 'boxId']
    
    const baseCardData: { [key: string]: any } = {}
    for (const key in cardData) {
      if (
        !excludeFields.includes(key) && 
        validColumns.includes(key) && 
        (cardData as any)[key] !== undefined && 
        (cardData as any)[key] !== null
      ) {
        baseCardData[key] = (cardData as any)[key]
      }
    }

    // 自动处理 md5 字段（未传入但提供了 localPath 时）
    try {
      if (!('md5' in baseCardData) && cardData.localPath) {
        const realPath = resolveFilePath(cardData.localPath)
        baseCardData.md5 = await calculateFileMd5(realPath)
      }
    } catch (e) {
      console.warn('计算更新卡片 md5 失败，跳过自动填充:', e)
    }

    if (Object.keys(baseCardData).length > 0) {
      baseCardData.updateTime = new Date().toISOString()
      await repo.update({ id }, baseCardData)
    }

    const card = await repo.findOne({ where: { id } })
    if (!card) {
      throw new Error('卡片不存在')
    }

    // 同步更新收藏夹中对应卡片的名称和类型（排除标签类型）
    try {
      const collectRepo = AppDataSource.getRepository(CollectEntity)
      
      // 查找对应cardId的收藏记录，排除标签类型
      const collect = await collectRepo.findOne({
        where: { 
          cardId: id, 
          delFlag: 0,
          isFolder: 0, // 只更新卡片收藏，不更新文件夹
        }
      })
      
      if (collect) {
        const updateData: any = {
        }
        
        // 如果更新了卡片名称，同步更新收藏夹
        if (baseCardData.name && baseCardData.name !== collect.name) {
          updateData.name = baseCardData.name
        }
        
        // 只有当有实际更新内容时才执行更新
        if (Object.keys(updateData).length > 0) { // 除了updateBy和updateTime还有其他字段
          updateData.updateTime = new Date().toISOString()
          await collectRepo.update(collect.id, updateData)
          console.log('同步更新了收藏记录')

          // 发送收藏列表刷新事件
          getMainWindow()?.webContents.send('collect:list:refresh', {
            source: 'update-card',
            id: collect.id,
            spaceId: collect.spaceId,
          })
        }
      }
    } catch (error) {
      console.warn('同步更新收藏夹失败:', error)
      // 不抛出错误，避免影响卡片更新主流程
    }

    const derivedRepo = AppDataSource.getRepository(CardDerivedTextEntity)
    const baseName = card.name || ''
    const baseSpaceId = card.spaceId || ''

    try {
      switch (card.cardType) {
        case 'draw-board': {
          const updateData: any = {}
          if (cardData.content !== undefined) updateData.content = cardData.content
          if (Object.keys(updateData).length > 0) {
            updateData.updateTime = new Date().toISOString()
            await AppDataSource.getRepository(SysCardDrawboardEntity)
              .update({ cardId: id }, updateData)
            // 写入 card_derived_text
            try {
              const description = card.description || ''
              const markText = card.markText || ''
              const baseText = [baseName, description, markText].join(' ')
              const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
              const plain = [baseText, extractPlainText(contentStr)].join(' ')
              const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
              await derivedRepo.save({ cardId: id, cardType: 'draw-board', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
            } catch (e) {
              console.warn('提取/分词画板内容失败，跳过 card_derived_text 更新:', e)
            }
            console.log('执行插入--------------');
            
            // 处理关联关系
            await CardHandleUtil.handleCardRelations(id, 'draw-board', cardData.content)
          }
          break
        }
        case 'attachment': {
          break
        }
        case 'mermaid': {
          break
        }
        case 'mind-map': {
          const updateData: any = {}
          if (cardData.content !== undefined) updateData.content = cardData.content
          if (cardData.cardMap !== undefined) updateData.cardMap = cardData.cardMap
          if (Object.keys(updateData).length > 0) {
            updateData.updateTime = new Date().toISOString()
            await AppDataSource.getRepository(SysCardMindMapEntity)
              .update({ cardId: id }, updateData)
            // 写入 card_derived_text
            try {
              const description = card.description || ''
              const markText = card.markText || ''
              const baseText = [baseName, description, markText].join(' ')
              const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
              const cardMapStr = cardData.cardMap ? (typeof cardData.cardMap === 'string' ? cardData.cardMap : JSON.stringify(cardData.cardMap)) : ''
              const plain = [baseText, extractPlainText(contentStr), extractPlainText(cardMapStr)].filter(Boolean).join(' ')
              if (plain) {
                const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
                await derivedRepo.save({ cardId: id, cardType: 'mind-map', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
              }
            } catch (e) {
              console.warn('提取/分词思维导图失败，跳过 card_derived_text 更新:', e)
            }
            // 处理关联关系
            await CardHandleUtil.handleCardRelations(id, 'mind-map', cardData.content)
          }
          break
        }
        case 'multi-table': {
          const updateData: any = {}
          if (cardData.data !== undefined) updateData.data = cardData.data
          if (cardData.attrList !== undefined) updateData.attrList = cardData.attrList
          if (cardData.viewList !== undefined) updateData.viewList = cardData.viewList
          if (cardData.currentViewId !== undefined) updateData.currentViewId = cardData.currentViewId
          if (cardData.relationTableId !== undefined) updateData.relationTableId = cardData.relationTableId
          if (Object.keys(updateData).length > 0) {
            updateData.updateTime = new Date().toISOString()
            await AppDataSource.getRepository(SysCardMultiTableEntity)
              .update({ cardId: id }, updateData)
            // 写入 card_derived_text
            try {
              const description = card.description || ''
              const markText = card.markText || ''
              const baseText = [baseName, description, markText].join(' ')
              const multiTableText = extractMultiTableText(cardData.data, cardData.attrList, cardData.viewList)
              const plain = [baseText, multiTableText].filter(Boolean).join(' ')
              if (plain) {
                const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
                await derivedRepo.save({ cardId: id, cardType: 'multi-table', name: baseName, spaceId: baseSpaceId, text: segmented, originText: plain })
              }
            } catch (e) {
              console.warn('提取/分词多维表失败，跳过 card_derived_text 更新:', e)
            }
            // 处理关联关系
            await CardHandleUtil.handleCardRelations(id, 'multi-table', undefined, cardData.data)
          }
          break
        }
        case 'card':
        case 'card-date':
        case 'diary':
        default: {
          const richTextUpdateData: any = {}
          if (cardData.content !== undefined) richTextUpdateData.content = cardData.content
          if (Object.keys(richTextUpdateData).length > 0) {
            richTextUpdateData.updateTime = new Date().toISOString()
            await AppDataSource.getRepository(SysCardRichTextEntity)
              .update({ cardId: id }, richTextUpdateData)
            // // 同步更新派生文本（富文本）
            // try {
            //   const description = card.description || ''
            //   const markText = card.markText || ''
            //   const baseText = [baseName, description, markText].join(' ')
            //   const contentStr = typeof cardData.content === 'string' ? cardData.content : JSON.stringify(cardData.content ?? '')
            //   const plain = [baseText, extractPlainText(contentStr)].join(' ')
            //   const segmented = ChineseSegmentUtil.toSearchKeywords(plain)
            //   await derivedRepo.save({ cardId: id, cardType: card.cardType || 'card', name: baseName, spaceId: baseSpaceId, text: segmented })
            // } catch (e) {
            //   console.warn('提取/分词富文本失败，跳过 card_derived_text 更新:', e)
            // }
          }
          break
        }
      }
    } catch (error) {
      console.error('更新子表失败:', error)
      throw new Error('更新子表失败')
    }

    if (card.cardType === 'diary') {
      const result = await updateCardDateForDiary(card.date, card.spaceId)
      if (!result.success) {
        console.warn('更新日期卡片失败:', result.message)
      }
    }

    const updatedCard = await repo.findOne({ where: { id } })
    if (!updatedCard) {
      throw new Error('获取更新后的卡片信息失败')
    }
    return updatedCard
  } catch (error) {
    console.error('更新卡片失败:', error)
    throw error
  }
} 