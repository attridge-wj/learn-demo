import { AppDataSource } from '../../../database/connection'
import { AiPromptTemplateEntity } from '../entities/sys_ai_prompt_template.entity'
import type { UpdateAiPromptTemplateDto } from '../dto/index.dto'

export async function updateAiPromptTemplate(id: string, updateDto: UpdateAiPromptTemplateDto) {
  try {
    const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
    const template = await templateRepo.findOne({ where: { id, delFlag: 0 } })
    if (!template) throw new Error('提示词模板不存在')

    Object.assign(template, updateDto)
    const result = await templateRepo.save(template)
    return result
  } catch (error) {
    console.error('更新提示词模板失败:', error)
    throw error
  }
} 