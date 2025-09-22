import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../entities/sys-card-base.entity'
import { v4 as uuidv4 } from 'uuid'

/**
 * 更新或创建指定日期的card-date类型卡片
 * @param date 日期字符串
 * @param spaceId 空间ID
 * @returns 更新结果
 */
export async function updateCardDateForDiary(date: string, spaceId?: string): Promise<{
  success: boolean
  cardDateId?: string
  message: string
}> {
  try {
    const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
    
    // 通过日期和cardType查找card-date类型的卡片
    const cardDate = await cardDateRepo.findOne({ 
      where: { 
        date: date, 
        cardType: 'card-date',
        delFlag: 0
      } 
    })
    
    // 查找当前日期所有的diary（未删除的）
    const currentDateDiary = await cardDateRepo.find({ 
      where: { 
        date: date, 
        cardType: 'diary', 
        delFlag: 0 
      } 
    })
    
    // 构建extraData
    const extraData = JSON.stringify(
      currentDateDiary.map((item) => ({ 
        id: item.id, 
        name: item.name,
        date: item.date,
        cardType: item.cardType
      }))
    )
    
    if (!cardDate) {
      // 如果不存在则创建新的card-date卡片
      const newCardDate = await cardDateRepo.save({
        id: uuidv4(),
        name: date,
        date: date,
        cardType: 'card-date',
        spaceId: spaceId,
        extraData: extraData as any,
        delFlag: 0
      })
      
      return {
        success: true,
        cardDateId: newCardDate.id,
        message: `已创建日期卡片: ${date}`
      }
    } else {
      // 如果存在则更新extraData
      await cardDateRepo.update(
        { id: cardDate.id }, 
        { 
          extraData: extraData as any,
          updateTime: new Date().toISOString()
        }
      )
      
      return {
        success: true,
        cardDateId: cardDate.id,
        message: `已更新日期卡片: ${date}`
      }
    }
    
  } catch (error) {
    console.error('更新日期卡片失败:', error)
    return {
      success: false,
      message: `更新日期卡片失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

/**
 * 删除指定日期的card-date类型卡片（如果没有日记了）
 * @param date 日期字符串
 * @returns 删除结果
 */
export async function removeCardDateIfNoDiary(date: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
    
    // 查找当前日期是否还有diary
    const currentDateDiary = await cardDateRepo.find({ 
      where: { 
        date: date, 
        cardType: 'diary', 
        delFlag: 0 
      } 
    })
    
    // 如果没有diary了，删除card-date卡片
    if (currentDateDiary.length === 0) {
      const cardDate = await cardDateRepo.findOne({ 
        where: { 
          date: date, 
          cardType: 'card-date',
          delFlag: 0
        } 
      })
      console.log('cardDate删除', cardDate)
      
      if (cardDate) {
        await cardDateRepo.update(
          { id: cardDate.id },
          { 
            delFlag: 1,
            updateTime: new Date().toISOString()
          }
        )
        
        return {
          success: true,
          message: `已删除空的日期卡片: ${date}`
        }
      }
    }
    
    return {
      success: true,
      message: `日期卡片保留: ${date}`
    }
    
  } catch (error) {
    console.error('删除日期卡片失败:', error)
    return {
      success: false,
      message: `删除日期卡片失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

/**
 * 获取指定日期的所有日记卡片
 * @param date 日期字符串
 * @returns 日记卡片列表
 */
export async function getDiariesByDate(date: string): Promise<SysCardBaseEntity[]> {
  try {
    const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
    
    const diaries = await cardDateRepo.find({ 
      where: { 
        date: date, 
        cardType: 'diary', 
        delFlag: 0 
      },
      order: { createTime: 'ASC' }
    })
    
    return diaries
  } catch (error) {
    console.error('获取日期日记失败:', error)
    return []
  }
}

/**
 * 获取指定日期的card-date卡片
 * @param date 日期字符串
 * @returns card-date卡片
 */
export async function getCardDateByDate(date: string): Promise<SysCardBaseEntity | null> {
  try {
    const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
    
    const cardDate = await cardDateRepo.findOne({ 
      where: { 
        date: date, 
        cardType: 'card-date',
        delFlag: 0
      } 
    })
    
    return cardDate
  } catch (error) {
    console.error('获取日期卡片失败:', error)
    return null
  }
} 