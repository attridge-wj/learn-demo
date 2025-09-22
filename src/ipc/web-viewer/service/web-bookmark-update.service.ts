import { AppDataSource } from '../../../database/connection'
import { WebBookmarkEntity } from '../entities/sys_web_bookmark.entity'
import type { UpdateWebBookmarkDto } from '../dto/index.dto'

export async function updateWebBookmark(id: string, updateDto: UpdateWebBookmarkDto) {
  try {
    const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
    await bookmarkRepo.update(id, updateDto)
    const updatedBookmark = await bookmarkRepo.findOne({ where: { id, delFlag: 0 } })
    if (!updatedBookmark) throw new Error('书签不存在')
    return updatedBookmark
  } catch (error) {
    console.error('更新书签失败:', error)
    throw error
  }
}
