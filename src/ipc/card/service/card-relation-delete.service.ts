import { AppDataSource } from '../../../database/connection'
import { SysCardRelationEntity } from '../entities/sys-card-relation.entity'
import { BatchDeleteCardRelationDto } from '../dto/card-relation.dto'
import { In } from 'typeorm'

/**
 * 删除单个卡片关联关系
 * @param parentId 父卡片ID
 * @param subId 子卡片ID
 * @returns 删除结果
 */
export async function deleteCardRelation(parentId: string, subId: string) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  
  const result = await repo.delete({
    parentId,
    subId
  })
  
  return result.affected && result.affected > 0
}

/**
 * 批量删除卡片关联关系
 * @param batchData 批量删除数据
 * @returns 删除结果
 */
export async function batchDeleteCardRelations(batchData: BatchDeleteCardRelationDto) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  
  const result = await repo.delete({
    parentId: batchData.parentId,
    subId: In(batchData.subIds)
  })
  
  return result.affected && result.affected > 0
} 