import { AppDataSource } from '../../../database/connection'
import { AiPromptTemplateEntity } from '../entities/sys_ai_prompt_template.entity'

export async function deleteAiPromptTemplate(id: string) {
  try {
    const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
    const template = await templateRepo.findOne({ where: { id, delFlag: 0 } })
    if (!template) throw new Error('提示词模板不存在')

    template.delFlag = 1
    const result = await templateRepo.save(template)
    return result
  } catch (error) {
    console.error('删除提示词模板失败:', error)
    throw error
  }
} 