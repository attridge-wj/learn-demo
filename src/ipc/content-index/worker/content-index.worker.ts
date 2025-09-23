import { parentPort, workerData } from 'worker_threads'
import * as fs from 'fs-extra'
import * as path from 'path'
import { DocumentIndexUtilWorker } from './document-index-util-worker'

// Worker 消息类型
interface WorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'status' | 'file-processed'
  data: any
}

// 内容索引状态
interface ContentIndexStatus {
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

// 文件信息
interface FileInfo {
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  updateTime: Date
}

class ContentIndexWorker {
  private isIndexing = false
  private documentIndexUtil: DocumentIndexUtilWorker
  private indexStatus: ContentIndexStatus = {
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

  constructor() {
    this.documentIndexUtil = new DocumentIndexUtilWorker()
    
    try {
      this.setupMessageHandlers()
      this.sendMessage('status', { type: 'worker-ready', message: '内容索引 Worker 已准备就绪' })
    } catch (error) {
      this.sendMessage('error', { error: error instanceof Error ? error.message : String(error) })
    }
  }

  private setupMessageHandlers() {
    if (!parentPort) {
      return
    }

    parentPort.on('message', async (message) => {
      try {
        switch (message.type) {
          case 'start-content-index':
            const { dirPath, spaceId, cardId } = message
            await this.startContentIndex(dirPath, spaceId, cardId)
            break
          case 'stop-content-index':
            await this.stopContentIndex()
            break
          case 'get-status':
            this.sendMessage('status', this.indexStatus)
            break
        }
      } catch (error) {
        this.sendMessage('error', { error: error instanceof Error ? error.message : String(error) })
      }
    })
  }

  private sendMessage(type: string, data: any) {
    try {
      if (parentPort) {
        parentPort.postMessage({ type, data })
      }
    } catch (error) {
      // 忽略发送消息失败
    }
  }

  private async startContentIndex(dirPath: string, spaceId?: string, cardId?: string) {
    if (this.isIndexing) {
      this.sendMessage('error', { error: '内容索引已在进行中' })
      return
    }

    this.isIndexing = true
    this.resetIndexStatus()
    this.indexStatus.isIndexing = true
    this.indexStatus.currentDirectory = dirPath

    try {
      // 发送索引开始状态
      this.sendMessage('status', { 
        type: 'content-index-started', 
        message: `开始索引目录: ${dirPath}` 
      })

      // 获取所有支持的文件
      const allFiles = await this.getAllFiles(dirPath)
      const supportedFiles = allFiles.filter(file => this.(file))
      
      this.indexStatus.totalFiles = supportedFiles.length
      this.indexStatus.supportedFiles = supportedFiles.length
      
      // 发送文件统计信息
      this.sendMessage('status', {
        type: 'files-counted',
        totalFiles: supportedFiles.length,
        supportedFiles: supportedFiles.length
      })

      // 处理每个文件
      for (let i = 0; i < supportedFiles.length; i++) {
        if (!this.isIndexing) break

        const filePath = supportedFiles[i]
        const fileName = path.basename(filePath)
        
        this.indexStatus.currentFile = fileName
        this.indexStatus.processedFiles = i + 1
        this.indexStatus.percentage = Math.round(((i + 1) / supportedFiles.length) * 100)
        
        try {
          // 将绝对路径转换为原始协议路径
          const originalPath = this.convertToOriginalPath(filePath, dirPath)
          
          // 索引文件内容
          await this.documentIndexUtil.indexFile(originalPath, cardId, spaceId)
          
          this.indexStatus.indexedFiles++
          
          // 发送文件处理成功消息
          this.sendMessage('file-processed', {
            fileName,
            filePath: originalPath,
            success: true,
            processedFiles: this.indexStatus.processedFiles,
            totalFiles: this.indexStatus.totalFiles,
            percentage: this.indexStatus.percentage
          })
          
        } catch (error) {
          this.indexStatus.failedFiles++
          const errorMsg = error instanceof Error ? error.message : '未知错误'
          this.indexStatus.errors.push(`${fileName}: ${errorMsg}`)
          
          // 发送文件处理失败消息
          this.sendMessage('file-processed', {
            fileName,
            filePath: filePath,
            success: false,
            error: errorMsg,
            processedFiles: this.indexStatus.processedFiles,
            totalFiles: this.indexStatus.totalFiles,
            percentage: this.indexStatus.percentage
          })
        }

        // 发送进度更新
        this.sendMessage('progress', this.indexStatus)
        
        // 每处理完一个文件就让出控制权，避免长时间阻塞
        await new Promise(resolve => setImmediate(resolve))
      }

      this.sendMessage('complete', {
        totalFiles: this.indexStatus.totalFiles,
        indexedFiles: this.indexStatus.indexedFiles,
        failedFiles: this.indexStatus.failedFiles,
        errors: this.indexStatus.errors,
        directory: dirPath
      })
      
      // 发送索引完成状态
      this.sendMessage('status', { 
        type: 'content-index-complete', 
        message: `目录内容索引完成: ${dirPath}` 
      })
      
    } catch (error) {
      this.sendMessage('error', { error: error instanceof Error ? error.message : '未知错误' })
    } finally {
      this.isIndexing = false
      this.indexStatus.isIndexing = false
      this.sendMessage('status', this.indexStatus)
    }
  }

  private async stopContentIndex() {
    this.isIndexing = false
    this.indexStatus.isIndexing = false
    this.sendMessage('status', this.indexStatus)
  }

  private resetIndexStatus() {
    this.indexStatus = {
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

  private async getAllFiles(dirPath: string, maxDepth: number = 10, currentDepth: number = 0): Promise<string[]> {
    const files: string[] = []
    
    if (currentDepth >= maxDepth) {
      return files
    }
    
    try {
      const items = await fs.readdir(dirPath)
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        
        try {
          const stats = await fs.stat(fullPath)
          
          if (stats.isDirectory()) {
            // 递归处理子目录
            const subFiles = await this.getAllFiles(fullPath, maxDepth, currentDepth + 1)
            files.push(...subFiles)
          } else if (stats.isFile()) {
            files.push(fullPath)
          }
        } catch (error) {
          continue
        }
      }
    } catch (error) {
      // 忽略读取目录失败
    }
    
    return files
  }

  private isSupportedDocument(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    
    // 支持的内容索引文件类型
    const supportedExtensions = [
      // 文档格式
      '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
      // 代码文件
      '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.scss', '.less',
      '.java', '.py', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go',
      '.rs', '.swift', '.kt', '.scala', '.sql', '.sh', '.bat', '.ps1',
      // 配置文件
      '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.cfg', '.conf',
      // 其他文本格式
      '.log', '.gitignore', '.dockerfile', '.makefile', '.cmake'
    ]
    
    return supportedExtensions.includes(ext)
  }

  private convertToOriginalPath(absolutePath: string, originalDirPath: string): string {
    // 这里可以根据需要实现路径转换逻辑
    // 暂时直接返回绝对路径
    return absolutePath
  }
}

// 启动 Worker
new ContentIndexWorker()
