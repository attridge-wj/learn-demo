import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../entities/sys-card-drawboard.entity'
import { SysCardFileEntity } from '../entities/sys-card-file.entity'
import { SysCardMermaidEntity } from '../entities/sys-card-mermaid.entity'
import { SysCardMindMapEntity } from '../entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../entities/sys-card-multi-table.entity'
import { SysCardRichTextEntity } from '../entities/sys-card-rich-text.entity'
import { toPlainObject } from '../index'
import { In } from 'typeorm'

interface DrawboardElement {
  id: string
  cardType: string
}

interface MindMapDataMap {
  [key: string]: any
}

/**
 * 查询单个卡片及子表内容
 * @param id 卡片ID
 * @returns 卡片信息及子表内容
 */
export async function getOneCard(id: string) {
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const card = await repo.findOne({ where: { id } })
  
  if (!card) return null
  
  let content = null
  let mindMapData: MindMapDataMap | null = null
  switch (card.cardType) {
    case 'draw-board':
      content = await AppDataSource.getRepository(SysCardDrawboardEntity).findOne({ where: { cardId: id } })
      if (content?.content) {
        const parsedContent = JSON.parse(content.content)
        if (parsedContent.elements && Array.isArray(parsedContent.elements)) {
          const mindMapIds = parsedContent.elements
            .filter((elem: DrawboardElement) => elem && elem.cardType === 'mind-map')
            .map((elem: DrawboardElement) => elem && elem.id)
          
          if (mindMapIds.length > 0) {
            const mindMapEntities = await AppDataSource.getRepository(SysCardMindMapEntity).find({
              where: { cardId: In(mindMapIds) }
            })
            
            mindMapData = mindMapEntities.reduce((acc: MindMapDataMap, entity) => {
              if (entity.content) {
                acc[entity.cardId] = toPlainObject(JSON.parse(entity.content))
              }
              return acc
            }, {})
          }
        }
      }
      break
    case 'attachment':
      content = await AppDataSource.getRepository(SysCardFileEntity).findOne({ where: { cardId: id } })
      break
    case 'mermaid':
      content = await AppDataSource.getRepository(SysCardMermaidEntity).findOne({ where: { cardId: id } })
      break
    case 'mind-map':
      content = await AppDataSource.getRepository(SysCardMindMapEntity).findOne({ where: { cardId: id } })
      return { 
        ...toPlainObject(card), 
        content: content?.content ? toPlainObject(JSON.parse(content.content)) : null,
        cardMap: content?.cardMap ? toPlainObject(JSON.parse(content.cardMap)) : null 
      }
    case 'multi-table':
      content = await AppDataSource.getRepository(SysCardMultiTableEntity).findOne({ where: { cardId: id } })
      break
    case 'card':
    case 'card-date':
    case 'diary':
    default:
      content = await AppDataSource.getRepository(SysCardRichTextEntity).findOne({ where: { cardId: id } })
      break
  }
  
  return { 
    ...toPlainObject(card), 
    content: content?.content ? toPlainObject(JSON.parse(content.content)) : null,
    extraData: card?.extraData ? toPlainObject(JSON.parse(card.extraData)) : null,
    viewList: (content as any)?.viewList ? toPlainObject(JSON.parse((content as any).viewList)) : null,
    attrList: (content as any)?.attrList ? toPlainObject(JSON.parse((content as any).attrList)) : null,
    currentViewId: (content as any)?.currentViewId ? (content as any).currentViewId : null,
    data: (content as any)?.data ? toPlainObject(JSON.parse((content as any).data)) : null,
    ...(mindMapData && { mindMapData })
  }
} 