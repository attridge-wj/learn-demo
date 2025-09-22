import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { In } from 'typeorm'
import { AiChatHistoryEntity } from './entities/sys_ai_chat_history.entity'
import { AiChatSessionEntity } from './entities/sys_ai_chat_session.entity'
import { AiPromptTemplateEntity } from './entities/sys_ai_prompt_template.entity'
import type { 
  CreateAiChatHistoryDto, 
  UpdateAiChatHistoryDto, 
  QueryAiChatHistoryDto,
  CreateAiChatSessionDto,
  UpdateAiChatSessionDto,
  QueryAiChatSessionDto,
  CreateAiPromptTemplateDto, 
  UpdateAiPromptTemplateDto, 
  QueryAiPromptTemplateDto,
  PromptTemplateIdsDto 
} from './dto/index.dto'

// 导入服务函数
import { getAllAiChatHistories } from './service/ai-chat-history-get-all.service'
import { createAiChatHistory } from './service/ai-chat-history-create.service'
import { updateAiChatHistory } from './service/ai-chat-history-update.service'
import { deleteAiChatHistory } from './service/ai-chat-history-delete.service'
import { getAllAiChatSessions } from './service/ai-chat-session-get-all.service'
import { createAiChatSession } from './service/ai-chat-session-create.service'
import { updateAiChatSession } from './service/ai-chat-session-update.service'
import { deleteAiChatSession } from './service/ai-chat-session-delete.service'
import { getAllAiPromptTemplates } from './service/ai-prompt-template-get-all.service'
import { createAiPromptTemplate } from './service/ai-prompt-template-create.service'
import { updateAiPromptTemplate } from './service/ai-prompt-template-update.service'
import { deleteAiPromptTemplate } from './service/ai-prompt-template-delete.service'
import { getAiPromptTemplatesByIds } from './service/ai-prompt-template-get-by-ids.service'

