import { app } from 'electron'
import fs from 'fs-extra'
import * as path from 'path'
import { Buffer } from 'buffer'
import store from './store'

// 获取默认存储路径
export const getDefaultStoragePath = () => {
  return path.join(app.getPath('userData'))
}

export const formatLocalTime = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    (d.getMonth()+1).toString().padStart(2,'0'),
    d.getDate().toString().padStart(2,'0'),
    d.getHours().toString().padStart(2,'0'),
    d.getMinutes().toString().padStart(2,'0'),
    d.getSeconds().toString().padStart(2,'0')
  ].join('-')
}

// 格式化时间戳为更易读的格式
export const formatDisplayTime = (timestamp: string) => {
  // 将 YYYY-MM-DD-HH-MM-SS 格式转换为 YYYY-MM-DD HH:MM:SS
  const parts = timestamp.split('-')
  if (parts.length === 6) {
    const [year, month, day, hour, minute, second] = parts
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
  return timestamp
}

//  获取某个文件夹下所有文件的大小,需要遍历子文件夹
export const getFileSize = async (dirPath: string) => {
  const files = await fs.readdir(dirPath)
  let size = 0
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stats = await fs.stat(filePath)
    size += stats.size
    if (stats.isDirectory()) {
      size += await getFileSize(filePath)
    }
  }

  return size;
}

// 获取文件存储路径
export const getFileStoragePath = () => {
  const storagePath = store.get('storagePath')
  return storagePath ? path.join(storagePath, 'files') : path.join(getDefaultStoragePath(), 'files')
}

// 确保目录存在
export const ensureDir = async (dirPath: string) => {
  await fs.ensureDir(dirPath)
}

// 保存文件
export const importFile = async (params: {
  fileName: string
  filePath: string
}): Promise<string> => {
  const { fileName, filePath } = params
  const storagePath = store.get('storagePath')
  const destPath = storagePath ? path.join(storagePath,'files', fileName) : path.join(getDefaultStoragePath(), 'files', fileName)
  
  // 如果目录不存在，则创建目录
  await fs.ensureDir(path.dirname(destPath))
  
  try {
    // 检查目标文件是否已存在
    if (await fs.pathExists(destPath)) {
      try {
        // 比较源文件和目标文件的大小
        const sourceStats = await fs.stat(filePath)
        const destStats = await fs.stat(destPath)
        
        // 如果文件大小相同，认为文件内容相同，直接返回成功
        if (sourceStats.size === destStats.size) {
          console.log(`文件 ${fileName} 已存在且大小相同，跳过复制`)
          return destPath
        } else {
          // 文件大小不同，删除现有文件重新复制
          console.log(`文件 ${fileName} 已存在但大小不同，将重新复制`)
          await fs.remove(destPath)
        }
      } catch (error: any) {
        // 如果是 EBUSY 错误，说明目标文件被锁定，直接返回现有路径
        if (error.code === 'EBUSY' || error.message.includes('resource busy or locked')) {
          console.log(`文件 ${fileName} 已存在且被锁定，直接复用现有文件`)
          return destPath
        }
        throw error
      }
    }
    
    // 尝试复制文件
    await fs.copy(filePath, destPath)
  } catch (error: any) {
    // 如果是 EBUSY 错误，说明目标文件被锁定，直接返回现有路径
    if (error.code === 'EBUSY' || error.message.includes('resource busy or locked')) {
      console.log(`文件 ${fileName} 已存在且被锁定，直接复用现有文件`)
      return destPath
    }
    throw error
  }

  return destPath
}

