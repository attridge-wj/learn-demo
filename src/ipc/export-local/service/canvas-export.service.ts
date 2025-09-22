import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../../card/entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../../card/entities/sys-card-drawboard.entity'
import { SysCardMindMapEntity } from '../../card/entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../../card/entities/sys-card-multi-table.entity'
import { SysCardFileEntity } from '../../card/entities/sys-card-file.entity'
import { getOneCard } from '../../card/service/card-get-one.service'
import { batchGetFullCards } from './card-full-query.service'
import { resolveFilePath } from '../../../common/util/file-content-parse'
import { getDefaultStoragePath } from '../../../utils/file'
import store from '../../../utils/store'
import { ExportCanvasDto, CanvasExportResult } from '../dto/index.dto'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as archiver from 'archiver'
import { v4 as uuidv4 } from 'uuid'
import { dialog } from 'electron'

interface DrawboardElement {
  id: string
  cardType: string
  associateId?: string
}

interface MindMapElement {
  id: string
  associateId?: string
}

interface MultiTableData {
  relateId?: string
  [key: string]: any
}

interface CardInfo {
  id: string
  cardType: string
  subType?: string
  url?: string
  coverUrl?: string
}

interface CollectResult {
  cardInfos: CardInfo[]
  filesToExport: string[]
}

/**
 * 导出画布到本地副本
 * @param exportDto 导出参数
 * @returns 导出结果
 */
