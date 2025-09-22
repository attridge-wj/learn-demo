import { AppDataSource } from '../../../database/connection'
import { SysCardMindMapEntity } from '../entities/sys-card-mind-map.entity'
import { In } from 'typeorm'
import { toPlainObject } from '../index'

// 定义思维导图节点的类型
interface MindNode {
  id: string
  [key: string]: any
}

// 定义思维导图详情的数据结构
interface MindMapDetail {
  isCreate: boolean
  id: string
  elements: MindNode[]
  lines: any[]
  layout: string
  theme: string
  rainBowLines: string
  width: number
  height: number
  lineType: string
  x: number
  y: number
}

/**
 * 批量获取思维导图详情
 * @param ids 思维导图卡片ID数组
 * @returns 思维导图详情映射 { id: MindMapDetail }
 */
export async function batchGetMindMapDetails(ids: string[]) {
  if (!ids || ids.length === 0) {
    return {}
  }

  // 查询所有思维导图数据
  const repo = AppDataSource.getRepository(SysCardMindMapEntity)
  const mindMaps = await repo.createQueryBuilder('mindMap')
    .where('mindMap.cardId IN (:...ids)', { ids })
    .getMany()

  const result: { [key: string]: MindMapDetail } = {}

  for (const mindMap of mindMaps) {
    try {
      // 解析content字段
      const content = mindMap.content ? JSON.parse(mindMap.content) : {}
      
      // 构建返回的数据结构
      const detail: MindMapDetail = {
        id: mindMap.cardId,
        elements: content.elements || [],
        lines: content.lines || [],
        layout: content.layout || 'leftAndRight',
        theme: content.theme || 'vitalityOrange',
        rainBowLines: content.rainBowLines || 'rose',
        width: content.width || 200,
        height: content.height || 200,
        lineType: content.lineType || 'POLYLINE',
        isCreate: true,
        x: content.x || 0,
        y: content.y || 0
      }

      result[mindMap.cardId] = detail
    } catch (error) {
      console.error(`解析思维导图数据失败，cardId: ${mindMap.cardId}`, error)
      // 如果解析失败，返回默认结构
      result[mindMap.cardId] = {
        id: mindMap.cardId,
        isCreate: true,
        elements: [],
        lines: [],
        layout: 'leftAndRight',
        theme: 'vitalityOrange',
        rainBowLines: 'rose',
        width: 200,
        height: 200,
        lineType: 'POLYLINE',
        x: 0,
        y: 0
      }
    }
  }

  return result
} 