import { AppDataSource } from '../../../database/connection'
import { AiPromptTemplateEntity } from '../entities/sys_ai_prompt_template.entity'
import type { CreateAiPromptTemplateDto } from '../dto/index.dto'

export async function createAiPromptTemplate(createDto: CreateAiPromptTemplateDto) {
  try {
    const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
    const template = templateRepo.create({
      ...createDto,
      delFlag: 0,
      useCount: 0
    })
    const result = await templateRepo.save(template)
    return result
  } catch (error) {
    console.error('创建提示词模板失败:', error)
    throw error
  }
} 