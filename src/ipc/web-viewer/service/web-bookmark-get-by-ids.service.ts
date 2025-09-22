import { AppDataSource } from '../../../database/connection'
import { WebBookmarkEntity } from '../entities/sys_web_bookmark.entity'
import type { WebBookmarkIdsDto } from '../dto/index.dto'

export async function getWebBookmarksByIds(bookmarkIdsDto: WebBookmarkIdsDto) {
  try {
    const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
    const bookmarks = await bookmarkRepo.findByIds(bookmarkIdsDto.ids)
    return bookmarks.filter(bookmark => bookmark.delFlag === 0)
  } catch (error) {
    console.error('根据ID获取书签失败:', error)
    throw error
  }
}
