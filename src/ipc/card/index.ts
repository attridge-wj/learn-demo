import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { SysCardBaseEntity } from './entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from './entities/sys-card-drawboard.entity'
import { SysCardMindMapEntity } from './entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from './entities/sys-card-multi-table.entity'
import { SysCardRichTextEntity } from './entities/sys-card-rich-text.entity'
import { SysCardRelationEntity } from './entities/sys-card-relation.entity'
import { SysRelateIdEntity } from './entities/sys-relate-id.entity'
import { SysCardFileEntity } from './entities/sys-card-file.entity'
import { CollectEntity } from '../collect/entities/sys_collect.entity'
import { CreateCardDto } from './dto/create-card.dto'
import { UpdateCardDto } from './dto/update-card.dto'
import { QueryCardDto, QueryCardPageDto, QueryCardByDateDto } from './dto/query-card.dto'
import { BatchCreateCardDto, BatchDeleteCardDto, BatchUpdateCardDto } from './dto/batch-card.dto'
import { StatisticsQueryDto } from './dto/statistics.dto'
import { In } from 'typeorm'
import { getCardSetTree, getCardSetTreeByBoxIds } from './service/card-tree.util'
import { getAllCards } from './service/card-get-all.service'
import { createCard } from './service/card-create.service'
import { updateCard } from './service/card-update.service'
import { batchGetCards } from './service/card-batch-get.service'
import { findCardPage } from './service/card-find-page.service'
import { getCardStatistics } from './service/card-statistics.service'
import { findRelateCards } from './service/card-find-relate-cards.service'
import { findRecyclePage } from './service/card-find-recycle-page.service'
import { getOneCard } from './service/card-get-one.service'
import { updateCardBoxId, getCardTreeInfo } from './service/card-update-boxid.service'
import { updateCardDateForDiary, removeCardDateIfNoDiary } from './service/card-date.service'
import { batchGetMindMapDetails } from './service/card-mind-map-batch-get.service'
import { getMainWindow } from '../../window-manage'
// 导入卡片关联关系相关服务
import { createCardRelation, batchCreateCardRelations } from './service/card-relation-create.service'
import { getSubIdsByParentId, getParentIdsBySubId } from './service/card-relation-query.service'
import { deleteCardRelation, batchDeleteCardRelations } from './service/card-relation-delete.service'

function toPlainObject(entity: any): any {
  if (Array.isArray(entity)) return entity.map(toPlainObject)
  if (entity && typeof entity === 'object') {
    const obj: any = {}
    for (const key in entity) {
      const value = entity[key]
      if (['extraData', 'content', 'attrList', 'viewList', 'markList', 'data', 'config', 'cardMap'].includes(key) && typeof value === 'string') {
        try {
          obj[key] = JSON.parse(value)
        } catch (e) {
          obj[key] = value
        }
      } else {
        obj[key] = toPlainObject(value)
      }
    }
    return obj
  }
  return entity
}

export { toPlainObject }

