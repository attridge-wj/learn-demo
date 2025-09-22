import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import { CollectEntity } from '../../collect/entities/sys_collect.entity'
import { getMainWindow } from '../../../window-manage'
import { TagHierarchySortUtil } from '../util/tag-hierarchy-sort.util'
import { TagHierarchyUtil } from '../util/tag-hierarchy.util'

export interface TagSortUpdate {
  id: string
  sortOrder: string
  parentId?: string
}

export async function updateTagSort(updates: TagSortUpdate[]) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      
      const results = []
      
      for (const update of updates) {
        try {
          // 检查标签是否存在
          const tag = await tagRepo.findOne({ where: { id: update.id, delFlag: 0 } })
          if (!tag) {
            results.push({
              id: update.id,
              success: false,
              message: '标签不存在'
            })
            continue
          }
          console.log('update', update)
          
          // 检查是否需要更新层级信息
          const newParentId = update.parentId !== undefined ? update.parentId : tag.parentId
          const parentIdChanged = newParentId !== tag.parentId
          
          let updateData: any = {
            sortOrder: update.sortOrder,
            parentId: newParentId,
            updateTime: new Date().toISOString()
          }

          // 如果父标签发生变化，需要更新层级和名称信息
          if (parentIdChanged) {
            console.log('parentIdChanged', parentIdChanged)
            let level = 0
            let parentName: string | undefined = undefined
            let fullName = tag.name

            // 获取新的父标签信息
            if (newParentId) {
              const parentInfo = await TagHierarchyUtil.getParentTagInfo(newParentId)
              if (parentInfo) {
                level = parentInfo.level + 1
                parentName = parentInfo.name
                // 提取标签的原始名称（去掉父标签前缀）
                const nameParts = tag.name.split('_')
                const originalName = nameParts[nameParts.length - 1]
                fullName = TagHierarchyUtil.generateFullTagName(originalName, parentName)
              }
            } else {
              // 如果没有父标签，提取原始名称
              const nameParts = tag.name.split('_')
              fullName = nameParts[nameParts.length - 1]
            }

            updateData = {
              ...updateData,
              level,
              parentName,
              name: fullName
            }
          }

          // 更新标签
          await tagRepo.update(update.id, updateData)

          // 如果父标签发生变化，需要同步更新子标签
          if (parentIdChanged) {
            // 提取标签的原始名称（去掉所有父标签前缀）
            const nameParts = tag.name.split('_')
            const originalName = nameParts[nameParts.length - 1]
            await TagHierarchySortUtil.updateChildrenTags(
              update.id, 
              originalName, 
              updateData.level,
              tag.name,  // 传递原始父标签名称
              tag.level,  // 传递原始父标签层级
              updateData.name  // 传递新的父标签完整名称
            )

            // 同步更新收藏表中cardType为tag的记录
            try {
              const collectRepo = manager.getRepository(CollectEntity)
              const collect = await collectRepo.findOne({
                where: { 
                  cardId: update.id, 
                  cardType: 'tag',
                  delFlag: 0,
                  isFolder: 0
                }
              })
              
              if (collect) {
                await collectRepo.update(collect.id, {
                  name: updateData.name,
                  updateTime: new Date().toISOString()
                })
                console.log('同步更新了标签收藏记录')

                // 发送收藏列表刷新事件
                getMainWindow()?.webContents.send('collect:list:refresh', {
                  source: 'update-tag-sort',
                  id: collect.id,
                  spaceId: collect.spaceId,
                })
              }
            } catch (error) {
              console.warn('同步更新标签收藏记录失败:', error)
              // 不抛出错误，避免影响标签更新主流程
            }
          }

          results.push({
            id: update.id,
            success: true,
            message: '排序更新成功'
          })
        } catch (error) {
          results.push({
            id: update.id,
            success: false,
            message: error instanceof Error ? error.message : '排序更新失败'
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
          totalCount: updates.length
        },
        message: `排序更新完成：成功 ${successCount} 个，失败 ${failCount} 个`
      }
    })
  } catch (error) {
    console.error('更新标签排序失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '更新标签排序失败'
    }
  }
}
