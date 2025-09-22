import { AppDataSource } from '../../../database/connection'
import { TagEntity } from '../entities/sys_tag.entity'
import type { UpdateTagDto } from '../dto/index.dto'

export async function batchUpdateTag(updates: Array<{ id: string; updateData: UpdateTagDto }>, userId: number) {
  try {
    return await AppDataSource.transaction(async manager => {
      const tagRepo = manager.getRepository(TagEntity)
      
      const results = []
      
      for (const { id, updateData } of updates) {
        try {
          // 检查标签是否存在
          const tag = await tagRepo.findOne({ where: { id, delFlag: 0 } })
          if (!tag) {
            results.push({
              id,
              success: false,
              message: '标签不存在'
            })
            continue
          }

          // 更新标签
          await tagRepo.update(id, {
            ...updateData,
            updateBy: userId,
            updateTime: new Date().toISOString()
          })

          results.push({
            id,
            success: true,
            message: '更新成功'
          })
        } catch (error) {
          results.push({
            id,
            success: false,
            message: error instanceof Error ? error.message : '更新失败'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return {
        success: true,
        data: {
          results,
          successCount,
          failCount,
          totalCount: updates.length
        },
        message: `批量更新完成：成功 ${successCount} 个，失败 ${failCount} 个`
      }
    })
  } catch (error) {
    console.error('批量更新标签失败:', error)
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '批量更新标签失败'
    }
  }
}