export function setupAiManageIPC(): void {
  // ==================== AI对话历史记录相关 ====================
  
  // 创建AI对话历史记录
  ipcMain.handle('ai-chat-history:create', async (_event: IpcMainInvokeEvent, createDto: CreateAiChatHistoryDto) => {
    return await createAiChatHistory(createDto)
  })

  // 查询AI对话历史记录列表
  ipcMain.handle('ai-chat-history:getAll', async (_event: IpcMainInvokeEvent, query: QueryAiChatHistoryDto) => {
    return await getAllAiChatHistories(query)
  })

  // 查询单个AI对话历史记录
  ipcMain.handle('ai-chat-history:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
      const history = await historyRepo.findOne({ where: { id, delFlag: 0 } })
      if (!history) throw new Error('AI对话历史记录不存在')
      return history
    } catch (error) {
      console.error('查询AI对话历史记录失败:', error)
      throw error
    }
  })

  // 更新AI对话历史记录
  ipcMain.handle('ai-chat-history:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: UpdateAiChatHistoryDto) => {
    return await updateAiChatHistory(id, updateDto)
  })

  // 删除AI对话历史记录（软删除）
  ipcMain.handle('ai-chat-history:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteAiChatHistory(id)
  })

  // 批量删除AI对话历史记录
  ipcMain.handle('ai-chat-history:deleteBatch', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    try {
      const historyRepo = AppDataSource.getRepository(AiChatHistoryEntity)
      const histories = await historyRepo.find({ 
        where: { 
          id: In(ids), 
          delFlag: 0 
        } 
      })
      
      for (const history of histories) {
        history.delFlag = 1
        await historyRepo.save(history)
      }
      
      return { success: true, count: histories.length }
    } catch (error) {
      console.error('批量删除AI对话历史记录失败:', error)
      throw error
    }
  })

  // ==================== AI对话会话相关 ====================
  
  // 创建AI对话会话
  ipcMain.handle('ai-chat-session:create', async (_event: IpcMainInvokeEvent, createDto: CreateAiChatSessionDto) => {
    return await createAiChatSession(createDto)
  })

  // 查询AI对话会话列表
  ipcMain.handle('ai-chat-session:getAll', async (_event: IpcMainInvokeEvent, query: QueryAiChatSessionDto) => {
    return await getAllAiChatSessions(query)
  })

  // 查询单个AI对话会话
  ipcMain.handle('ai-chat-session:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
      const session = await sessionRepo.findOne({ where: { id, delFlag: 0 } })
      if (!session) throw new Error('AI对话会话不存在')
      return session
    } catch (error) {
      console.error('查询AI对话会话失败:', error)
      throw error
    }
  })

  // 更新AI对话会话
  ipcMain.handle('ai-chat-session:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: UpdateAiChatSessionDto) => {
    return await updateAiChatSession(id, updateDto)
  })

  // 删除AI对话会话（软删除）
  ipcMain.handle('ai-chat-session:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteAiChatSession(id)
  })

  // 批量删除AI对话会话
  ipcMain.handle('ai-chat-session:deleteBatch', async (_event: IpcMainInvokeEvent, ids: string[]) => {
    try {
      const sessionRepo = AppDataSource.getRepository(AiChatSessionEntity)
      const sessions = await sessionRepo.find({ 
        where: { 
          id: In(ids), 
          delFlag: 0 
        } 
      })
      
      for (const session of sessions) {
        session.delFlag = 1
        await sessionRepo.save(session)
      }
      
      return { success: true, count: sessions.length }
    } catch (error) {
      console.error('批量删除AI对话会话失败:', error)
      throw error
    }
  })



  // ==================== 提示词模板相关 ====================
  
  // 创建提示词模板
  ipcMain.handle('ai-prompt-template:create', async (_event: IpcMainInvokeEvent, createDto: CreateAiPromptTemplateDto) => {
    return await createAiPromptTemplate(createDto)
  })

  // 查询提示词模板列表
  ipcMain.handle('ai-prompt-template:getAll', async (_event: IpcMainInvokeEvent, query: QueryAiPromptTemplateDto) => {
    return await getAllAiPromptTemplates(query)
  })

  // 查询单个提示词模板
  ipcMain.handle('ai-prompt-template:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
      const template = await templateRepo.findOne({ where: { id, delFlag: 0 } })
      if (!template) throw new Error('提示词模板不存在')
      return template
    } catch (error) {
      console.error('查询提示词模板失败:', error)
      throw error
    }
  })

  // 更新提示词模板
  ipcMain.handle('ai-prompt-template:update', async (_event: IpcMainInvokeEvent, id: string, updateDto: UpdateAiPromptTemplateDto) => {
    return await updateAiPromptTemplate(id, updateDto)
  })

  // 删除提示词模板（软删除）
  ipcMain.handle('ai-prompt-template:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    return await deleteAiPromptTemplate(id)
  })

  // 批量获取提示词模板详情
  ipcMain.handle('ai-prompt-template:getByIds', async (_event: IpcMainInvokeEvent, promptTemplateIdsDto: PromptTemplateIdsDto) => {
    return await getAiPromptTemplatesByIds(promptTemplateIdsDto)
  })

  // 增加提示词模板使用次数
  ipcMain.handle('ai-prompt-template:incrementUseCount', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
      const template = await templateRepo.findOne({ where: { id, delFlag: 0 } })
      if (!template) throw new Error('提示词模板不存在')

      template.useCount = (template.useCount || 0) + 1
      const result = await templateRepo.save(template)
      return result
    } catch (error) {
      console.error('增加提示词模板使用次数失败:', error)
      throw error
    }
  })

  // 获取默认提示词模板
  ipcMain.handle('ai-prompt-template:getDefault', async (_event: IpcMainInvokeEvent, spaceId?: string) => {
    try {
      const templateRepo = AppDataSource.getRepository(AiPromptTemplateEntity)
      const qb = templateRepo.createQueryBuilder('template')
        .where('template.delFlag = :delFlag', { delFlag: 0 })
        .andWhere('template.isDefault = :isDefault', { isDefault: 1 })

      if (spaceId) {
        qb.andWhere('template.spaceId = :spaceId', { spaceId })
      }

      const template = await qb.getOne()
      return template
    } catch (error) {
      console.error('获取默认提示词模板失败:', error)
      throw error
    }
  })
}
