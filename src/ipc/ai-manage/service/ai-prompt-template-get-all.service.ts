import { AppDataSource } from '../../../database/connection'
import { AiPromptTemplateEntity } from '../entities/sys_ai_prompt_template.entity'
import type { QueryAiPromptTemplateDto } from '../dto/index.dto'

export async function getAllAiPromptTemplates(query: QueryAiPromptTemplateDto) {
  try {
    const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
    const qb = templateRepo.createQueryBuilder('template')
      .where('template.delFlag = :delFlag', { delFlag: 0 })

    if (query.name) {
      qb.andWhere('template.name LIKE :name', { name: `%${query.name}%` })
    }

    if (query.category) {
      qb.andWhere('template.category = :category', { category: query.category })
    }

    if (query.modelName) {
      qb.andWhere('template.modelName = :modelName', { modelName: query.modelName })
    }

    if (query.spaceId) {
      qb.andWhere('template.spaceId = :spaceId', { spaceId: query.spaceId })
    }

    if (query.isDefault !== undefined) {
      qb.andWhere('template.isDefault = :isDefault', { isDefault: query.isDefault })
    }

    qb.orderBy('template.updateTime', 'DESC')

    const templates = await qb.getMany()
    return templates
  } catch (error) {
    console.error('查询提示词模板失败:', error)
    throw error
  }
} 