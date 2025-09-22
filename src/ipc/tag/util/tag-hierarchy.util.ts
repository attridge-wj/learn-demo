import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import { CollectEntity } from '../../collect/entities/sys_collect.entity'

export class TagHierarchyUtil {
  // 生成完整的标签名称（包含父标签名称）
  static generateFullTagName(name: string, parentName?: string): string {
    if (!parentName) return name
    return `${parentName}_${name}`
  }

  // 获取父标签信息
  static async getParentTagInfo(parentId: string): Promise<{ name: string; level: number } | null> {
    if (!parentId) return null
    
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const parentTag = await tagRepo.findOne({ 
      where: { id: parentId, delFlag: 0 },
      select: ['name', 'level', 'parentName']
    })
    
    if (!parentTag) return null
    
    return {
      name: parentTag.name,
      level: parentTag.level
    }
  }

  // 更新所有子标签的名称和层级
  static async updateChildrenTags(
    parentId: string, 
    newParentName: string, 
    newLevel: number,
    oldParentName?: string,
    oldParentLevel?: number,
    newParentFullName?: string
  ): Promise<void> {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    
    // 如果没有传递原始父标签信息，则查询获取
    let actualOldParentName = oldParentName
    let actualOldParentLevel = oldParentLevel
    
    if (!actualOldParentName || actualOldParentLevel === undefined) {
      const parentTag = await tagRepo.findOne({ 
        where: { id: parentId, delFlag: 0 },
        select: ['name', 'level']
      })
      
      if (!parentTag) return
      
      actualOldParentName = parentTag.name
      actualOldParentLevel = parentTag.level
    }
    
    // 构建父标签的新完整名称
    let actualNewParentFullName = newParentFullName
    if (!actualNewParentFullName) {
      // 如果没有传递新的父标签完整名称，则计算
      actualNewParentFullName = newParentName
      if (newLevel > 0) {
        // 如果新层级大于0，需要保持前缀
        const parentNameParts = actualOldParentName.split('_')
        const prefixParts = parentNameParts.slice(0, newLevel)
        prefixParts.push(newParentName)
        actualNewParentFullName = prefixParts.join('_')
      }
    }
    
    console.log(`父标签新完整名称: ${actualOldParentName} -> ${actualNewParentFullName}`)
    
    // 获取所有需要更新的子标签（包括所有层级的子标签）
    const getAllChildren = async (parentId: string): Promise<TagEntity[]> => {
      const children = await tagRepo.find({
        where: { parentId, delFlag: 0 }
      })
      
      let allChildren: TagEntity[] = []
      for (const child of children) {
        allChildren.push(child)
        // 递归获取子标签的子标签
        const subChildren = await getAllChildren(child.id)
        allChildren = allChildren.concat(subChildren)
      }
      
      return allChildren
    }
    
    // 获取所有子标签
    const allChildren = await getAllChildren(parentId)
    
    console.log('需要更新的子标签数量:', allChildren.length)
    
    // 更新所有子标签
    for (const child of allChildren) {
      // 将标签名称按 '_' 分割成数组
      const nameParts = child.name.split('_')
      
      // 检查子标签是否包含父标签的完整路径
      if (nameParts.length > actualOldParentLevel) {
        // 提取子标签中父标签的完整路径（前 actualOldParentLevel + 1 个部分）
        const oldParentPath = nameParts.slice(0, actualOldParentLevel + 1).join('_')
        
        // 检查子标签是否确实以父标签路径开头
        if (child.name.startsWith(oldParentPath + '_')) {
          // 提取子标签相对于父标签的部分（去掉父标签路径）
          const childRelativePath = child.name.substring(oldParentPath.length + 1)
          
          // 构建新的子标签名称：新父标签路径 + 子标签相对路径
          const newChildName = actualNewParentFullName + '_' + childRelativePath
          
          // 计算新的层级（保持相对层级不变）
          const levelDifference = child.level - actualOldParentLevel
          const newChildLevel = newLevel + levelDifference
          
          // 计算新的parentName
          let newParentNameForChild = actualNewParentFullName
          if (newLevel > 0) {
            // 如果新层级大于0，需要构建完整的前缀
            // 取前newLevel个元素，并将最后一个替换为新名称
            const prefixParts = nameParts.slice(0, newLevel)
            prefixParts[prefixParts.length - 1] = newParentName
            newParentNameForChild = prefixParts.join('_')
          }
          
          // 更新子标签
          await tagRepo.update(child.id, {
            name: newChildName,
            parentName: newParentNameForChild,
            level: newChildLevel
          })
          
          console.log(`更新子标签: ${child.name} -> ${newChildName} (level: ${child.level} -> ${newChildLevel}, parentName: ${newParentNameForChild})`)
        }
      }
    }
  }

  // 递归删除所有子标签
  static async deleteChildrenRecursively(parentId: string): Promise<number> {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    const collectRepo = AppDataSource.getRepository(CollectEntity)
    
    const deleteChildrenRecursively = async (currentParentId: string): Promise<number> => {
      const children = await tagRepo.find({
        where: { parentId: currentParentId, delFlag: 0 }
      })

      let count = 0
      for (const child of children) {
        // 删除子标签
        await tagRepo.update(child.id, { delFlag: 1 })
        
        // 删除子标签对应的收藏数据
        try {
          const collects = await collectRepo.find({
            where: { 
              cardId: child.id, 
              cardType: 'tag',
              delFlag: 0 
            }
          })
          
          if (collects.length > 0) {
            await collectRepo.update(
              { cardId: child.id, cardType: 'tag', delFlag: 0 },
              { delFlag: 1, updateTime: new Date().toISOString() }
            )
            console.log(`删除了子标签 "${child.name}" 的 ${collects.length} 个收藏记录`)
          }
        } catch (error) {
          console.warn(`删除子标签 "${child.name}" 的收藏记录失败:`, error)
          // 不抛出错误，避免影响标签删除主流程
        }
        
        count++
        // 递归删除子标签的子标签
        count += await deleteChildrenRecursively(child.id)
      }
      return count
    }

    return await deleteChildrenRecursively(parentId)
  }

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

  // 构建标签树结构
  static buildTagTree(items: TagEntity[], parentId: string | null = null): any[] {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: TagHierarchyUtil.buildTagTree(items, item.id)
      }))
      .sort((a, b) => {
        // 首先按 sortOrder 数值排序
        const sortOrderCompare = TagHierarchyUtil.compareSortOrder(a.sortOrder, b.sortOrder);
        if (sortOrderCompare !== 0) {
          return sortOrderCompare;
        }
        // 如果 sortOrder 相同，按名称排序
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
  }
} 