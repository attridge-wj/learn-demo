import { AppDataSource } from '../../../database/connection'
import { CollectEntity } from '../entities/sys_collect.entity'
import { CollectTreeUtil } from '../util/collect-tree.util'

export async function deleteCollect(id: string) {
  try {
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    // 检查收藏是否存在
    const collect = await collectRepo.findOne({ 
      where: { id, delFlag: 0 } 
    })
    
    if (!collect) {
      throw new Error('收藏不存在')
    }

    // 如果是文件夹，递归删除所有子收藏
    let childrenCount = 0
    if (collect.isFolder === 1) {
      childrenCount = await CollectTreeUtil.deleteChildrenRecursively(collectRepo, id)
    }

    // 硬删除主收藏
    await collectRepo.delete(id)

    const message = collect.isFolder === 1 
      ? `成功删除文件夹 "${collect.name}" 及其 ${childrenCount} 个子收藏`
      : `成功删除收藏 "${collect.name}"`

    return {
      success: true,
      message,
      deletedCount: childrenCount + 1,
      childrenCount
    }
  } catch (error) {
    console.error('删除收藏失败:', error)
    throw error
  }
} 