import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { CreateCollectDto, UpdateCollectDto, QueryCollectDto, GetCardIdsByTypeDto } from './dto/index.dto'
import { createCollect } from './service/collect-create.service'
import { createCollectFolder } from './service/collect-folder-create.service'
import { batchCreateCollect } from './service/collect-batch-create.service'
import { updateCollect } from './service/collect-update.service'
import { deleteCollect } from './service/collect-delete.service'
import { deleteCollectByCardId } from './service/collect-delete-by-cardid.service'
import { checkCollectByCardId } from './service/collect-check-by-cardid.service'
import { getAllCollects } from './service/collect-get-all.service'
import { getCollectTree } from './service/collect-get-tree.service'
import { getCardIdsByType } from './service/collect-get-card-ids-by-type.service'

export function setupCollectIPC(): void {
  // 创建收藏
  ipcMain.handle('collect:create', async (_event: IpcMainInvokeEvent, createCollectDto: CreateCollectDto, userId: number) => {
    console.log(createCollectDto, 'createCollectDto');
    return await createCollect(createCollectDto, userId)
  })

  // 创建收藏文件夹
  ipcMain.handle('collect:createFolder', async (_event: IpcMainInvokeEvent, createCollectDto: CreateCollectDto, userId: number) => {
    console.log(createCollectDto, 'createCollectFolderDto');
    return await createCollectFolder(createCollectDto, userId)
  })

  // 批量创建收藏
  ipcMain.handle('collect:batchCreate', async (_event: IpcMainInvokeEvent, createCollectDtos: CreateCollectDto[], userId: number) => {
    console.log(createCollectDtos, 'batchCreateCollectDtos');
    return await batchCreateCollect(createCollectDtos, userId)
  })

  // 更新收藏
  ipcMain.handle('collect:update', async (_event: IpcMainInvokeEvent, id: string, updateCollectDto: UpdateCollectDto, userId: number) => {
    return await updateCollect(id, updateCollectDto, userId)
  })

  // 删除收藏
  ipcMain.handle('collect:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteCollect(id)
  })

  // 查询收藏列表
  ipcMain.handle('collect:getAll', async (_event: IpcMainInvokeEvent, query: QueryCollectDto) => {
    console.log(query, 'query');
    return await getAllCollects(query)
  })

  // 获取收藏树结构
  ipcMain.handle('collect:getTree', async (_event: IpcMainInvokeEvent, query: QueryCollectDto) => {
    return await getCollectTree(query)
  })

  // 通过cardId删除收藏
  ipcMain.handle('collect:deleteByCardId', async (_event: IpcMainInvokeEvent, cardId: string, spaceId?: string) => {
    return await deleteCollectByCardId(cardId, spaceId)
  })

  // 通过cardId查询是否被收藏
  ipcMain.handle('collect:checkByCardId', async (_event: IpcMainInvokeEvent, cardId: string, spaceId?: string) => {
    return await checkCollectByCardId(cardId, spaceId)
  })

  // 通过卡片类型获取被收藏的卡片ID列表
  ipcMain.handle('collect:getCardIdsByType', async (_event: IpcMainInvokeEvent, query: GetCardIdsByTypeDto) => {
    return await getCardIdsByType(query)
  })
}
