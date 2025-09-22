import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import { TagHierarchyUtil } from '../util/tag-hierarchy.util'
import { CollectEntity } from '../../collect/entities/sys_collect.entity'
import { getMainWindow } from '../../../window-manage'

// 获取父级排序路径
async function getParentSortPath(tagRepo: any, parentId: string): Promise<string> {
  const parent = await tagRepo.findOne({
    where: { id: parentId, delFlag: 0 },
    select: ['sortOrder']
  })
  return parent?.sortOrder || ''
}

export async function batchDeleteTag(ids: string[]) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      
      const results = []
      let totalDeletedCount = 0
      
      for (const id of ids) {
        try {
          const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
          if (!tag) {
            results.push({
              id,
              success: false,
              message: '标签不存在'
            })
            continue
          }

          // 检查是否有子标签
          const children = await tagRepo.find({
            where: { parentId: id, delFlag: 0 }
          })

          let deletedCount = 1 // 当前标签
          let childrenCount = children.length

          if (childrenCount > 0) {
            // 递归删除所有子标签
            const deletedChildrenCount = await TagHierarchyUtil.deleteChildrenRecursively(id)
            deletedCount += deletedChildrenCount
            childrenCount = deletedChildrenCount
          }

          // 删除当前标签
          await tagRepo.update(id, { delFlag: 1 })

          // 删除标签对应的收藏数据
          try {
            const collectRepo = manager.getRepository(CollectEntity)
            const collects = await collectRepo.find({
              where: { 
                cardId: id, 
                cardType: 'tag',
                delFlag: 0 
              }
            })
            
            if (collects.length > 0) {
              await collectRepo.update(
                { cardId: id, cardType: 'tag', delFlag: 0 },
                { delFlag: 1, updateTime: new Date().toISOString() }
              )
              console.log(`删除了标签 "${tag.name}" 的 ${collects.length} 个收藏记录`)
              
              // 发送收藏列表刷新事件
              getMainWindow()?.webContents.send('collect:list:refresh', {
                source: 'batch-delete-tag',
                id: id,
                spaceId: tag.spaceId,
                deletedCount: collects.length
              })
            }
          } catch (error) {
            console.warn(`删除标签 "${tag.name}" 的收藏记录失败:`, error)
            // 不抛出错误，避免影响标签删除主流程
          }

          // 重新排序同级标签的 sortOrder
          try {
            const siblings = await tagRepo.find({
              where: { 
                parentId: tag.parentId, 
                delFlag: 0 
              },
              order: { sortOrder: 'ASC' }
            })
            
            // 重新分配 sortOrder
            for (let i = 0; i < siblings.length; i++) {
              const sibling = siblings[i]
              const parentSortPath = tag.parentId ? await getParentSortPath(tagRepo, tag.parentId) : ''
              const newSortOrder = parentSortPath ? `${parentSortPath}-${i}` : i.toString()
              
              if (sibling.sortOrder !== newSortOrder) {
                await tagRepo.update(sibling.id, { sortOrder: newSortOrder })
              }
            }
          } catch (error) {
            console.warn('重新排序同级标签失败:', error)
          }

          totalDeletedCount += deletedCount

          results.push({
            id,
            success: true,
            message: `成功删除标签 "${tag.name}"${childrenCount > 0 ? ` 及其 ${childrenCount} 个子标签` : ''}`,
            deletedCount,
            childrenCount
          })
        } catch (error) {
          results.push({
            id,
            success: false,
            message: error instanceof Error ? error.message : '删除失败'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return {
        success: true,
        data: {
          results,
          successCount,
          failCount,
          totalCount: ids.length,
          totalDeletedCount
        },
        message: `批量删除完成：成功 ${successCount} 个，失败 ${failCount} 个，共删除 ${totalDeletedCount} 个标签`
      }
    })
  } catch (error) {
    console.error('批量删除标签失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '批量删除标签失败'
    }
  }
}