// 流式保存文件（支持进度回调）
export const importFileWithProgress = async (params: {
  fileName: string
  filePath: string
  onProgress?: (progress: any) => void
  signal?: AbortSignal
}): Promise<string> => {
  const { fileName, filePath, onProgress, signal } = params
  const storagePath = store.get('storagePath')
  const destPath = storagePath ? path.join(storagePath,'files', fileName) : path.join(getDefaultStoragePath(), 'files', fileName)
  
  // 如果目录不存在，则创建目录
  await fs.ensureDir(path.dirname(destPath))
  
  try {
    // 检查目标文件是否已存在
    if (await fs.pathExists(destPath)) {
      try {
        // 比较源文件和目标文件的大小和修改时间
        const sourceStats = await fs.stat(filePath)
        const destStats = await fs.stat(destPath)
        
        // 如果文件大小相同，认为文件内容相同，直接返回成功
        if (sourceStats.size === destStats.size) {
          console.log(`文件 ${fileName} 已存在且大小相同，跳过复制`)
          
          // 发送100%进度回调
          if (onProgress) {
            onProgress({
              fileName,
              bytesCopied: sourceStats.size,
              totalBytes: sourceStats.size,
              percentage: 100,
              speed: 0,
              estimatedTimeRemaining: 0
            })
          }
          
          return destPath
        } else {
          // 文件大小不同，删除现有文件重新复制
          console.log(`文件 ${fileName} 已存在但大小不同，将重新复制`)
          await fs.remove(destPath)
        }
      } catch (error: any) {
        // 如果是 EBUSY 错误，说明目标文件被锁定，直接返回现有路径
        if (error.code === 'EBUSY' || error.message.includes('resource busy or locked')) {
          console.log(`文件 ${fileName} 已存在且被锁定，直接复用现有文件`)
          
          // 发送100%进度回调
          if (onProgress) {
            try {
              const destStats = await fs.stat(destPath)
              onProgress({
                fileName,
                bytesCopied: destStats.size,
                totalBytes: destStats.size,
                percentage: 100,
                speed: 0,
                estimatedTimeRemaining: 0
              })
            } catch (statError) {
              // 如果无法获取文件信息，发送默认进度
              onProgress({
                fileName,
                bytesCopied: 0,
                totalBytes: 0,
                percentage: 100,
                speed: 0,
                estimatedTimeRemaining: 0
              })
            }
          }
          
          return destPath
        }
        throw error
      }
    }
    
    // 使用流式复制
    const { streamCopyFile } = await import('./stream-file-copy')
    await streamCopyFile(filePath, destPath, {
      onProgress,
      signal
    })
    
  } catch (error: any) {
    // 如果是取消操作，重新抛出
    if (error.message === '文件复制已取消') {
      throw error
    }
    throw error
  }

  return destPath
}

// 保存 Base64 文件
export const saveBase64File = async (params: {
  fileName: string
  base64Data: string
}): Promise<string> => {
  const { fileName, base64Data } = params
  const storagePath = store.get('storagePath')
  const destPath = storagePath ? path.join(storagePath, 'files', fileName) : path.join(getDefaultStoragePath(), 'files', fileName)
  console.log(destPath, 'destPath')
  
  // 如果目录不存在，则创建目录
  await fs.ensureDir(path.dirname(destPath))
  
  try {
    // 将 Base64 转换为 Buffer 并写入文件
    const buffer = Buffer.from(base64Data, 'base64')
    await fs.writeFile(destPath, buffer)
  } catch (error: any) {
    // 如果是 EBUSY 错误，说明目标文件被锁定，直接返回现有路径
    if (error.code === 'EBUSY' || error.message.includes('resource busy or locked')) {
      console.log(`文件 ${fileName} 已存在且被锁定，直接复用现有文件`)
      return destPath
    }
    // 其他错误则继续抛出
    throw error
  }
  
  return destPath
}

// 获取文件信息
export const getFileInfo = async (filePath: string) => {
  try {
    const stats = await fs.stat(filePath)
    return {
      size: stats.size,
      createTime: stats.birthtime,
      updateTime: stats.mtime
    }
  } catch (error) {
    console.error('获取文件信息失败:', error)
    throw error
  }
} 