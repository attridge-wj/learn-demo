import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { CreateTagDto, UpdateTagDto, QueryTagDto, TagIdsDto } from './dto/index.dto'
import { createTag } from './service/tag-create.service'
import { getAllTags } from './service/tag-get-all.service'
import { getOneTag } from './service/tag-get-one.service'
import { updateTag } from './service/tag-update.service'
import { deleteTag } from './service/tag-delete.service'
import { getTagsByIds } from './service/tag-get-by-ids.service'
import { setTagTop } from './service/tag-set-top.service'
import { cancelTagTop } from './service/tag-cancel-top.service'
import { getTagTree, getTagSubTree, getTagPath } from './service/tag-get-tree.service'
import { batchCreateTag } from './service/tag-batch-create.service'
import { batchUpdateTag } from './service/tag-batch-update.service'
import { batchDeleteTag } from './service/tag-batch-delete.service'
import { updateTagSort, type TagSortUpdate } from './service/tag-update-sort.service'

export function setupTagIPC(): void {
  // 创建标签
  ipcMain.handle('tag:create', async (_event: IpcMainInvokeEvent, createTagDto: CreateTagDto, userId: number) => {
    console.log(createTagDto, 'createTagDto');
    return await createTag(createTagDto, userId)
  })

  // 查询标签列表
  ipcMain.handle('tag:getAll', async (_event: IpcMainInvokeEvent, query: QueryTagDto) => {
    console.log(query, 'query');
    return await getAllTags(query)
  })

  // 查询单个标签
  ipcMain.handle('tag:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    return await getOneTag(id)
  })

  // 更新标签
  ipcMain.handle('tag:update', async (_event: IpcMainInvokeEvent, id: string, updateTagDto: UpdateTagDto, userId: number) => {
    return await updateTag(id, updateTagDto, userId)
  })

  // 删除标签（软删除）
  ipcMain.handle('tag:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteTag(id)
  })

  // 通过ID数组查询标签列表
  ipcMain.handle('tag:getByIds', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    return await getTagsByIds(ids)
  })

  // 设置标签置顶
  ipcMain.handle('tag:setTop', async (_event: IpcMainInvokeEvent, id: string, userId: number) => {
    return await setTagTop(id, userId)
  })

  // 取消标签置顶
  ipcMain.handle('tag:cancelTop', async (_event: IpcMainInvokeEvent, id: string, userId: number) => {
    return await cancelTagTop(id, userId)
  })

  // 获取标签树结构
  ipcMain.handle('tag:getTree', async (_event: IpcMainInvokeEvent, query: QueryTagDto) => {
    return await getTagTree(query)
  })

  // 获取指定标签的子树
  ipcMain.handle('tag:getSubTree', async (_event: IpcMainInvokeEvent, parentId: string, query: QueryTagDto = {}) => {
    return await getTagSubTree(parentId, query)
  })

  // 获取标签路径（从根到指定标签的路径）
  ipcMain.handle('tag:getPath', async (_event: IpcMainInvokeEvent, tagId: string) => {
    return await getTagPath(tagId)
  })

  // 批量创建标签
  ipcMain.handle('tag:batchCreate', async (_event: IpcMainInvokeEvent, createTagDtos: CreateTagDto[], userId: number) => {
    console.log(createTagDtos, 'batchCreateTagDtos');
    return await batchCreateTag(createTagDtos, userId)
  })

  // 批量更新标签
  ipcMain.handle('tag:batchUpdate', async (_event: IpcMainInvokeEvent, updates: Array<{ id: string; updateData: UpdateTagDto }>, userId: number) => {
    return await batchUpdateTag(updates, userId)
  })

  // 批量删除标签
  ipcMain.handle('tag:batchDelete', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    return await batchDeleteTag(ids)
  })

  // 更新标签排序
  ipcMain.handle('tag:updateSort', async (_event: IpcMainInvokeEvent, updates: TagSortUpdate[]) => {
    return await updateTagSort(updates)
  })
}
