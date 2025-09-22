import { AppDataSource } from '../../../database/connection'
import { SysCardBaseEntity } from '../../card/entities/sys-card-base.entity'
import { SysCardRichTextEntity } from '../../card/entities/sys-card-rich-text.entity'
import { SysCardDrawboardEntity } from '../../card/entities/sys-card-drawboard.entity'
import { SysCardMindMapEntity } from '../../card/entities/sys-card-mind-map.entity'
import { SysCardMultiTableEntity } from '../../card/entities/sys-card-multi-table.entity'
import { SysCardFileEntity } from '../../card/entities/sys-card-file.entity'
import { SysCardMarkEntity } from '../../card/entities/sys-card-mark.entity'
import { SysCardMermaidEntity } from '../../card/entities/sys-card-mermaid.entity'
import { createCard } from '../../card/service/card-create.service'
import { resolveFilePath } from '../../../common/util/file-content-parse'
import { getDefaultStoragePath } from '../../../utils/file'
import store from '../../../utils/store'
import { ImportCanvasDto, CanvasImportResult } from '../dto/index.dto'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as yauzl from 'yauzl'
import { v4 as uuidv4 } from 'uuid'
import { dialog } from 'electron'

interface ImportData {
  'base-data': any
  'relate-data': any[]
}

/**
 * 导入画布/思维导图/多维表副本
 * @param importDto 导入参数
 * @returns 导入结果
 */
export async function importCanvas(importDto: ImportCanvasDto): Promise<CanvasImportResult> {
  const { importMode } = importDto
  const storagePath = store.get('storagePath') || getDefaultStoragePath()
  const tempDir = path.join(storagePath, 'temp', `import-${uuidv4()}`)
  const filesDir = path.join(storagePath, 'files')

  // 获取当前用户的 spaceId
  const currentSpaceId = store.get('spaceId')
  if (!currentSpaceId) {
    return {
      success: false,
      message: '未找到当前用户的空间ID，请先选择空间'
    }
  }

  try {
    // 让用户选择要导入的 ZIP 文件
    const fileResult = await dialog.showOpenDialog({
      title: '选择要导入的卡片副本',
      buttonLabel: '选择',
      filters: [
        { name: 'ZIP文件', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (fileResult.canceled || !fileResult.filePaths || fileResult.filePaths.length === 0) {
      return {
        success: false,
        message: '用户取消了文件选择'
      }
    }

    const zipPath = fileResult.filePaths[0]

    // 创建临时目录
    await fs.ensureDir(tempDir)
    await fs.ensureDir(filesDir)

    // 解压 ZIP 文件
    const extractedFiles = await extractZipFile(zipPath, tempDir)
    
    // 检查必要文件
    const cardBasePath = path.join(tempDir, 'card-base.json')
    if (!await fs.pathExists(cardBasePath)) {
        return {
            success: false,
            message: '压缩包中缺少 card-base.json 文件'
        }
        throw new Error('压缩包中缺少 card-base.json 文件')
    }

    // 读取导入数据
    const importData: ImportData = await fs.readJson(cardBasePath)
    if (!importData['base-data'] || !importData['relate-data']) {
        return {
            success: false,
            message: 'card-base.json 文件格式不正确'
        }
        throw new Error('card-base.json 文件格式不正确')
    }

    // 验证卡片类型是否支持导入
    const baseCardType = importData['base-data'].cardType
    if (!['draw-board', 'mind-map', 'multi-table'].includes(baseCardType)) {
        return {
            success: false,
            message: `不支持的卡片类型: ${baseCardType}，只支持画布、思维导图和多维表`
        }
        throw new Error(`不支持的卡片类型: ${baseCardType}`)
    }

    // 处理文件
    const filesDirPath = path.join(tempDir, 'files')
    if (await fs.pathExists(filesDirPath)) {
      await processImportedFiles(filesDirPath, filesDir, importMode)
    }

    // 导入卡片数据
    const importResult = await importCardData(importData, importMode, currentSpaceId)

    // 清理临时目录
    await fs.remove(tempDir)

    return {
      success: true,
      message: `${baseCardType === 'draw-board' ? '画布' : baseCardType === 'mind-map' ? '思维导图' : '多维表'}导入成功`,
      data: {
        baseCardId: importData['base-data'].id,
        importedCount: importResult.importedCount,
        skippedCount: importResult.skippedCount,
        overwrittenCount: importResult.overwrittenCount
      }
    }

  } catch (error) {
    console.error('导入卡片失败:', error)
    
    // 清理临时目录
    try {
      await fs.remove(tempDir)
    } catch (cleanupError) {
      console.warn('清理临时目录失败:', cleanupError)
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '导入失败'
    }
  }
}

/**
 * 解压 ZIP 文件
 */
async function extractZipFile(zipPath: string, extractDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extractedFiles: string[] = []
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // 目录条目，跳过
          zipfile.readEntry()
        } else {
          // 文件条目
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err)
              return
            }

            const filePath = path.join(extractDir, entry.fileName)
            const dirPath = path.dirname(filePath)
            
            // 确保目录存在
            fs.ensureDir(dirPath).then(() => {
              const writeStream = fs.createWriteStream(filePath)
              readStream.pipe(writeStream)
              
              writeStream.on('close', () => {
                extractedFiles.push(filePath)
                zipfile.readEntry()
              })
              
              writeStream.on('error', (err) => {
                reject(err)
              })
            }).catch(reject)
          })
        }
      })

      zipfile.on('end', () => {
        resolve(extractedFiles)
      })

      zipfile.on('error', (err) => {
        reject(err)
      })
    })
  })
}

