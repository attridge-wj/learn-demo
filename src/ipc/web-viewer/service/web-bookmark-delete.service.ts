import { AppDataSource } from '../../../database/connection'
import { WebBookmarkEntity } from '../entities/sys_web_bookmark.entity'

export async function deleteWebBookmark(id: string) {
  try {
    const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
    
    // 检查是否有子书签
    const hasChildren = await bookmarkRepo.findOne({ 
      where: { parentId: id, delFlag: 0 } 
    })
    
    if (hasChildren) {
      throw new Error('该文件夹下还有书签，无法删除')
    }
    
    // 软删除
    await bookmarkRepo.update(id, { delFlag: 1 })
    return { success: true, message: '删除成功' }
  } catch (error) {
    console.error('删除书签失败:', error)
    throw error
  }
}
