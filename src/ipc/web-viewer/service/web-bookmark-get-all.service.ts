import { AppDataSource } from '../../../database/connection'
import { WebBookmarkEntity } from '../entities/sys_web_bookmark.entity'
import type { QueryWebBookmarkDto } from '../dto/index.dto'

export async function getAllWebBookmarks(query: QueryWebBookmarkDto) {
  try {
    const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
    const qb = bookmarkRepo.createQueryBuilder('bookmark')
      .where('bookmark.delFlag = :delFlag', { delFlag: 0 })

    if (query.name) {
      qb.andWhere('bookmark.name LIKE :name', { name: `%${query.name}%` })
    }

    if (query.parentId) {
      qb.andWhere('bookmark.parentId = :parentId', { parentId: query.parentId })
    }

    if (query.category) {
      qb.andWhere('bookmark.category = :category', { category: query.category })
    }

    if (query.spaceId) {
      qb.andWhere('bookmark.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    qb.orderBy('bookmark.updateTime', 'DESC')

    const bookmarks = await qb.getMany()
    return bookmarks
  } catch (error) {
    console.error('查询书签列表失败:', error)
    throw error
  }
}
