import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { WebBookmarkEntity } from './entities/sys_web_bookmark.entity'
import type { CreateWebBookmarkDto, UpdateWebBookmarkDto, QueryWebBookmarkDto } from './dto/index.dto'
import { getAllWebBookmarks } from './service/web-bookmark-get-all.service'
import { updateWebBookmark } from './service/web-bookmark-update.service'
import { deleteWebBookmark } from './service/web-bookmark-delete.service'
import { getWebBookmarkTree } from './service/web-bookmark-get-tree.service'

export function setupWebViewerIPC(): void {
  // 创建文件夹及书签（共用一个IPC，因为只是category取值不一样而已）
  ipcMain.handle('web-viewer:create', async (_event: IpcMainInvokeEvent, createDto: CreateWebBookmarkDto) => {
    try {
      console.log({...createDto});
      const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
      const bookmark = bookmarkRepo.create({
        ...createDto,
        delFlag: 0
      })
      const result = await bookmarkRepo.save(bookmark)
      return result
    } catch (error) {
      console.error('创建书签失败:', error)
      throw error
    }
  })

  // 查询书签列表
  ipcMain.handle('web-viewer:getAll', async (_event: IpcMainInvokeEvent, query: QueryWebBookmarkDto) => {
    return await getAllWebBookmarks(query)
  })

  // 查询单个书签
  ipcMain.handle('web-viewer:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
      const bookmark = await bookmarkRepo.findOne({ where: { id, delFlag: 0 } })
      if (!bookmark) throw new Error('书签不存在')
      return bookmark
    } catch (error) {
      console.error('查询书签失败:', error)
      throw error
    }
  })

  // 修改文件夹及书签（共用一个IPC）
  ipcMain.handle('web-viewer:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: UpdateWebBookmarkDto) => {
    return await updateWebBookmark(id, updateDto)
  })

  // 删除文件夹及书签（共用一个IPC，传入id即可）
  ipcMain.handle('web-viewer:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteWebBookmark(id)
  })

  // 获取树形列表的IPC接口，通过parentId进行父子数据的关联
  ipcMain.handle('web-viewer:getTree', async (_event: IpcMainInvokeEvent, spaceId: string) => {
    return await getWebBookmarkTree(spaceId)
  })
}
