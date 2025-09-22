import { AppDataSource } from '../../../database/connection'
import { SysCardRelationEntity } from '../entities/sys-card-relation.entity'
import { toPlainObject } from '../index'

/**
 * 根据父卡片ID查询所有子卡片ID
 * @param parentId 父卡片ID
 * @param spaceId 空间ID
 * @returns 子卡片ID列表
 */
export async function getSubIdsByParentId(parentId: string, spaceId?: string) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  const queryBuilder = repo.createQueryBuilder('relation')
    .select('relation.subId')
    .where('relation.parentId = :parentId', { parentId })

  if (spaceId) {
    queryBuilder.andWhere('relation.spaceId = :spaceId', { spaceId })
  }

  const relations = await queryBuilder.getMany()
  return relations.map(relation => relation.subId)
}

/**
 * 根据子卡片ID查询所有父卡片ID
 * @param subId 子卡片ID
 * @param spaceId 空间ID
 * @returns 父卡片ID列表
 */
export async function getParentIdsBySubId(subId: string, spaceId?: string) {
  const repo = AppDataSource.getRepository(SysCardRelationEntity)
  const queryBuilder = repo.createQueryBuilder('relation')
    .select('relation.parentId')
    .where('relation.subId = :subId', { subId })

  if (spaceId) {
    queryBuilder.andWhere('relation.spaceId = :spaceId', { spaceId })
  }

  const relations = await queryBuilder.getMany()
  return relations.map(relation => relation.parentId)
} 