import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { SysCardRichTextEntity } from '../entities/sys-card-rich-text.entity'
import { In } from 'typeorm'
import { toPlainObject } from '../index'

/**
 * 批量获取卡片信息
 * @param ids 卡片ID数组
 * @returns 卡片信息映射
 */
export async function batchGetCards(ids: string[]) {
  if (!ids || ids.length === 0) {
    return []
  }
  console.log('ids', ids);
  
  // 一次性查询所有基础卡片数据
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const cards = await repo.createQueryBuilder('card')
    .where('card.id IN (:...ids)', { ids })
    .andWhere('card.delFlag = :delFlag', { delFlag: 0 })
    .getMany()
  console.log('cards', cards);
  
  // 获取需要查询content的卡片ID，过滤掉无效值
  const cardList = cards.filter(card => card.cardType === 'card' || card.cardType === 'diary');
  const markList = cards.filter(card => card.cardType === 'mark');
  const contentCardIds = cardList
    .map(card => card.id)
    .filter(id => id && id.trim() !== '')

  const cardContentMap: { [key: string]: any } = {}
  if (contentCardIds.length > 0) {
    // 一次性查询所有content
    const contents = await AppDataSource.getRepository(SysCardRichTextEntity)
      .find({ where: { cardId: In(contentCardIds) } })

    // 将content数据关联到对应的card
    for (const card of cards) {
      if (card.cardType === 'card' || card.cardType === 'diary') {
        const content = contents.find(content => content.cardId === card.id)
        if (content) {
          cardContentMap[card.id] = {
            name: card.name,
            text: card.text,
            markText: card.markText,
            description: card.description ? JSON.parse(card.description) : '',
            extraData: card.extraData,
            content: content?.content ? toPlainObject(JSON.parse(content.content)) : null,
          }
        }
      }
    }
  }

  for (let i = 0; i < markList.length; i++) {
    const card = markList[i];
    cardContentMap[card.id] = {
      name: card.name,
      text: card.text,
      coverUrl: card.coverUrl,
      description: card.description ? JSON.parse(card.description) : '',
      extraData: card.extraData ? JSON.parse(card.extraData) : {},
      markText: card.markText,
    }
  }

  return cardContentMap;
} 