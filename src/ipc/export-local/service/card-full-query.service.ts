import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../../card/entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../../card/entities/sys-card-drawboard.entity'
import { SysCardFileEntity } from '../../card/entities/sys-card-file.entity'
import { SysCardMermaidEntity } from '../../card/entities/sys-card-mermaid.entity'
import { SysCardMindMapEntity } from '../../card/entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../../card/entities/sys-card-multi-table.entity'
import { SysCardRichTextEntity } from '../../card/entities/sys-card-rich-text.entity'
import { SysCardMarkEntity } from '../../card/entities/sys-card-mark.entity'
import { toPlainObject } from '../../card/index'
import { In } from 'typeorm'

/**
 * 批量获取完整的卡片信息（用于导出）
 * @param ids 卡片ID数组
 * @returns 完整的卡片信息数组
 */
export async function batchGetFullCards(ids: string[]) {
  if (!ids || ids.length === 0) {
    return []
  }

  // 一次性查询所有基础卡片数据
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const cards = await repo.createQueryBuilder('card')
    .where('card.id IN (:...ids)', { ids })
    .andWhere('card.delFlag = :delFlag', { delFlag: 0 })
    .getMany()

  const result: any[] = []

  for (const card of cards) {
    let content = null
    let mindMapData: any = null

    // 根据卡片类型获取对应的子表数据
    switch (card.cardType) {
      case 'draw-board':
        content = await AppDataSource.getRepository(SysCardDrawboardEntity).findOne({ where: { cardId: card.id } })
        if (content?.content) {
          const parsedContent = JSON.parse(content.content)
          if (parsedContent.elements && Array.isArray(parsedContent.elements)) {
            const mindMapIds = parsedContent.elements
              .filter((elem: any) => elem.cardType === 'mind-map')
              .map((elem: any) => elem.id)
            
            if (mindMapIds.length > 0) {
              const mindMapEntities = await AppDataSource.getRepository(SysCardMindMapEntity).find({
                where: { cardId: In(mindMapIds) }
              })
              
              mindMapData = mindMapEntities.reduce((acc: any, entity) => {
                if (entity.content) {
                  acc[entity.cardId] = toPlainObject(JSON.parse(entity.content))
                }
                return acc
              }, {})
            }
          }
        }
        break

      case 'mermaid':
        content = await AppDataSource.getRepository(SysCardMermaidEntity).findOne({ where: { cardId: card.id } })
        break

      case 'mind-map':
        content = await AppDataSource.getRepository(SysCardMindMapEntity).findOne({ where: { cardId: card.id } })
        break

      case 'multi-table':
        content = await AppDataSource.getRepository(SysCardMultiTableEntity).findOne({ where: { cardId: card.id } })
        break

      case 'mark':
        content = await AppDataSource.getRepository(SysCardMarkEntity).findOne({ where: { cardId: card.id } })
        break

      case 'card':
      case 'diary':
      default:
        content = await AppDataSource.getRepository(SysCardRichTextEntity).findOne({ where: { cardId: card.id } })
        break
    }

    // 构建完整的卡片数据
    const fullCard = {
      ...toPlainObject(card),
      content: content?.content ? toPlainObject(JSON.parse(content.content)) : null,
      extraData: card?.extraData ? toPlainObject(JSON.parse(card.extraData)) : null,
      viewList: (content as any)?.viewList ? toPlainObject(JSON.parse((content as any).viewList)) : null,
      attrList: (content as any)?.attrList ? toPlainObject(JSON.parse((content as any).attrList)) : null,
      currentViewId: (content as any)?.currentViewId ? (content as any).currentViewId : null,
      data: (content as any)?.data ? toPlainObject(JSON.parse((content as any).data)) : null,
      cardMap: (content as any)?.cardMap ? toPlainObject(JSON.parse((content as any).cardMap)) : null,
      ...(mindMapData && { mindMapData })
    }

    result.push(fullCard)
  }

  return result
}
