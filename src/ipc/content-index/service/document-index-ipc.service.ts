import { DocumentIndexUtil } from '../utils/document-index.util'
import { contentIndexWorkerService } from './content-index-worker.service'

const documentIndexUtil = new DocumentIndexUtil()

/**
 * 索引单个文件
 */
export async function indexFile(filePath: string, cardId?: string, spaceId?: string): Promise<void> {
  try {
    await documentIndexUtil.indexFile(filePath, cardId, spaceId)
  } catch (error) {
    console.error('索引文件失败:', error)
    throw error
  }
}

/**
 * 异步索引单个文件（直接调用同步版本）
 */
export async function indexFileAsync(filePath: string, cardId?: string, spaceId?: string, priority: number = 0): Promise<void> {
  try {
    // 简化实现，直接调用同步版本
    await documentIndexUtil.indexFile(filePath, cardId, spaceId)
  } catch (error) {
    console.error('异步索引文件失败:', error)
    throw error
  }
}

/**
 * 索引文件夹（使用 Worker 进程）
 */
export async function indexDirectory(dirPath: string, spaceId?: string): Promise<{ success: boolean; message: string }> {
  try {
    // 使用 Worker 进程进行内容索引
    const started = await contentIndexWorkerService.startContentIndex(dirPath, spaceId)
    
    if (started) {
      return {
        success: true,
        message: '文件夹内容索引已启动，正在后台处理中'
      }
    } else {
      return {
        success: false,
        message: '无法启动文件夹内容索引'
      }
    }
  } catch (error) {
    console.error('索引文件夹失败:', error)
    return {
      success: false,
      message: `索引失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

/**
 * 获取文件夹内容索引状态
 */
export async function getContentIndexStatus(): Promise<{
  isIndexing: boolean
  currentDirectory: string
  currentFile: string
  processedFiles: number
  totalFiles: number
  percentage: number
  supportedFiles: number
  indexedFiles: number
  failedFiles: number
  errors: string[]
  workerStatus: {
    isWorkerReady: boolean
    hasWorker: boolean
  }
}> {
  try {
    const currentStatus = contentIndexWorkerService.getCurrentStatus()
    const workerStatus = contentIndexWorkerService.getWorkerStatus()
    
    return {
      ...currentStatus,
      workerStatus
    }
  } catch (error) {
    console.error('获取文件夹内容索引状态失败:', error)
    throw error
  }
}

/**
 * 停止文件夹内容索引
 */
export async function stopContentIndex(): Promise<{ success: boolean; message: string }> {
  try {
    const stopped = await contentIndexWorkerService.stopContentIndex()
    
    if (stopped) {
      return {
        success: true,
        message: '文件夹内容索引已停止'
      }
    } else {
      return {
        success: false,
        message: '无法停止文件夹内容索引'
      }
    }
  } catch (error) {
    console.error('停止文件夹内容索引失败:', error)
    return {
      success: false,
      message: `停止失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

 