import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import { v4 as uuidv4 } from 'uuid'
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

export async function createCollectFolder(createCollectDto: CreateCollectDto, userId: number) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 如果有父目录，验证父目录是否存在且在同一空间
    if (createCollectDto.directoryId) {
      const parentCollect = await collectRepo.findOne({ 
        where: { 
          id: createCollectDto.directoryId, 
          spaceId: createCollectDto.spaceId,
          delFlag: 0 
        } 
      })
      
      if (!parentCollect) {
        throw new Error('父目录不存在或不在同一空间')
      }
    }

    // 自动设置 sortOrder（如果未提供）
    let sortOrder = createCollectDto.sortOrder
    if (sortOrder === undefined) {
      // 查询同级目录下的最大 sortOrder
      const whereCondition: any = {
        spaceId: createCollectDto.spaceId,
        delFlag: 0
      }
      
      if (createCollectDto.directoryId) {
        whereCondition.directoryId = createCollectDto.directoryId
      } else {
        whereCondition.directoryId = null
      }
      
      const siblings = await collectRepo.find({
        where: whereCondition,
        select: ['sortOrder']
      })
      
      // 计算下一个排序值
      const maxIndex = siblings.length
      const parentSortPath = createCollectDto.directoryId ? await getParentSortPath(collectRepo, createCollectDto.directoryId) : ''
      sortOrder = parentSortPath ? `${parentSortPath}-${maxIndex}` : maxIndex.toString()
    }

    const collect = collectRepo.create({
      id: uuidv4(),
      ...createCollectDto,
      isFolder: 1, // 强制设置为文件夹
      cardId: undefined, // 文件夹不需要cardId
      cardType: undefined, // 文件夹不需要cardType
      subType: undefined, // 文件夹不需要subType
      sortOrder: sortOrder
    })
    
    const savedCollect = await collectRepo.save(collect)
    
    // 文件夹创建不发送刷新事件，因为文件夹本身不关联卡片或标签
    // 只有收藏卡片时才需要发送对应的刷新事件

    return {
      success: true,
      data: savedCollect,
      message: '创建文件夹成功'
    }
  } catch (error) {
    console.error('创建收藏文件夹失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '创建文件夹失败'
    }
  }
} 