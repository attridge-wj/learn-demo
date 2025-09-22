import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import { v4 as uuidv4 } from 'uuid'
import { In } from 'typeorm'
import { getMainWindow } from '../../../window-manage'
import type { CreateCollectDto } from '../dto/index.dto'

// 获取父级排序路径
async function getParentSortPath(collectRepo: any, parentId: string): Promise<string> {
  const parent = await collectRepo.findOne({
    where: { id: parentId, delFlag: 0 },
    select: ['sortOrder']
  })
  return parent?.sortOrder || ''
}

export async function batchCreateCollect(createCollectDtos: CreateCollectDto[], userId: number) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 验证所有父目录是否存在且在同一空间
    const directoryIds = createCollectDtos
      .map(dto => dto.directoryId)
      .filter((id): id is string => Boolean(id)) // 过滤掉 undefined 并类型断言
      .filter((id, index, arr) => arr.indexOf(id) === index) // 去重
    
    if (directoryIds.length > 0) {
      const existingDirectories = await collectRepo.find({
        where: { id: In(directoryIds), delFlag: 0 }
      })
      
      const existingIds = existingDirectories.map(dir => dir.id)
      const missingIds = directoryIds.filter(id => !existingIds.includes(id))
      
      if (missingIds.length > 0) {
        return {
          success: false,
          data: null,
          message: `父目录不存在: ${missingIds.join(', ')}`
        }
      }
    }

    // 验证所有收藏是否在同一空间
    const spaceIds = createCollectDtos
      .map(dto => dto.spaceId)
      .filter((id, index, arr) => id && arr.indexOf(id) === index) // 去重
    
    if (spaceIds.length > 1) {
      return {
        success: false,
        data: null,
        message: '批量创建时所有收藏必须在同一空间'
      }
    }

    // 批量创建收藏
    const collects = await Promise.all(createCollectDtos.map(async (dto, index) => {
      // 自动设置 sortOrder（如果未提供）
      let sortOrder = dto.sortOrder
      if (sortOrder === undefined) {
        // 查询同级目录下的最大 sortOrder
        const whereCondition: any = {
          spaceId: dto.spaceId,
          delFlag: 0
        }
        
        if (dto.directoryId) {
          whereCondition.directoryId = dto.directoryId
        } else {
          whereCondition.directoryId = null
        }
        
        const siblings = await collectRepo.find({
          where: whereCondition,
          select: ['sortOrder']
        })
        
        // 计算下一个排序值
        const maxIndex = siblings.length + index
        const parentSortPath = dto.directoryId ? await getParentSortPath(collectRepo, dto.directoryId) : ''
        sortOrder = parentSortPath ? `${parentSortPath}-${maxIndex}` : maxIndex.toString()
      }

      return collectRepo.create({
        id: uuidv4(),
        ...dto,
        isFolder: dto.isFolder || 0,
        sortOrder: sortOrder,
        createBy: userId,
        createTime: new Date().toISOString(),
        updateBy: userId,
        updateTime: new Date().toISOString()
      })
    }))
    
    const savedCollects = await collectRepo.save(collects)
    
    // 发送刷新事件
    const tagCollects = savedCollects.filter(collect => 
      collect.isFolder === 0 && collect.cardId && collect.cardType === 'tag'
    )
    const cardCollects = savedCollects.filter(collect => 
      collect.isFolder === 0 && collect.cardId && collect.cardType !== 'tag'
    )

    // 发送标签列表刷新事件
    if (tagCollects.length > 0) {
      getMainWindow()?.webContents.send('tag:list:refresh', {
        source: 'batch-create-collect',
        count: tagCollects.length,
        spaceId: tagCollects[0].spaceId,
      })
    }

    // 发送卡片列表刷新事件
    if (cardCollects.length > 0) {
      getMainWindow()?.webContents.send('card:list:refresh', {
        source: 'batch-create-collect',
        count: cardCollects.length,
        spaceId: cardCollects[0].spaceId,
      })
    }
    
    return {
      success: true,
      data: {
        collects: savedCollects,
        count: savedCollects.length
      },
      message: `成功批量创建 ${savedCollects.length} 个收藏`
    }
  } catch (error) {
    console.error('批量创建收藏失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '批量创建收藏失败'
    }
  }
}
