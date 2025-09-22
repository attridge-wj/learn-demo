import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import { CollectEntity } from '../../collect/entities/sys_collect.entity'
import { getMainWindow } from '../../../window-manage'
import type { UpdateTagDto } from '../dto/index.dto'
import { TagHierarchyUpdateUtil } from '../util/tag-hierarchy-update.util'

export async function updateTag(id: string, updateTagDto: UpdateTagDto, userId: number) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
      if (!tag) throw new Error('标签不存在')

      // 如果更新了名称，需要同步更新子标签
      if (updateTagDto.name && updateTagDto.name !== tag.name) {
        // 更新当前标签
        await tagRepo.update(id, {
          ...updateTagDto,
          parentName: tag.parentName,
          name: tag.parentName ? tag.parentName + '_' + updateTagDto.name : updateTagDto.name
        })

        // 同步更新所有子标签的名称
        const newTagName = tag.parentName ? tag.parentName + '_' + updateTagDto.name : updateTagDto.name
        await TagHierarchyUpdateUtil.updateChildrenTags(id, updateTagDto.name, tag.level, tag.name, newTagName)

        // 同步更新收藏表中cardType为tag的记录
        try {
          const collectRepo = manager.getRepository(CollectEntity)
          const collect = await collectRepo.findOne({
            where: { 
              cardId: id, 
              cardType: 'tag',
              delFlag: 0,
              isFolder: 0
            }
          })
          
          if (collect) {
            await collectRepo.update(collect.id, {
              name: newTagName,
              updateTime: new Date().toISOString()
            })
            // 发送收藏列表刷新事件
            getMainWindow()?.webContents.send('collect:list:refresh', {
              source: 'update-tag',
              id: collect.id,
              spaceId: collect.spaceId,
            })
          }
        } catch (error) {
          console.warn('同步更新标签收藏记录失败:', error)
          // 不抛出错误，避免影响标签更新主流程
        }
      } else {
        // 普通更新
        await tagRepo.update(id, {
          ...updateTagDto,
        })
      }

      return { success: true }
    })
  } catch (error) {
    console.error('更新标签失败:', error)
    throw error
  }
} 