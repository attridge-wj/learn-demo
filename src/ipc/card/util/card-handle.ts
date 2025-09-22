import { AppDataSource } from '../../../database/connection'
import { SysRelateIdEntity } from '../entities/sys-relate-id.entity'
import { v4 as uuidv4 } from 'uuid'

export class CardHandleUtil {
  /**
   * 删除卡片的所有关联关系
   * @param cardId 卡片ID
   */
  static async deleteCardRelations(cardId: string): Promise<void> {
    const relateRepo = AppDataSource.getRepository(SysRelateIdEntity)
    await relateRepo.delete({ cardId })
  }

  /**
   * 批量插入关联关系
   * @param cardId 卡片ID
   * @param relateIds 关联的卡片ID数组
   */
  static async insertCardRelations(cardId: string, relateIds: string[]): Promise<void> {
    if (relateIds.length === 0) return

    const relateRepo = AppDataSource.getRepository(SysRelateIdEntity)
    
    // 使用批量插入，提高效率
    const insertData = relateIds.map(relateId => ({
      id: uuidv4(),
      cardId,
      relateId
    }))
    
    // 使用insert方法进行批量插入，比save更高效
    await relateRepo.insert(insertData)
  }

  /**
   * 处理画板类型的关联关系
   * @param content 画板内容
   * @returns 关联的卡片ID数组
   */
  static extractDrawBoardRelations(content: any): string[] {
    const relateIds: string[] = []
    
    // 处理字符串格式的content
    let parsedContent = content
    if (typeof content === 'string' && content.trim()) {
      try {
        parsedContent = JSON.parse(content)
      } catch (error) {
        console.warn('解析画板content失败:', error)
        return relateIds
      }
    }
    
    if (!parsedContent || !parsedContent.elements || !Array.isArray(parsedContent.elements)) {
      return relateIds
    }

    // 遍历elements，提取类型为card、diary、mark、attachment的元素id
    parsedContent.elements.forEach((element: any) => {
      if (element && element.cardType && ['card', 'diary', 'mark', 'attachment', 'mind-map', 'draw-board', 'multi-table'].includes(element.cardType) && element.id) {
        relateIds.push(element.id)
      }
    })

    return relateIds
  }

  /**
   * 处理思维导图类型的关联关系
   * @param content 思维导图内容
   * @returns 关联的卡片ID数组
   */
  static extractMindMapRelations(content: any): string[] {
    const relateIds: string[] = []
    
    // 处理字符串格式的content
    let parsedContent = content
    if (typeof content === 'string' && content.trim()) {
      try {
        parsedContent = JSON.parse(content)
      } catch (error) {
        console.warn('解析思维导图content失败:', error)
        return relateIds
      }
    }
    
    if (!parsedContent || !parsedContent.elements || !Array.isArray(parsedContent.elements)) {
      return relateIds
    }

    // 遍历elements，提取包含associateId的元素
    const extractAssociateIds = (elements: any[]) => {
      elements.forEach((element: any) => {
        if (element && element.associateId) {
          relateIds.push(element.associateId)
        }
        // 递归处理子元素
        if (element && element.children && Array.isArray(element.children)) {
          extractAssociateIds(element.children)
        }
      })
    }

    extractAssociateIds(parsedContent.elements)
    return relateIds
  }

  /**
   * 处理多维表类型的关联关系
   * @param data 多维表数据
   * @returns 关联的卡片ID数组
   */
  static extractMultiTableRelations(data: any): string[] {
    const relateIds: string[] = []
    
    // 处理字符串格式的data
    let parsedData = data
    if (typeof data === 'string' && data.trim()) {
      try {
        parsedData = JSON.parse(data)
      } catch (error) {
        console.warn('解析多维表data失败:', error)
        return relateIds
      }
    }
    
    if (!parsedData || !Array.isArray(parsedData)) {
      return relateIds
    }

    // 遍历data下的数据，提取包含relateId的数据
    const extractRelateIds = (items: any[]) => {
      items.forEach((item: any) => {
        if (item && item.relateCardId) {
          relateIds.push(item.relateCardId)
        }
      })
    }

    extractRelateIds(parsedData)
    return relateIds
  }

  /**
   * 处理卡片关联关系的完整流程
   * @param cardId 卡片ID
   * @param cardType 卡片类型
   * @param content 卡片内容
   * @param data 多维表数据
   */
  static async handleCardRelations(cardId: string, cardType: string, content?: any, data?: any): Promise<void> {
    try {
      // 先删除当前卡片的所有关联关系
      await this.deleteCardRelations(cardId)

      let relateIds: string[] = []

      // 根据卡片类型提取关联关系
      switch (cardType) {
        case 'draw-board':
          relateIds = this.extractDrawBoardRelations(content)
          break
        case 'mind-map':
          relateIds = this.extractMindMapRelations(content)
          break
        case 'multi-table':
          relateIds = this.extractMultiTableRelations(data)
          break
        default:
          return // 其他类型不需要处理关联关系
      }

      // 去重并过滤空值
      const uniqueRelateIds = [...new Set(relateIds.filter(id => id && id.trim()))]

      // 插入新的关联关系
      if (uniqueRelateIds.length > 0) {
        console.log(cardId, uniqueRelateIds, 'uniqueRelateIds')
        await this.insertCardRelations(cardId, uniqueRelateIds)
        console.log(`卡片 ${cardId} 更新了 ${uniqueRelateIds.length} 条关联关系`)
      }
    } catch (error) {
      console.error('处理卡片关联关系失败:', error)
      // 不抛出错误，避免影响卡片更新主流程
    }
  }
}
