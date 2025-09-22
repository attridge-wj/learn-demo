import { ipcMain, dialog } from 'electron'
import { getDefaultStoragePath, getFileStoragePath, getFileSize, importFile, saveBase64File, formatLocalTime, formatDisplayTime } from '../../utils/file'
import path from 'path'
import fs from 'fs-extra'
import { closeDatabase, initDatabase } from '../../database/connection'
import store from '../../utils/store';

// 全局类型定义
declare global {
  var importOperations: Map<string, AbortController> | undefined
}

let dialogShow = false

export function setupStorageIPC(): void {
  // 获取默认存储路径
  ipcMain.handle('storage:getDefaultStoragePath', async () => {
    return getDefaultStoragePath()
  })

  // 获取自定义存储路径
  ipcMain.handle('storage:getStoragePath', async () => {
    const storagePath = store.get('storagePath')
    return storagePath ? storagePath : getDefaultStoragePath()
  })

  // 获取文件存储路径
  ipcMain.handle('storage:getFileStoragePath', async () => {
    return getFileStoragePath()
  })

  // 获取数据库备份路径
  ipcMain.handle('storage:getDatabaseBackupPath', async () => {
    const databaseBackupPath = store.get('databaseBackupPath')
    return databaseBackupPath ? databaseBackupPath : getDefaultStoragePath()
  })

  // 设置数据库备份路径
  ipcMain.handle('storage:setDatabaseBackupPath', async (_event, path: string) => {
    store.set('databaseBackupPath', path)
    return true
  })

  // 设置自定义存储路径
  ipcMain.handle('storage:setStoragePath', async (_event, filePath: string) => {
    console.log('设置存储路径', filePath)
    
    // 设置前先判断之前的目录是不是与当前一致
    const currentFilePath = store.get('storagePath') || getDefaultStoragePath()
    if (currentFilePath === filePath) {
      return true
    }

    store.set('storagePath', filePath)
    const filesPath = path.join(filePath, 'files')
    const dbPath = path.join(filePath, 'db')
    const currentFilesPath = path.join(currentFilePath, 'files')
    const currentDbPath = path.join(currentFilePath, 'db')

    await fs.ensureDir(filesPath)
    await fs.ensureDir(dbPath)

    // 如果有之前的目录，则直接移动整个文件夹
    if (currentFilePath && await fs.pathExists(currentFilesPath)) {
      await fs.move(currentFilesPath, filesPath, { overwrite: true })
    }
    if (currentFilePath && await fs.pathExists(currentDbPath)) {
      await fs.move(currentDbPath, dbPath, { overwrite: true })
    }

    return true
  })

  // 获取存储路径所有文件的大小总和
  ipcMain.handle('storage:getStoragePathFileSize', async () => {
    const storagePath = store.get('storagePath') || getDefaultStoragePath()
    const fileSize = await getFileSize(storagePath)
    // 转换为 MB，超过1Gb则转换为GB
    if (fileSize > 1024 * 1024 * 1024) {
      return (fileSize / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
    } else if (fileSize > 1024 * 1024) {
      return (fileSize / (1024 * 1024)).toFixed(2) + 'MB'
    }
    return fileSize.toFixed(2) + 'KB'
  })

  // 保存文件
  ipcMain.handle('storage:importFile', async (_event, params: {
    fileName: string
    filePath: string
  }) => {
    try {
      const filePath = await importFile(params)
      return filePath
    } catch (error) {
      console.error('保存文件失败:', error)
      throw error
    }
  })

  // 流式保存文件（支持进度回调）
  ipcMain.handle('storage:importFileWithProgress', async (event, params: {
    fileName: string
    filePath: string
    operationId: string // 用于标识操作，支持取消
  }) => {
    try {
      const { importFileWithProgress } = await import('../../utils/file')
      
      // 创建 AbortController 用于取消操作
      const abortController = new AbortController()
      
      // 存储 AbortController，用于后续取消操作
      if (!global.importOperations) {
        global.importOperations = new Map()
      }
      global.importOperations.set(params.operationId, abortController)
      
      // 清理函数
      const cleanup = () => {
        global.importOperations?.delete(params.operationId)
      }
      
      try {
        const filePath = await importFileWithProgress({
          ...params,
          signal: abortController.signal,
          onProgress: (progress) => {
            // 发送进度更新到渲染进程
            event.sender.send('storage:importProgress', {
              operationId: params.operationId,
              progress
            })
          }
        })
        
        cleanup()
        return { success: true, filePath }
      } catch (error) {
        cleanup()
        throw error
      }
    } catch (error) {
      console.error('流式保存文件失败:', error)
      throw error
    }
  })

  // 取消文件导入操作
  ipcMain.handle('storage:cancelImportFile', async (_event, operationId: string) => {
    try {
      if (global.importOperations?.has(operationId)) {
        const abortController = global.importOperations.get(operationId)
        if (abortController) {
          abortController.abort()
          global.importOperations.delete(operationId)
          return { success: true, message: '操作已取消' }
        }
      }
      return { success: false, message: '未找到指定的操作' }
    } catch (error) {
      console.error('取消文件导入失败:', error)
      throw error
    }
  })

  // 保存 Base64 文件
  ipcMain.handle('storage:saveBase64File', async (_event, params: {
    fileName: string
    base64Data: string
  }) => {
    try {
      const filePath = await saveBase64File(params)
      return filePath
    } catch (error) {
      console.error('保存Base64文件失败:', error)
      throw error
    }
  })

  // 选择文件夹
  ipcMain.handle('storage:selectFolder', async () => {
    if (dialogShow) {
      return
    }
    dialogShow = true
    const folderPath = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    // 如果取消则返回
    if (folderPath.canceled) {
      dialogShow = false
      return null
    }
    dialogShow = false
    return folderPath.filePaths[0]
  })

  // 备份数据库文件
  ipcMain.handle('storage:backupDatabase', async () => {
    const databaseBackupPath = store.get('databaseBackupPath') || getDefaultStoragePath()
    const backupPath = path.join(databaseBackupPath, 'backup')
    await fs.ensureDir(backupPath)
    
    // 获取存储路径的db及files
    const originDbPath = getDefaultStoragePath()
    const dbDir = path.join(originDbPath, 'rebirth_database')
    
    // 确保数据库目录存在
    if (!(await fs.pathExists(dbDir))) {
      throw new Error('数据库目录不存在')
    }
    
    const dbFiles = await fs.readdir(dbDir)
    const timestamp = formatLocalTime()
    
    // 备份所有数据库相关文件
    const backupFiles = []
    for (const file of dbFiles) {
      const srcPath = path.join(dbDir, file)
      const destPath = path.join(backupPath, `${timestamp}_${file}`)
      await fs.copy(srcPath, destPath)
      backupFiles.push(file)
    }
    
    console.log(`数据库备份完成，备份了 ${backupFiles.length} 个文件:`, backupFiles)
    return {
      success: true,
      message: `备份完成，包含 ${backupFiles.length} 个文件`,
      files: backupFiles
    }
  })

  // 获取当前空间ID
  ipcMain.handle('storage:getSpaceId', async () => {
    return store.get('spaceId')
  })
}

// 获取备份数据的列表
ipcMain.handle('storage:getBackupDatabaseList', async () => {
  try {
    const databaseBackupPath = store.get('databaseBackupPath') || getDefaultStoragePath()
    const backupPath = path.join(databaseBackupPath, 'backup')
    
    // 验证目录存在性
    if (!(await fs.pathExists(backupPath))) {
      return [] // 目录不存在时返回空数组
    }

    const backupList = await fs.readdir(backupPath)
    
    // 只处理.db文件，作为备份的代表
    const dbFiles = backupList.filter(file => file.endsWith('.db'))
    
    const processed = await Promise.all(
      dbFiles.map(async file => {
        const filePath = path.join(backupPath, file)
        const stats = await fs.stat(filePath)
        const timestamp = file.split('_')[0]
        const originalFileName = file.substring(timestamp.length + 1) // 移除时间戳前缀
        
        // 计算该时间戳对应的所有文件总大小
        const relatedFiles = backupList.filter(f => f.startsWith(timestamp + '_'))
        let totalSize = 0
        for (const relatedFile of relatedFiles) {
          const relatedFilePath = path.join(backupPath, relatedFile)
          const relatedStats = await fs.stat(relatedFilePath)
          totalSize += relatedStats.size
        }
        
        return {
          timestamp,
          displayTime: formatDisplayTime(timestamp),
          fileName: originalFileName,
          fileNameWithTime: `${formatDisplayTime(timestamp)} - ${originalFileName}`,
          fileSize: (stats.size / 1024).toFixed(2) + 'KB',
          totalSize: (totalSize / 1024).toFixed(2) + 'KB',
          fileCount: relatedFiles.length
        }
      })
    )
    
    // 按时间戳排序（最新的在前）
    return {
      success: true,
      data: processed.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    }
  } catch (err) {
    console.error('获取备份列表失败:', err)
    return {
      success: false,
      data: []
    }
  }
})

// 恢复数据库
ipcMain.handle('storage:restoreBackupDatabase', async (_event, params: {
  timestamp: string
}) => {
  try {
    const databaseBackupPath = store.get('databaseBackupPath') || getDefaultStoragePath()
    const backupPath = path.join(databaseBackupPath, 'backup')
    const originDbPath = getDefaultStoragePath()
    const dbDir = path.join(originDbPath, 'rebirth_database')
    
    // 确保目标目录存在
    await fs.ensureDir(dbDir)
    
    // 关闭数据库连接
    await closeDatabase()
    
    // 等待一小段时间确保连接完全关闭
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 查找该时间戳对应的所有备份文件
    const backupFiles = await fs.readdir(backupPath)
    const targetFiles = backupFiles.filter(file => file.startsWith(params.timestamp + '_'))
    
    if (targetFiles.length === 0) {
      throw new Error(`未找到时间戳为 ${params.timestamp} 的备份文件`)
    }
    
    console.log(`找到 ${targetFiles.length} 个备份文件:`, targetFiles)
    
    // 备份当前数据库文件（如果存在）
    const currentFiles = await fs.readdir(dbDir)
    for (const file of currentFiles) {
      const srcPath = path.join(dbDir, file)
      const backupPath_current = path.join(dbDir, file + '.old')
      if (await fs.pathExists(srcPath)) {
        await fs.move(srcPath, backupPath_current)
      }
    }
    
    // 恢复备份文件
    const restoredFiles = []
    for (const backupFile of targetFiles) {
      const srcPath = path.join(backupPath, backupFile)
      const originalFileName = backupFile.substring(params.timestamp.length + 1)
      const destPath = path.join(dbDir, originalFileName)
      
      await fs.copy(srcPath, destPath)
      restoredFiles.push(originalFileName)
    }
    
    // 重新初始化数据库连接
    await initDatabase()
    console.log(`恢复数据库成功，恢复了 ${restoredFiles.length} 个文件:`, restoredFiles)
    
    return {
      success: true,
      message: `恢复成功，恢复了 ${restoredFiles.length} 个文件`,
      files: restoredFiles
    }
  } catch (error) {
    console.error('恢复数据库失败:', error)
    // 如果恢复失败，尝试重新初始化数据库
    try {
      await initDatabase()
    } catch (initError) {
      console.error('重新初始化数据库失败:', initError)
    }
    throw error
  }
})

// 删除备份数据
ipcMain.handle('storage:deleteBackupDatabase', async (_event, params: {
  timestamp: string
}) => {
  try {
    const databaseBackupPath = store.get('databaseBackupPath') || getDefaultStoragePath()
    const backupPath = path.join(databaseBackupPath, 'backup')
    
    // 查找该时间戳对应的所有备份文件
    const backupFiles = await fs.readdir(backupPath)
    const targetFiles = backupFiles.filter(file => file.startsWith(params.timestamp + '_'))
    
    if (targetFiles.length === 0) {
      throw new Error(`未找到时间戳为 ${params.timestamp} 的备份文件`)
    }
    
    // 删除所有相关文件
    const deletedFiles = []
    for (const file of targetFiles) {
      const filePath = path.join(backupPath, file)
      await fs.remove(filePath)
      deletedFiles.push(file)
    }
    
    console.log(`删除备份成功，删除了 ${deletedFiles.length} 个文件:`, deletedFiles)
    return {
      success: true,
      message: `删除成功，删除了 ${deletedFiles.length} 个文件`,
      files: deletedFiles
    }
  } catch (error) {
    console.error('删除备份失败:', error)
    throw error
  }
})

// 增加一个用于存储大模型配置的ipc，key是模型的名称，value是对应的配置对象
ipcMain.handle('storage:setLargeModelConfig', async (_event, params: {
  modelName: string
  config: any
}) => {
  store.set(`largeModelConfig:${params.modelName}`, params.config)
  return true
})  

// 获取大模型配置
ipcMain.handle('storage:getLargeModelConfig', async (_event, params: {
  modelName: string
}) => {
  return store.get(`largeModelConfig:${params.modelName}`)
})

// 获取所有大模型配置列表
ipcMain.handle('storage:getLargeModelConfigList', async () => {
  // 此处需要获取所有以largeModelConfig:开头的key
  const keys = Object.keys(store.get())
  console.log(keys)
  const largeModelConfigList = keys.filter(key => key.startsWith('largeModelConfig:'))
  return largeModelConfigList.map(key => store.get(key))
})

// 删除大模型配置
ipcMain.handle('storage:deleteLargeModelConfig', async (_event, params: {
  modelName: string
}) => {
  store.delete(`largeModelConfig:${params.modelName}`)
  return true
})

