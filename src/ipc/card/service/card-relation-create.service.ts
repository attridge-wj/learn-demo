import { AppDataSource } from '../../../database/connection'
import { SysCardRelationEntity } from '../entities/sys-card-relation.entity'
import { CreateCardRelationDto, BatchCreateCardRelationDto } from '../dto/card-relation.dto'
import { toPlainObject } from '../index'

/**
 * 创建单个卡片关联关系
 * @param relationData 关联关系数据
 * @returns 创建的关联关系
 */
export async function createCardRelation(relationData: CreateCardRelationDto) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  
  // 检查是否已存在相同的关联关系
  const existingRelation = await repo.findOne({
    where: {
      parentId: relationData.parentId,
      subId: relationData.subId
    }
  })

  if (existingRelation) {
    // 如果已存在，则返回现有记录
    return toPlainObject(existingRelation)
  }

  // 创建新的关联关系
  const relation = repo.create(relationData)
  
  const saved = await repo.save(relation)
  return toPlainObject(saved)
}

/**
 * 批量创建卡片关联关系
 * @param batchData 批量创建数据
 * @returns 创建结果
 */
export async function batchCreateCardRelations(batchData: BatchCreateCardRelationDto) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  const relations: SysCardRelationEntity[] = []
  
  // 为每个subId创建关联关系
  for (const subId of batchData.subIds) {
    // 检查是否已存在
    const existingRelation = await repo.findOne({
      where: {
        parentId: batchData.parentId,
        subId: subId
      }
    })

    if (!existingRelation) {
      const relation = repo.create({
        parentId: batchData.parentId,
        subId: subId,
        spaceId: batchData.spaceId
      })
      relations.push(relation)
    }
  }

  if (relations.length > 0) {
    const saved = await repo.save(relations)
    return toPlainObject(saved)
  }

  return []
} 