/**
 * 处理导入的文件
 */
async function processImportedFiles(sourceFilesDir: string, targetFilesDir: string, importMode: 'skip' | 'overwrite'): Promise<void> {
  const files = await fs.readdir(sourceFilesDir)
  
  for (const file of files) {
    const sourcePath = path.join(sourceFilesDir, file)
    const targetPath = path.join(targetFilesDir, file)
    
    if (await fs.pathExists(targetPath)) {
      if (importMode === 'skip') {
        console.log(`文件已存在，跳过: ${file}`)
        continue
      } else if (importMode === 'overwrite') {
        console.log(`文件已存在，覆盖: ${file}`)
        await fs.copy(sourcePath, targetPath)
      }
    } else {
      await fs.copy(sourcePath, targetPath)
    }
  }
}

/**
 * 导入卡片数据
 */
async function importCardData(importData: ImportData, importMode: 'skip' | 'overwrite', currentSpaceId: string): Promise<{ importedCount: number; skippedCount: number; overwrittenCount: number }> {
  let importedCount = 0
  let skippedCount = 0
  let overwrittenCount = 0

  // 导入关联卡片数据
  for (const cardData of importData['relate-data']) {
    try {
      const result = await importSingleCard(cardData, importMode, currentSpaceId)
      if (result.action === 'imported') {
        importedCount++
      } else if (result.action === 'skipped') {
        skippedCount++
      } else if (result.action === 'overwritten') {
        overwrittenCount++
      }
    } catch (error) {
      console.warn(`导入关联卡片失败: ${cardData.id}`, error)
      skippedCount++
    }
  }

  // 导入主卡片数据
  try {
    const result = await importSingleCard(importData['base-data'], importMode, currentSpaceId)
    if (result.action === 'imported') {
      importedCount++
    } else if (result.action === 'skipped') {
      skippedCount++
    } else if (result.action === 'overwritten') {
      overwrittenCount++
    }
  } catch (error) {
    console.warn(`导入主卡片失败: ${importData['base-data'].id}`, error)
    skippedCount++
  }

  return { importedCount, skippedCount, overwrittenCount }
}

/**
 * 删除卡片及其子表数据
 */
async function deleteCardWithSubTables(cardId: string): Promise<void> {
  // 先删除子表数据
  await AppDataSource.getRepository(SysCardRichTextEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardDrawboardEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardMindMapEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardMultiTableEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardFileEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardMarkEntity).delete({ cardId })
  await AppDataSource.getRepository(SysCardMermaidEntity).delete({ cardId })
  
  // 再删除主表数据
  await AppDataSource.getRepository(SysCardBaseEntity).delete({ id: cardId })
}

/**
 * 序列化卡片数据中的对象字段
 */
function serializeCardData(cardData: any): any {
  const serialized = { ...cardData }
  
  // 需要序列化的字段列表
  const fieldsToSerialize = [
    'extraData', 'content', 'viewList', 'data', 'attrList', 
    'markList', 'cardMap', 'config'
  ]
  
  for (const field of fieldsToSerialize) {
    if (cardData[field] !== undefined && cardData[field] !== null) {
      if (typeof cardData[field] === 'object') {
        serialized[field] = JSON.stringify(cardData[field])
      } else if (typeof cardData[field] === 'string') {
        // 如果已经是字符串，检查是否是有效的 JSON
        try {
          JSON.parse(cardData[field])
          serialized[field] = cardData[field] // 已经是 JSON 字符串
        } catch {
          serialized[field] = JSON.stringify(cardData[field]) // 普通字符串，需要序列化
        }
      }
    }
  }
  
  return serialized
}

/**
 * 导入单个卡片
 */
async function importSingleCard(cardData: any, importMode: 'skip' | 'overwrite', currentSpaceId: string): Promise<{ action: 'imported' | 'skipped' | 'overwritten' }> {
  // 替换 spaceId 为当前用户的 spaceId，并处理对象字段
  const modifiedCardData = serializeCardData({
    ...cardData,
    spaceId: currentSpaceId
  })

  // 检查卡片是否已存在
  const existingCard = await AppDataSource.getRepository(SysCardBaseEntity).findOne({
    where: { id: cardData.id }
  })

  if (existingCard) {
    if (importMode === 'skip') {
      console.log(`卡片已存在，跳过: ${cardData.id}`)
      return { action: 'skipped' }
    } else if (importMode === 'overwrite') {
      console.log(`卡片已存在，覆盖: ${cardData.id}`)
      // 先删除现有卡片及其子表，然后创建新卡片
      await deleteCardWithSubTables(cardData.id)
      await createCard(modifiedCardData)
      return { action: 'overwritten' }
    }
  }

  // 创建卡片
  await createCard(modifiedCardData)
  return { action: 'imported' }
}
