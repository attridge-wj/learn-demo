import { AppDataSource } from '../../../database/connection'
import { AiPromptTemplateEntity } from '../entities/sys_ai_prompt_template.entity'
import type { PromptTemplateIdsDto } from '../dto/index.dto'
import { In } from 'typeorm'

export async function getAiPromptTemplatesByIds(promptTemplateIdsDto: PromptTemplateIdsDto) {
  try {
    const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
    const templates = await templateRepo.find({
      where: {
        id: In(promptTemplateIdsDto.ids),
        delFlag: 0
      }
    })
    return templates
  } catch (error) {
    console.error('批量查询提示词模板失败:', error)
    throw error
  }
} 