import * as fs from 'fs-extra'
import * as path from 'path'

export interface CopyProgress {
  fileName: string
  bytesCopied: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
}

export interface CopyOptions {
  chunkSize?: number // 每次复制的块大小，默认 64KB
  onProgress?: (progress: CopyProgress) => void
  signal?: AbortSignal // 用于取消操作
}

/**
 * 流式复制文件，支持进度回调和取消操作
 */
export async function streamCopyFile(
  sourcePath: string,
  destPath: string,
  options: CopyOptions = {}
): Promise<void> {
  const { chunkSize = 64 * 1024, onProgress, signal } = options
  
  // 检查源文件是否存在
  if (!await fs.pathExists(sourcePath)) {
    throw new Error(`源文件不存在: ${sourcePath}`)
  }
  
  // 获取文件大小
  const stats = await fs.stat(sourcePath)
  const totalBytes = stats.size
  
  // 确保目标目录存在
  await fs.ensureDir(path.dirname(destPath))
  
  // 如果目标文件已存在，先删除
  if (await fs.pathExists(destPath)) {
    await fs.remove(destPath)
  }
  
  let bytesCopied = 0
  let startTime = Date.now()
  let lastProgressTime = startTime
  
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath, { highWaterMark: chunkSize })
    const writeStream = fs.createWriteStream(destPath)
    
    // 处理取消信号
    if (signal) {
      signal.addEventListener('abort', () => {
        readStream.destroy()
        writeStream.destroy()
        fs.remove(destPath).catch(() => {}) // 清理部分复制的文件
        reject(new Error('文件复制已取消'))
      })
    }
    
    readStream.on('data', (chunk: Buffer) => {
      // 检查是否被取消
      if (signal?.aborted) {
        return
      }
      
      bytesCopied += chunk.length
      
      // 计算进度信息
      const currentTime = Date.now()
      const timeElapsed = (currentTime - startTime) / 1000
      const speed = bytesCopied / timeElapsed
      const percentage = (bytesCopied / totalBytes) * 100
      const estimatedTimeRemaining = (totalBytes - bytesCopied) / speed
      
      // 限制进度回调频率（最多每100ms调用一次）
      if (currentTime - lastProgressTime >= 100) {
        onProgress?.({
          fileName: path.basename(sourcePath),
          bytesCopied,
          totalBytes,
          percentage: Math.min(percentage, 100),
          speed: isFinite(speed) ? speed : 0,
          estimatedTimeRemaining: isFinite(estimatedTimeRemaining) ? estimatedTimeRemaining : 0
        })
        lastProgressTime = currentTime
      }
    })
    
    readStream.on('error', (error) => {
      writeStream.destroy()
      reject(error)
    })
    
    writeStream.on('error', (error) => {
      readStream.destroy()
      reject(error)
    })
    
    writeStream.on('finish', () => {
      // 发送最终进度
      onProgress?.({
        fileName: path.basename(sourcePath),
        bytesCopied: totalBytes,
        totalBytes,
        percentage: 100,
        speed: 0,
        estimatedTimeRemaining: 0
      })
      resolve()
    })
    
    // 开始复制
    readStream.pipe(writeStream)
  })
}

/**
 * 格式化字节大小为可读格式
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化时间为可读格式
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}分${remainingSeconds}秒`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}小时${minutes}分钟`
  }
}