export function setupCardIPC(): void {
  // 查询卡片列表
  ipcMain.handle('card:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardDto) => {
    return await getAllCards(query)
  })


  // 查询单个卡片及子表内容
  ipcMain.handle('card:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    return await getOneCard(id)
  })

  // 创建卡片及子表
  ipcMain.handle('card:create', async (_event: IpcMainInvokeEvent, cardData: CreateCardDto) => {
    return await createCard(cardData)
  })

  // 更新卡片及子表
  ipcMain.handle('card:update', async (_event: IpcMainInvokeEvent, id: string, cardData: UpdateCardDto) => {
    return await updateCard(id, cardData)
  })
  // 删除卡片及子表
  ipcMain.handle('card:delete', async (_event: IpcMainInvokeEvent, id: string, isPd: boolean) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const card = await repo.findOne({ where: { id } })
    if (!card) return null
    // 如果卡片有sourceId，则需要更新sourceId的标注个数
    if (card.sourceId) {
      await repo.createQueryBuilder()
        .update(SysCardBaseEntity)
        .set({
          markNumber: () => 'CASE WHEN (COALESCE(mark_number, 0) - 1) < 0 THEN 0 ELSE (COALESCE(mark_number, 0) - 1) END',
          updateTime: new Date().toISOString()
        })
        .where('id = :id AND del_flag = 0', { id: card.sourceId })
        .execute()
    }

    // 如果isPd为true则直接硬删除,否则软删除
    if (isPd) {
      // 硬删除：先删除所有关联关系，再删除子表，最后删除主表
      
      // 1. 删除卡片关联关系
      await AppDataSource.getRepository(SysCardRelationEntity).delete({ parentId: id })
      await AppDataSource.getRepository(SysCardRelationEntity).delete({ subId: id })
      await AppDataSource.getRepository(SysRelateIdEntity).delete({ cardId: id })
      
      // 2. 删除卡片对应的收藏数据
      try {
        const collectRepo = AppDataSource.getRepository(CollectEntity)
        const collects = await collectRepo.find({
          where: { 
            cardId: id, 
            delFlag: 0 
          }
        })
        
        if (collects.length > 0) {
          await collectRepo.delete({ cardId: id })
          console.log(`硬删除了卡片 ${id} 的 ${collects.length} 个收藏记录`)
          
          // 发送收藏列表刷新事件
          getMainWindow()?.webContents.send('collect:list:refresh', {
            source: 'delete-card',
            id: id,
            spaceId: card.spaceId,
            deletedCount: collects.length
          })
        }
      } catch (error) {
        console.warn('删除卡片收藏记录失败:', error)
        // 不抛出错误，避免影响卡片删除主流程
      }
      
      // 3. 删除子表
      await AppDataSource.getRepository(SysCardRichTextEntity).delete({ cardId: id })
      await AppDataSource.getRepository(SysCardDrawboardEntity).delete({ cardId: id })
      await AppDataSource.getRepository(SysCardMindMapEntity).delete({ cardId: id })
      await AppDataSource.getRepository(SysCardMultiTableEntity).delete({ cardId: id })
      await AppDataSource.getRepository(SysCardFileEntity).delete({ cardId: id })
      
      // 4. 最后删除主表
      await repo.delete(id)
      
      // 5. 如果是日记，检查是否需要删除对应的card-date卡片
      if (card.cardType === 'diary') {
        const result = await removeCardDateIfNoDiary(card.date)
        if (!result.success) {
          console.warn('删除日期卡片失败:', result.message)
        }
      }
  
    } else {
      // 软删除主表
      await repo.update(id, { 
        delFlag: 1,
        updateTime: new Date().toISOString()
      })

      // 软删除卡片对应的收藏数据
      try {
        const collectRepo = AppDataSource.getRepository(CollectEntity)
        const collects = await collectRepo.find({
          where: { 
            cardId: id, 
            delFlag: 0 
          }
        })
        
        if (collects.length > 0) {
          await collectRepo.delete({ cardId: id })
          console.log(`硬删除了卡片 ${id} 的 ${collects.length} 个收藏记录`)
          
          // 发送收藏列表刷新事件
          getMainWindow()?.webContents.send('collect:list:refresh', {
            source: 'soft-delete-card',
            id: id,
            spaceId: card.spaceId,
            deletedCount: collects.length
          })
        }
      } catch (error) {
        console.warn('硬删除卡片收藏记录失败:', error)
        // 不抛出错误，避免影响卡片删除主流程
      }

      // 增加一步操作，如果是日记，则需要查看当前日期是否有card-date类型的数据，如果没有则创建，如果有则更新
      if (card.cardType === 'diary') {
        await updateCardDateForDiary(card.date, card.spaceId)
        const result = await removeCardDateIfNoDiary(card.date)
        if (!result.success) {
          console.warn('更新日期卡片失败:', result.message)
        }
      }
    }
    
    return true;
  })

  // 增加一个恢复卡片的方法，支持批量操作
  ipcMain.handle('card:restore', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    return await repo.update({id: In(ids)}, { 
      delFlag: 0,
      updateTime: new Date().toISOString()
    })
  })
  // 批量创建卡片
  ipcMain.handle('card:batchCreate', async (_event: IpcMainInvokeEvent, batch: BatchCreateCardDto) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const cards = repo.create(batch.cards)
    const saved = await repo.save(cards)
    return toPlainObject(saved)
  })

  // 增加清空回收站的方法
  ipcMain.handle('card:clearRecycle', async (_event: IpcMainInvokeEvent) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    
    // 先查询所有软删除的卡片ID
    const deletedCards = await repo.find({ 
      where: { delFlag: 1 },
      select: ['id']
    })
    const deletedCardIds = deletedCards.map(card => card.id)
    
    if (deletedCardIds.length === 0) {
      return true; // 没有需要清空的卡片
    }
    
    // 按照正确的顺序删除所有关联数据
    // 1. 删除卡片关联关系
    await AppDataSource.getRepository(SysCardRelationEntity).delete({ parentId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysCardRelationEntity).delete({ subId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysRelateIdEntity).delete({ cardId: In(deletedCardIds) })
    
    // 2. 删除卡片对应的收藏数据
    try {
      const collectRepo = AppDataSource.getRepository(CollectEntity)
      const collects = await collectRepo.find({
        where: { 
          cardId: In(deletedCardIds), 
          delFlag: 0 
        }
      })
      
      if (collects.length > 0) {
        await collectRepo.delete({ cardId: In(deletedCardIds) })
        console.log(`清空回收站时删除了 ${collects.length} 个收藏记录`)
      }
    } catch (error) {
      console.warn('清空回收站时删除卡片收藏记录失败:', error)
      // 不抛出错误，避免影响清空回收站主流程
    }
    
    // 3. 删除子表
    await AppDataSource.getRepository(SysCardRichTextEntity).delete({ cardId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysCardDrawboardEntity).delete({ cardId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysCardMindMapEntity).delete({ cardId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysCardMultiTableEntity).delete({ cardId: In(deletedCardIds) })
    await AppDataSource.getRepository(SysCardFileEntity).delete({ cardId: In(deletedCardIds) })
    
    // 4. 最后删除主表
    await repo.delete({ delFlag: 1 })
    
    return true;
  })

  // 批量删除卡片,如果isPd为true则直接硬删除,否则软删除
  ipcMain.handle('card:batchDelete', async (_event: IpcMainInvokeEvent, batch: BatchDeleteCardDto) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)

    // 一次性查询所有卡片，如果ids中存在sourceId，则需要更新sourceId的标注个数
    const cards = await repo.find({ 
      where: { id: In(batch.ids) },
      select: ['id', 'sourceId', 'cardType', 'date']
    })
    const sourceIds = cards.filter(card => card.sourceId).map(card => card.sourceId)

    if (sourceIds.length > 0) {
      await repo.createQueryBuilder()
        .update(SysCardBaseEntity)
        .set({
          markNumber: () => 'CASE WHEN (COALESCE(mark_number, 0) - 1) < 0 THEN 0 ELSE (COALESCE(mark_number, 0) - 1) END',
          updateTime: new Date().toISOString()
        })
        .where('id IN (:...ids)', { ids: sourceIds })
        .execute()
    }
    // 处理删除逻辑
    if (batch.isPd) {
      // 硬删除：先删除所有关联关系，再删除子表，最后删除主表
      
      // 1. 删除卡片关联关系
      await AppDataSource.getRepository(SysCardRelationEntity).delete({ parentId: In(batch.ids) })
      await AppDataSource.getRepository(SysCardRelationEntity).delete({ subId: In(batch.ids) })
      await AppDataSource.getRepository(SysRelateIdEntity).delete({ cardId: In(batch.ids) })
      
      // 2. 删除卡片对应的收藏数据
      try {
        const collectRepo = AppDataSource.getRepository(CollectEntity)
        const collects = await collectRepo.find({
          where: { 
            cardId: In(batch.ids), 
            delFlag: 0 
          }
        })
        
        if (collects.length > 0) {
          await collectRepo.delete({ cardId: In(batch.ids) })
          console.log(`批量硬删除时删除了 ${collects.length} 个收藏记录`)
        }
      } catch (error) {
        console.warn('批量硬删除时删除卡片收藏记录失败:', error)
        // 不抛出错误，避免影响批量删除主流程
      }
      
      // 3. 删除子表
      await AppDataSource.getRepository(SysCardRichTextEntity).delete({ cardId: In(batch.ids) })
      await AppDataSource.getRepository(SysCardDrawboardEntity).delete({ cardId: In(batch.ids) })
      await AppDataSource.getRepository(SysCardMindMapEntity).delete({ cardId: In(batch.ids) })
      await AppDataSource.getRepository(SysCardMultiTableEntity).delete({ cardId: In(batch.ids) })
      await AppDataSource.getRepository(SysCardFileEntity).delete({ cardId: In(batch.ids) })
      
      // 4. 最后删除主表
      await repo.delete({id: In(batch.ids)})
      
      // 5. 处理日记卡片的card-date删除逻辑
      const diaryCards = cards.filter(card => card.cardType === 'diary')
      for (const diaryCard of diaryCards) {
        if (diaryCard.date) {
          const result = await removeCardDateIfNoDiary(diaryCard.date)
          if (!result.success) {
            console.warn(`删除日期卡片失败 (${diaryCard.date}):`, result.message)
          }
        }
      }
      
      return true;
    } else {
      const result = await Promise.all(batch.ids.map(id => repo.update(
        { id },
        {
          delFlag: 1,
          updateTime: new Date().toISOString()
        }
      )))

      // 批量软删除卡片对应的收藏数据
      try {
        const collectRepo = AppDataSource.getRepository(CollectEntity)
        const collects = await collectRepo.find({
          where: { 
            cardId: In(batch.ids), 
            delFlag: 0 
          }
        })
        
        if (collects.length > 0) {
          await collectRepo.delete({ cardId: In(batch.ids) })
          console.log(`批量硬删除时删除了 ${collects.length} 个收藏记录`)
        }
      } catch (error) {
        console.warn('批量硬删除时删除卡片收藏记录失败:', error)
        // 不抛出错误，避免影响批量删除主流程
      }

      // 处理日记卡片的card-date删除逻辑
      const diaryCards = cards.filter(card => card.cardType === 'diary')
      for (const diaryCard of diaryCards) {
        if (diaryCard.date) {
          const result = await removeCardDateIfNoDiary(diaryCard.date)
          if (!result.success) {
            console.warn(`删除日期卡片失败 (${diaryCard.date}):`, result.message)
          }
        }
      }

      return toPlainObject(result)
    }
  })

  // 通过ID数组查询卡片列表
  ipcMain.handle('card:findByIds', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    if (!ids || ids.length === 0) {
      return []
    }

    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const cards = await repo.createQueryBuilder('card')
      .where('card.id IN (:...ids)', { ids })
      .andWhere('card.delFlag = :delFlag', { delFlag: 0 })
      .getMany()

    return toPlainObject(cards)
  })

  // 批量获取卡片信息
  ipcMain.handle('card:batchGet', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    return await batchGetCards(ids)
  })

  // 批量更新卡片
  ipcMain.handle('card:batchUpdate', async (_event: IpcMainInvokeEvent, batch: BatchUpdateCardDto) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const result = await Promise.all(batch.cards.filter(card => card.id).map(card => repo.update(card.id!, { ...card, updateTime: new Date().toISOString()})))
    return toPlainObject(result)
  })
  // 分页查询卡片
  ipcMain.handle('card:findPage', async (_event: IpcMainInvokeEvent, query: QueryCardPageDto & { page: number, pageSize: number }) => {
    return await findCardPage(query)
  })

  // 统计
  ipcMain.handle('card:statistics', async (_event: IpcMainInvokeEvent, query: StatisticsQueryDto) => {
    return await getCardStatistics(query)
  })

  // 获取附件数量统计
  ipcMain.handle('card:getAttachmentCount', async (_event: IpcMainInvokeEvent, { spaceId, userId }: { spaceId?: string, userId?: number }) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const queryBuilder = repo.createQueryBuilder('card')
      .where('card.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('card.cardType = :cardType', { cardType: 'attachment' })

    if (spaceId) {
      queryBuilder.andWhere('card.createBy = :userId', { userId })
    }

    const count = await queryBuilder.getCount()
    return { count }
  })

  // 查询引用了指定卡片的列表
  ipcMain.handle('card:findRelateCards', async (_event: IpcMainInvokeEvent, id: string) => {
    return await findRelateCards(id)
  })

  
  // 根据日期查询卡片
  ipcMain.handle('card:findByDate', async (_event: IpcMainInvokeEvent, query: { date: string, spaceId?: string, cardType?: string }) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const queryBuilder = repo.createQueryBuilder('card')
      .where('card.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('DATE(card.date) = DATE(:date)', { date: query.date })

    if (query.spaceId) {
      queryBuilder.andWhere('card.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.cardType) {
      queryBuilder.andWhere('card.cardType = :cardType', { cardType: query.cardType })
    }

    const card = await queryBuilder.getOne()
    return card ? toPlainObject(card) : null
  })

  // 查询所有日期卡片
  ipcMain.handle('card:findAllDate', async (_event: IpcMainInvokeEvent, query: { spaceId?: string }) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const queryBuilder = repo.createQueryBuilder('card')
      .select(['card.id', 'card.date'])
      .where('card.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('card.date IS NOT NULL')
      .andWhere('card.cardType = :cardType', { cardType: 'card-date' })

    if (query?.spaceId) {
      queryBuilder.andWhere('card.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    queryBuilder.orderBy('card.updateTime', 'DESC')

    const cards = await queryBuilder.getMany()
    return toPlainObject(cards)
  })

  // 根据年月查询卡片数据
  ipcMain.handle('card:findByYearMonth', async (_event: IpcMainInvokeEvent, query: { yearMonth: string, spaceId?: string, cardType?: string }) => {
    const repo = AppDataSource.getRepository(SysCardBaseEntity)
    const queryBuilder = repo.createQueryBuilder('card')
      .where('card.delFlag = :delFlag', { delFlag: 0 })
      .andWhere('card.date IS NOT NULL')
      .andWhere("strftime('%Y-%m', card.date) = :yearMonth", { yearMonth: query.yearMonth })

    if (query?.spaceId) {
      queryBuilder.andWhere('card.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query?.cardType) {
      queryBuilder.andWhere('card.cardType = :cardType', { cardType: query.cardType })
    }

    queryBuilder.orderBy('card.date', 'ASC')
    queryBuilder.addOrderBy('card.createTime', 'ASC')

    const cards = await queryBuilder.getMany()
    return toPlainObject(cards)
  })

  // 回收站分页查询
  ipcMain.handle('card:findRecyclePage', async (_event: IpcMainInvokeEvent, query: { page: number, spaceId: string, pageSize: number, name?: string, cardType?: string, subType?: string, sortType?: string }) => {
    return await findRecyclePage(query)
  })

  // 通过boxId获取卡片集树形结构
  ipcMain.handle('card:getCardSetTree', async (_event: IpcMainInvokeEvent, boxId: string) => {
    return await getCardSetTree(boxId)
  })

  // 传入boxIds，获取卡片集树形结构
  ipcMain.handle('card:getCardSetTreeByBoxIds', async (_event: IpcMainInvokeEvent, boxIds: string[]) => {
    return await getCardSetTreeByBoxIds(boxIds)
  })

  // 修改卡片所属boxId，包括递归修改所有子卡片
  ipcMain.handle('card:updateBoxId', async (_event: IpcMainInvokeEvent, cardId: string, newBoxId: string, maxDepth?: number) => {
    return await updateCardBoxId(cardId, newBoxId, maxDepth)
  })

  // 获取卡片及其子卡片信息（用于验证）
  ipcMain.handle('card:getCardTreeInfo', async (_event: IpcMainInvokeEvent, cardId: string, maxDepth?: number) => {
    const result = await getCardTreeInfo(cardId, maxDepth)
    return toPlainObject(result)
  })

  // 检测卡片树中的循环引用
  ipcMain.handle('card:detectCircularReference', async (_event: IpcMainInvokeEvent, cardId: string) => {
    const { detectCircularReference } = await import('./service/card-update-boxid.service')
    return await detectCircularReference(cardId)
  })

  // 批量获取思维导图详情
  ipcMain.handle('card:batchGetMindMapDetails', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    return await batchGetMindMapDetails(ids)
  })

  // ==================== 卡片关联关系相关IPC ====================
  
  // 创建卡片关联关系
  ipcMain.handle('card:createRelation', async (_event: IpcMainInvokeEvent, relationData: any) => {
    return await createCardRelation(relationData)
  })

  // 批量创建卡片关联关系
  ipcMain.handle('card:batchCreateRelations', async (_event: IpcMainInvokeEvent, batchData: any) => {
    return await batchCreateCardRelations(batchData)
  })

  // 根据父卡片ID查询所有子卡片ID
  ipcMain.handle('card:getSubIdsByParentId', async (_event: IpcMainInvokeEvent, parentId: string, spaceId?: string) => {
    return await getSubIdsByParentId(parentId, spaceId)
  })

  // 根据子卡片ID查询所有父卡片ID
  ipcMain.handle('card:getParentIdsBySubId', async (_event: IpcMainInvokeEvent, subId: string, spaceId?: string) => {
    return await getParentIdsBySubId(subId, spaceId)
  })

  // 删除卡片关联关系
  ipcMain.handle('card:deleteRelation', async (_event: IpcMainInvokeEvent, parentId: string, subId: string) => {
    return await deleteCardRelation(parentId, subId)
  })

  // 批量删除卡片关联关系
  ipcMain.handle('card:batchDeleteRelations', async (_event: IpcMainInvokeEvent, batchData: any) => {
    return await batchDeleteCardRelations(batchData)
  })
}