export async function exportCanvas(exportDto: ExportCanvasDto): Promise<CanvasExportResult> {
  const { id, exportFileMethod } = exportDto
  const storagePath = store.get('storagePath') || getDefaultStoragePath()
  const tempDir = path.join(storagePath, 'temp', `export-${uuidv4()}`)
  const filesDir = path.join(tempDir, 'files')
  const cardBasePath = path.join(tempDir, 'card-base.json')

  try {
    // 让用户选择保存位置
    const saveResult = await dialog.showSaveDialog({
      title: '导出画布',
      buttonLabel: '保存',
      defaultPath: `canvas-export-${id}-${Date.now()}.zip`,
      filters: [
        { name: 'ZIP文件', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return {
        success: false,
        message: '用户取消了导出'
      }
    }

    const zipPath = saveResult.filePath

    // 创建临时目录
    await fs.ensureDir(tempDir)
    await fs.ensureDir(filesDir)
    await fs.ensureDir(path.dirname(zipPath))

    // 获取主卡片详情
    const mainCard = await getOneCard(id)
    if (!mainCard) {
      throw new Error('卡片不存在')
    }

    // 检查卡片类型是否支持导出
    if (!['draw-board', 'mind-map', 'multi-table'].includes(mainCard.cardType)) {
      throw new Error('只支持导出画布、思维导图和多维表类型的卡片')
    }

    // 统一收集所有卡片信息和文件
    const processedIds = new Set<string>()
    const collectResult = await collectAllCardInfo(['draw-board', 'mind-map'].includes(mainCard.cardType) ? mainCard.content : { data: mainCard.data }, exportFileMethod, processedIds)
    
    // 提取卡片ID
    const relatedCardIds = collectResult.cardInfos.map(card => card.id)
    
    // 批量获取关联卡片详情（完整数据）
    const relatedCards = await batchGetFullCards(relatedCardIds)
    
    // 获取需要导出的文件
    const filesToExport = collectResult.filesToExport

    // 复制文件到临时目录
    for (const fileUrl of filesToExport) {
      try {
        const sourcePath = resolveFilePath(fileUrl)
        const fileName = path.basename(sourcePath)
        const destPath = path.join(filesDir, fileName)
        await fs.copy(sourcePath, destPath)
      } catch (error) {
        console.warn(`复制文件失败: ${fileUrl}`, error)
      }
    }

    // 生成card-base.json
    const exportData = {
      'base-data': mainCard,
      'relate-data': relatedCards
    }
    await fs.writeJson(cardBasePath, exportData, { spaces: 2 })

    // 创建zip文件
    await createZipFile(tempDir, zipPath)

    // 清理临时目录
    await fs.remove(tempDir)

    const cardTypeName = mainCard.cardType === 'draw-board' ? '画布' : 
                        mainCard.cardType === 'mind-map' ? '思维导图' : '多维表'
    
    return {
      success: true,
      message: `${cardTypeName}导出成功`,
      filePath: zipPath
    }

  } catch (error) {
    console.error('导出卡片失败:', error)
    
    // 清理临时目录
    try {
      await fs.remove(tempDir)
    } catch (cleanupError) {
      console.warn('清理临时目录失败:', cleanupError)
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '导出失败'
    }
  }
}

/**
 * 统一收集所有卡片信息和文件
 */
async function collectAllCardInfo(content: any, exportFileMethod: string, processedIds: Set<string>): Promise<CollectResult> {
  const cardInfos: CardInfo[] = []
  const filesToExport: string[] = []
  
  if (!content || typeof content !== 'object') {
    return { cardInfos, filesToExport }
  }

  // 处理画布和思维导图的elements
  if (content.elements && Array.isArray(content.elements)) {
    for (const element of content.elements) {
      if (element && element.id && ['card', 'diary', 'mark', 'attachment', 'mind-map', 'multi-table', 'draw-board'].includes(element.cardType)) {
        // 检查是否已经处理过，避免循环引用
        if (processedIds.has(element.id)) {
          continue
        }
        
        processedIds.add(element.id)
        
        // 收集卡片信息
        const cardInfo: CardInfo = {
          id: element.id,
          cardType: element.cardType,
          subType: element.subType,
          url: element.url,
          coverUrl: element.coverUrl
        }
        // 收集需要导出的文件
        if (exportFileMethod !== 'none' && cardInfo.url) {
          const shouldExport = shouldExportFile(cardInfo.url, exportFileMethod)
          if (shouldExport && !filesToExport.includes(cardInfo.url)) {
            filesToExport.push(cardInfo.url)
          }
        }
        cardInfos.push(cardInfo)
        
        // 递归处理复杂类型
        if (element.cardType === 'mind-map' || element.cardType === 'multi-table' || element.cardType === 'draw-board') {
          try {
            const subCard = await getOneCard(element.id)
            if (subCard && subCard.content) {
              const subResult = await collectAllCardInfo(element.cardType === 'multi-table' ? subCard : subCard.content, exportFileMethod, processedIds)
              cardInfos.push(...subResult.cardInfos)
              filesToExport.push(...subResult.filesToExport.filter(file => !filesToExport.includes(file)))
            }
          } catch (error) {
            console.warn(`获取子卡片详情失败: ${element.id}`, error)
          }
        }
      }
    }
  }

  // 处理思维导图的associateId
  if (content.elements && Array.isArray(content.elements)) {
    for (const element of content.elements) {
      if (element && element.associateId) {
        // 检查是否已经处理过，避免循环引用
        if (processedIds.has(element.associateId)) {
          continue
        }
        
        processedIds.add(element.associateId)
        
        // 收集关联卡片信息
        const cardInfo: CardInfo = {
          id: element.associateId,
          cardType: element.associateCardType,
          subType: element.associateSubType,
          url: element.associateUrl,
          coverUrl: element.associateCoverUrl
        }
         // 收集需要导出的文件
         if (exportFileMethod !== 'none' && cardInfo.url) {
          const shouldExport = shouldExportFile(cardInfo.url, exportFileMethod)
          if (shouldExport && !filesToExport.includes(cardInfo.url)) {
            filesToExport.push(cardInfo.url)
          }
        }
        cardInfos.push(cardInfo)
      }
    }
  }

  // 处理多维表的relateId
  if (content.data && Array.isArray(content.data)) {
    for (const item of content.data) {
      if (item && item.relateCardId) {
        // 检查是否已经处理过，避免循环引用
        if (processedIds.has(item.relateCardId)) {
          continue
        }
        
        processedIds.add(item.relateCardId)
        
        // 收集关联卡片信息
        const cardInfo: CardInfo = {
          id: item.relateCardId,
          cardType: item.relateCardType,// 默认类型，实际类型需要查询数据库
          subType: item.relateSubType,
          url: item.relateUrl,
          coverUrl: item.relateCoverUrl
        }
         // 收集需要导出的文件
         if (exportFileMethod !== 'none' && cardInfo.url) {
          const shouldExport = shouldExportFile(cardInfo.url, exportFileMethod)
          if (shouldExport && !filesToExport.includes(cardInfo.url)) {
            filesToExport.push(cardInfo.url)
          }
        }
        
        cardInfos.push(cardInfo)
      }
    }
  }
  
  return { cardInfos, filesToExport }
}


/**
 * 判断文件是否应该导出
 */
function shouldExportFile(fileUrl: string, exportFileMethod: string): boolean {
  if (exportFileMethod === 'none') return false
  if (exportFileMethod === 'all') return true
  if (exportFileMethod === 'in') {
    return fileUrl.startsWith('user-data://')
  }
  return false
}

/**
 * 创建zip文件
 */
async function createZipFile(sourceDir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver.create('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`ZIP文件创建完成: ${archive.pointer()} bytes`)
      resolve()
    })

    archive.on('error', (err: any) => {
      reject(err)
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}
