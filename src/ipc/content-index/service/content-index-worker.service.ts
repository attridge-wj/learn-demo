import { Worker } from 'worker_threads'
import * as path from 'path'

// 内容索引状态
export interface ContentIndexStatus {
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
}

// Worker 消息类型
interface WorkerMessage {
  type: string
  data: any
}

export class ContentIndexWorkerService {
  private worker: Worker | null = null
  private isWorkerReady = false
  private currentStatus: ContentIndexStatus = {
    isIndexing: false,
    currentDirectory: '',
    currentFile: '',
    processedFiles: 0,
    totalFiles: 0,
    percentage: 0,
    supportedFiles: 0,
    indexedFiles: 0,
    failedFiles: 0,
    errors: []
  }
  private messageHandlers: Map<string, (data: any) => void> = new Map()

  constructor() {
    this.setupMessageHandlers()
  }

  /**
   * 启动内容索引 Worker
   */
  async startWorker(): Promise<boolean> {
    try {
      if (this.worker) {
        console.log('内容索引 Worker 已存在，先停止...')
        await this.stopWorker()
      }

      console.log('🚀 启动内容索引 Worker...')
      
      // 创建 Worker 进程
      let workerPath: string
      
      if (process.env.NODE_ENV === 'development') {
        // 开发环境：使用相对路径
        workerPath = path.join(__dirname, '../worker/content-index.worker.js')
      } else {
        // 生产环境：使用 app.asar.unpacked 路径
        const { app } = require('electron')
        const isPackaged = app.isPackaged
        
        if (isPackaged) {
          // 打包后：使用 app.asar.unpacked 路径
          const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'worker', 'content-index.worker.js')
          workerPath = unpackedPath
        } else {
          // 开发环境但使用打包的渲染进程
          workerPath = path.join(__dirname, '../worker/content-index.worker.js')
        }
      }
      
      this.worker = new Worker(workerPath, {
        workerData: {},
        stdio: 'pipe'
      })

      // 设置消息处理器
      this.worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(message)
      })

      this.worker.on('error', (error) => {
        console.error('❌ 内容索引 Worker 错误:', error)
        this.isWorkerReady = false
        this.currentStatus.isIndexing = false
      })

      this.worker.on('exit', (code) => {
        console.log(`内容索引 Worker 退出，退出码: ${code}`)
        this.isWorkerReady = false
        this.currentStatus.isIndexing = false
        this.worker = null
      })

      // 等待 Worker 准备就绪
      await this.waitForWorkerReady()
      
      console.log('✅ 内容索引 Worker 启动成功')
      return true
    } catch (error) {
      console.error('❌ 启动内容索引 Worker 失败:', error)
      return false
    }
  }

  /**
   * 停止内容索引 Worker
   */
  async stopWorker(): Promise<void> {
    if (this.worker) {
      try {
        console.log('⏹️ 停止内容索引 Worker...')
        await this.worker.terminate()
        this.worker = null
        this.isWorkerReady = false
        this.currentStatus.isIndexing = false
        console.log('✅ 内容索引 Worker 已停止')
      } catch (error) {
        console.error('❌ 停止内容索引 Worker 失败:', error)
      }
    }
  }

  /**
   * 等待 Worker 准备就绪
   */
  private async waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('等待 Worker 准备就绪超时'))
      }, 10000) // 10秒超时

      const checkReady = () => {
        if (this.isWorkerReady) {
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }

      checkReady()
    })
  }

  /**
   * 开始内容索引
   */
  async startContentIndex(dirPath: string, spaceId?: string, cardId?: string): Promise<boolean> {
    try {
      if (!this.worker || !this.isWorkerReady) {
        console.log('内容索引 Worker 未启动，正在启动...')
        const started = await this.startWorker()
        if (!started) {
          throw new Error('无法启动内容索引 Worker')
        }
      }

      if (this.currentStatus.isIndexing) {
        throw new Error('内容索引已在进行中')
      }

      console.log(`🚀 开始内容索引: ${dirPath}`)
      
      // 重置状态
      this.resetStatus()
      this.currentStatus.isIndexing = true
      this.currentStatus.currentDirectory = dirPath

      // 发送开始索引消息给 Worker
      this.worker!.postMessage({
        type: 'start-content-index',
        dirPath,
        spaceId,
        cardId
      })

      return true
    } catch (error) {
      console.error('❌ 开始内容索引失败:', error)
      this.currentStatus.isIndexing = false
      return false
    }
  }

  /**
   * 停止内容索引
   */
  async stopContentIndex(): Promise<boolean> {
    try {
      if (!this.worker || !this.isWorkerReady) {
        return false
      }

      console.log('⏹️ 停止内容索引...')
      
      // 发送停止索引消息给 Worker
      this.worker.postMessage({
        type: 'stop-content-index'
      })

      this.currentStatus.isIndexing = false
      return true
    } catch (error) {
      console.error('❌ 停止内容索引失败:', error)
      return false
    }
  }

  /**
   * 获取当前索引状态
   */
  getCurrentStatus(): ContentIndexStatus {
    return { ...this.currentStatus }
  }

  /**
   * 获取 Worker 状态
   */
  getWorkerStatus(): { isWorkerReady: boolean; hasWorker: boolean } {
    return {
      isWorkerReady: this.isWorkerReady,
      hasWorker: !!this.worker
    }
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers() {
    // 处理 Worker 准备就绪消息
    this.messageHandlers.set('worker-ready', (data) => {
      console.log('✅ 内容索引 Worker 准备就绪:', data.message)
      this.isWorkerReady = true
    })

    // 处理索引开始消息
    this.messageHandlers.set('content-index-started', (data) => {
      console.log('🚀 内容索引开始:', data.message)
      this.currentStatus.isIndexing = true
    })

    // 处理文件计数消息
    this.messageHandlers.set('files-counted', (data) => {
      console.log(`📊 文件统计: 总文件数 ${data.totalFiles}, 支持索引 ${data.supportedFiles}`)
      this.currentStatus.totalFiles = data.totalFiles
      this.currentStatus.supportedFiles = data.supportedFiles
    })

    // 处理进度更新消息
    this.messageHandlers.set('progress', (data) => {
      this.currentStatus = { ...this.currentStatus, ...data }
      console.log(`📊 内容索引进度: ${data.percentage}% (${data.processedFiles}/${data.totalFiles})`)
    })

    // 处理文件处理消息
    this.messageHandlers.set('file-processed', (data) => {
      if (data.success) {
        this.currentStatus.indexedFiles = data.processedFiles
        console.log(`✅ 文件索引成功: ${data.fileName}`)
      } else {
        this.currentStatus.failedFiles++
        this.currentStatus.errors.push(`${data.fileName}: ${data.error}`)
        console.log(`❌ 文件索引失败: ${data.fileName}: ${data.error}`)
      }
    })

    // 处理索引完成消息
    this.messageHandlers.set('content-index-complete', (data) => {
      console.log('🎯 内容索引完成:', data)
      this.currentStatus.isIndexing = false
      this.currentStatus.processedFiles = data.totalFiles
      this.currentStatus.percentage = 100
    })

    // 处理状态消息
    this.messageHandlers.set('status', (data) => {
      if (data.type === 'worker-ready') {
        this.isWorkerReady = true
      } else if (data.type === 'content-index-started') {
        this.currentStatus.isIndexing = true
      } else if (data.type === 'content-index-complete') {
        this.currentStatus.isIndexing = false
      }
    })

    // 处理错误消息
    this.messageHandlers.set('error', (data) => {
      console.error('❌ 内容索引 Worker 错误:', data.error)
      this.currentStatus.isIndexing = false
      this.currentStatus.errors.push(data.error)
    })
  }

  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(message: WorkerMessage) {
    const handler = this.messageHandlers.get(message.type)
    if (handler) {
      handler(message.data)
    } else {
      console.log(`📨 未处理的消息类型: ${message.type}`, message.data)
    }
  }

  /**
   * 重置状态
   */
  private resetStatus() {
    this.currentStatus = {
      isIndexing: false,
      currentDirectory: '',
      currentFile: '',
      processedFiles: 0,
      totalFiles: 0,
      percentage: 0,
      supportedFiles: 0,
      indexedFiles: 0,
      failedFiles: 0,
      errors: []
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.stopWorker()
  }
}

// 创建单例实例
export const contentIndexWorkerService = new ContentIndexWorkerService()
