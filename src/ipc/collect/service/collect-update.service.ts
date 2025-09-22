import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import { SysCardBaseEntity } from '../../card/entities/sys-card-base.entity'
import { TagEntity } from '../../tag/entities/sys_tag.entity'
import { getMainWindow } from '../../../window-manage'
import type { UpdateCollectDto } from '../dto/index.dto'

export async function updateCollect(id: string, updateCollectDto: UpdateCollectDto, userId: number) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 检查收藏是否存在
    const collect = await collectRepo.findOne({ 
      where: { id, delFlag: 0 } 
    })
    
    if (!collect) {
      return {
        success: false,
        data: null,
        message: '收藏不存在'
      }
    }

    // 如果要更新父目录，验证父目录是否存在且在同一空间
    if (updateCollectDto.directoryId && updateCollectDto.directoryId !== collect.directoryId) {
      const parentCollect = await collectRepo.findOne({ 
        where: { 
          id: updateCollectDto.directoryId, 
          spaceId: updateCollectDto.spaceId || collect.spaceId,
          delFlag: 0 
        } 
      })
      
      if (!parentCollect) {
        return {
          success: false,
          data: null,
          message: '父目录不存在或不在同一空间'
        }
      }
    }

    // 更新收藏
    await collectRepo.update(id, {
      ...updateCollectDto,
      updateBy: userId,
      updateTime: new Date().toISOString()
    })

    // 同步更新相关表name属性（仅当更新了name且为卡片收藏时）
    try {
      if (updateCollectDto.name && collect.isFolder === 0 && collect.cardId) {
        // 如果是标签类型，同步更新标签表
        if (collect.cardType === 'tag') {
          const tagRepo = AppDataSource.getRepository(TagEntity)
          
          // 查找对应的标签
          const tag = await tagRepo.findOne({
            where: { 
              id: collect.cardId, 
              delFlag: 0 
            }
          })
          
          if (tag) {
            // 同步更新标签名称
            await tagRepo.update(collect.cardId, {
              name: updateCollectDto.name,
              updateTime: new Date().toISOString()
            })
          }
        } else {
          // 其他类型，同步更新卡片表
          const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)
          
          // 查找对应的卡片
          const card = await cardRepo.findOne({
            where: { 
              id: collect.cardId, 
              delFlag: 0 
            }
          })
          
          if (card) {
            // 同步更新卡片名称
            await cardRepo.update(collect.cardId, {
              name: updateCollectDto.name,
              updateTime: new Date().toISOString()
            })
          }
        }
      }
    } catch (error) {
      console.warn('同步更新相关表名称失败:', error)
      // 不抛出错误，避免影响收藏更新主流程
    }

    // 根据收藏类型发送对应的刷新事件（收藏列表刷新事件由标签和卡片更新时发送）
    if (collect.isFolder == 0 && collect.cardId) {
      console.log(collect.cardType, 'collect.cardType')
      if (collect.cardType === 'tag') {
        // 标签类型，发送标签列表刷新事件
        getMainWindow()?.webContents.send('tag:list:refresh', {
          source: 'update-collect',
          id: collect.cardId,
          spaceId: collect.spaceId,
        })
      } else if (collect.cardType === 'card') {
        // 卡片类型，发送卡片列表刷新事件
        getMainWindow()?.webContents.send('card:list:refresh', {
          source: 'update-collect',
          id: collect.cardId,
          spaceId: collect.spaceId,
        })
      } else {
        // 卡片集合类型，发送卡片集合列表刷新事件
        getMainWindow()?.webContents.send('cardGroup:list:refresh', {
          source: 'update-collect',
          id: collect.id,
          spaceId: collect.spaceId,
        })
      }
    }

    // 返回更新后的收藏
    const updatedCollect = await collectRepo.findOne({ 
      where: { id, delFlag: 0 } 
    })
    
    return {
      success: true,
      data: updatedCollect,
      message: '更新成功'
    }
  } catch (error) {
    console.error('更新收藏失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '更新失败'
    }
  }
} 