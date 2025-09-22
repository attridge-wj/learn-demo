import { AppDataSource } from '../../../database/connection'
import { WebBookmarkEntity } from '../entities/sys_web_bookmark.entity'
import type { WebBookmarkTreeItem } from '../../../types/web-viewer'

export interface WebBookmarkTreeItemLocal extends WebBookmarkTreeItem {
  children?: WebBookmarkTreeItemLocal[];
}

export async function getWebBookmarkTree(spaceId: string) {
  try {
    const bookmarkRepo = AppDataSource.getRepository(WebBookmarkEntity)
    
    // 获取所有书签
    const allBookmarks = await bookmarkRepo.find({
      where: { spaceId, delFlag: 0 },
      order: { updateTime: 'DESC' }
    })
    
    // 构建树形结构
    const buildTree = (parentId: string | null): WebBookmarkTreeItemLocal[] => {
      const children = allBookmarks.filter(item => item.parentId === parentId)
      return children.map(child => ({
        ...child,
        children: buildTree(child.id)
      }))
    }
    
    // 从根节点开始构建树
    const tree = buildTree(null)
    return tree
  } catch (error) {
    console.error('获取书签树形列表失败:', error)
    throw error
  }
}
