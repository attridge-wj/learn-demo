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

export async function deleteTag(id: string) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
      if (!tag) throw new Error('标签不存在')

      // 检查是否有子标签
      const children = await tagRepo.find({
        where: { parentId: id, delFlag: 0 }
      })

      let deletedCount = 1 // 当前标签
      let childrenCount = children.length

      if (childrenCount > 0) {
        console.log(`删除标签 "${tag.name}"，发现 ${childrenCount} 个子标签，将一并删除`)
        
        // 使用工具类递归删除所有子标签（包括收藏数据）
        const deletedChildrenCount = await TagHierarchyUtil.deleteChildrenRecursively(id)
        deletedCount += deletedChildrenCount
        childrenCount = deletedChildrenCount

        console.log(`成功删除 ${deletedChildrenCount} 个子标签及其收藏数据`)
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
            source: 'delete-tag',
            id: id,
            spaceId: tag.spaceId,
            deletedCount: collects.length
          })
        }
      } catch (error) {
        console.warn('删除标签收藏记录失败:', error)
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

      return { 
        success: true, 
        message: `成功删除标签 "${tag.name}"${childrenCount > 0 ? ` 及其 ${childrenCount} 个子标签` : ''}`,
        deletedCount,
        childrenCount
      }
    })
  } catch (error) {
    console.error('删除标签失败:', error)
    throw error
  }
} 