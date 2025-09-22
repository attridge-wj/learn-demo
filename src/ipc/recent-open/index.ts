import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { RecentlyOpenEntity } from './entities/sys_recently_open.entity'
import { v4 as uuidv4 } from 'uuid'
import type { CreateRecentlyOpenDto, QueryRecentlyOpenDto } from './dto/index.dto'
import { SysCardBaseEntity } from '../card/entities/sys-card-base.entity'
import { toPlainObject } from '../card'

export function setupRecentlyOpenIPC(): void {
  // 创建最近打开记录
  ipcMain.handle('recently-open:create', async (_event: IpcMainInvokeEvent, createDto: CreateRecentlyOpenDto, userId: number) => {
    try {
      const recentlyOpenRepo = AppDataSource.getRepository(RecentlyOpenEntity)
      
      // 查找是否存在相同记录
      const existingRecord = await recentlyOpenRepo.findOne({
        where: {
          spaceId: createDto.spaceId,
          cardId: createDto.cardId,
          delFlag: 0
        }
      })

      if (existingRecord) {
        // 如果存在，更新记录
        await recentlyOpenRepo.update(existingRecord.id, {
          updateTime: new Date().toISOString()
        })
        return existingRecord.id
      }

      // 如果不存在，创建新记录
      const newRecord = recentlyOpenRepo.create({
        id: uuidv4(),
        ...createDto,
        delFlag: 0
      })

      const result = await recentlyOpenRepo.save(newRecord)
      return result.id
    } catch (error) {
      console.error('创建最近打开记录失败:', error)
      throw error
    }
  })

  // 查询最近打开记录列表
  ipcMain.handle('recently-open:getAll', async (_event: IpcMainInvokeEvent, query: QueryRecentlyOpenDto) => {
    try {
      const recentlyOpenRepo = AppDataSource.getRepository(RecentlyOpenEntity)
      const qb = recentlyOpenRepo.createQueryBuilder('record')
        .where('record.delFlag = :delFlag', { delFlag: 0 })

      if (query.spaceId) {
        qb.andWhere('record.spaceId = :spaceId', { spaceId: query.spaceId })
      }

      qb.orderBy('record.updateTime', 'DESC')
        .take(10)

      const records = await qb.getMany()

      // 获取所有卡片ID
      const cardIds = records.map(record => record.cardId).filter(id => id)

      if (cardIds.length === 0) {
        return []
      }

      // 查询卡片详情
      const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)
      const cards = await cardRepo.createQueryBuilder('card')
        .where('card.id IN (:...ids)', { ids: cardIds })
        .andWhere('card.delFlag = :delFlag', { delFlag: 0 })
        .getMany()

      // 将卡片详情合并到记录中
      const enrichedRecords = records.map(record => {
        const cardDetail = cards.find(card => card.id === record.cardId)
        return {
          ...toPlainObject(cardDetail)
        }
      })

      return enrichedRecords
    } catch (error) {
      console.error('查询最近打开记录列表失败:', error)
      throw error
    }
  })

  // 查询单个最近打开记录
  ipcMain.handle('recently-open:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const recentlyOpenRepo = AppDataSource.getRepository(RecentlyOpenEntity)
      const record = await recentlyOpenRepo.findOne({ where: { id, delFlag: 0 } })
      if (!record) throw new Error('记录不存在')
      return record
    } catch (error) {
      console.error('查询最近打开记录失败:', error)
      throw error
    }
  })

  // 更新最近打开记录
  ipcMain.handle('recently-open:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: CreateRecentlyOpenDto) => {
    try {
      const recentlyOpenRepo = AppDataSource.getRepository(RecentlyOpenEntity)
      const record = await recentlyOpenRepo.findOne({ where: { id, delFlag: 0 } })
      if (!record) throw new Error('记录不存在')

      await recentlyOpenRepo.update(id, {
        ...updateDto,
        updateTime: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      console.error('更新最近打开记录失败:', error)
      throw error
    }
  })

  // 删除最近打开记录（软删除）
  ipcMain.handle('recently-open:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const recentlyOpenRepo = AppDataSource.getRepository(RecentlyOpenEntity)
      const record = await recentlyOpenRepo.findOne({ where: { id, delFlag: 0 } })
      if (!record) throw new Error('记录不存在')
      await recentlyOpenRepo.update(id, { delFlag: 1 })
      return { success: true }
    } catch (error) {
      console.error('删除最近打开记录失败:', error)
      throw error
    }
  })
}