import { CollectEntity } from '../entities/sys_collect.entity';

export class CollectTreeUtil {
  // 比较 sortOrder 字符串（按层级数值排序）
  static compareSortOrder(sortOrderA: string, sortOrderB: string): number {
    if (sortOrderA === sortOrderB) return 0;
    
    const partsA = sortOrderA.split('-').map(part => parseInt(part, 10) || 0);
    const partsB = sortOrderB.split('-').map(part => parseInt(part, 10) || 0);
    
    const maxLength = Math.max(partsA.length, partsB.length);
    
    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA !== partB) {
        return partA - partB;
      }
    }
    
    return 0;
  }

  // 构建收藏夹树结构
  static buildCollectTree(items: CollectEntity[], directoryId: string | null = null): any[] {
    return items
      .filter(item => item.directoryId === directoryId)
      .map(item => ({
        ...item,
        children: CollectTreeUtil.buildCollectTree(items, item.id)
      }))
      .sort((a, b) => {
        // 首先按 sortOrder 数值排序
        const sortOrderCompare = CollectTreeUtil.compareSortOrder(a.sortOrder, b.sortOrder);
        if (sortOrderCompare !== 0) {
          return sortOrderCompare;
        }
        // 如果 sortOrder 相同，文件夹优先
        if (a.isFolder !== b.isFolder) {
          return b.isFolder - a.isFolder;
        }
        // 最后按名称排序
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
  }

  // 递归删除所有子收藏（硬删除）
  static async deleteChildrenRecursively(collectRepo: any, parentId: string): Promise<number> {
    const deleteChildrenRecursively = async (currentParentId: string): Promise<number> => {
      const children = await collectRepo.find({
        where: { directoryId: currentParentId, delFlag: 0 }
      });

      let count = 0;
      for (const child of children) {
        // 先递归删除子收藏的子收藏
        count += await deleteChildrenRecursively(child.id);
        // 然后硬删除当前收藏
        await collectRepo.delete(child.id);
        count++;
      }
      return count;
    };

    return await deleteChildrenRecursively(parentId);
  }
} 