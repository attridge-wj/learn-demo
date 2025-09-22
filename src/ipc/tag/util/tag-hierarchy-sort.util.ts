import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'

export class TagHierarchySortUtil {
  // 更新所有子标签的名称和层级（排序拖拽场景）
  static async updateChildrenTags(
    parentId: string, 
    newParentName: string, 
    newLevel: number,
    oldParentName: string,
    oldParentLevel: number,
    newParentFullName: string
  ): Promise<void> {
    const tagRepo = AppDataSource.getRepository(TagEntity)
    
    console.log(`父标签新完整名称: ${oldParentName} -> ${newParentFullName}`)
    
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
      if (nameParts.length > oldParentLevel) {
        // 提取子标签中父标签的完整路径（前 oldParentLevel + 1 个部分）
        const oldParentPath = nameParts.slice(0, oldParentLevel + 1).join('_')
        
        // 检查子标签是否确实以父标签路径开头
        if (child.name.startsWith(oldParentPath + '_')) {
          // 提取子标签相对于父标签的部分（去掉父标签路径）
          const childRelativePath = child.name.substring(oldParentPath.length + 1)
          
          // 构建新的子标签名称：新父标签路径 + 子标签相对路径
          const newChildName = newParentFullName + '_' + childRelativePath
          
          // 计算新的层级（保持相对层级不变）
          const levelDifference = child.level - oldParentLevel
          const newChildLevel = newLevel + levelDifference
          
          // 计算新的parentName
          let newParentNameForChild = newParentFullName
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
            level: newChildLevel,
            updateTime: new Date().toISOString()
          })
          
          console.log(`更新子标签: ${child.name} -> ${newChildName} (level: ${child.level} -> ${newChildLevel}, parentName: ${newParentNameForChild})`)
        }
      }
    }
  }
}
