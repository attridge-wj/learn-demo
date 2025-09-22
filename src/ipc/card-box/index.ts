import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { CardBoxEntity } from './entities/sys_card_box.entity'
import type { CreateCardBoxDto, UpdateCardBoxDto, QueryCardBoxDto, CardBoxIdsDto } from './dto/index.dto'
import { getAllCardBoxes } from './service/card-box-get-all.service'
import { updateCardBox } from './service/card-box-update.service'
import { deleteCardBox } from './service/card-box-delete.service'
import { getCardBoxesByIds } from './service/card-box-get-by-ids.service'

export function setupCardBoxIPC(): void {
  // 创建卡片盒
  ipcMain.handle('card-box:create', async (_event: IpcMainInvokeEvent, createDto: CreateCardBoxDto) => {
    try {
      console.log({...createDto});
      const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
      const cardBox = cardBoxRepo.create({
        ...createDto,
        delFlag: 0
      })
      const result = await cardBoxRepo.save(cardBox)
      return cardBox
    } catch (error) {
      console.error('创建卡片盒失败:', error)
      throw error
    }
  })

  // 查询卡片盒列表
  ipcMain.handle('card-box:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardBoxDto) => {
    return await getAllCardBoxes(query)
  })

  // 查询单个卡片盒
  ipcMain.handle('card-box:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
      const cardBox = await cardBoxRepo.findOne({ where: { id, delFlag: 0 } })
      if (!cardBox) throw new Error('卡片盒不存在')
      return cardBox
    } catch (error) {
      console.error('查询卡片盒失败:', error)
      throw error
    }
  })

  // 更新卡片盒
  ipcMain.handle('card-box:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: UpdateCardBoxDto) => {
    return await updateCardBox(id, updateDto)
  })

  // 删除卡片盒（软删除）
  ipcMain.handle('card-box:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteCardBox(id)
  })

  // 批量获取卡片盒详情
  ipcMain.handle('card-box:getByIds', async (_event: IpcMainInvokeEvent, cardBoxIdsDto: CardBoxIdsDto) => {
    return await getCardBoxesByIds(cardBoxIdsDto)
  })
}
