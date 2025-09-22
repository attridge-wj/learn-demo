import { Worker } from 'worker_threads'
import path from 'path'
import { AppDataSource } from '../../../database/connection'
import { FileIndexEntity } from '../entities/file-index.entity'
import type { FileIndexProgressDto } from '../dto/file-index.dto'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'

// Worker 消息类型
interface WorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'status' | 'files-batch' | 'directory-scan' | 'file-found'
  data: any
}

// 文件信息接口
interface FileInfo {
  fileName: string
  fileNameSegmented?: string
  filePath: string
  fileSize: number
  fileType: string
  createTime: Date
  updateTime: Date
}

/**
 * 文件索引 Worker 服务
 * 负责管理后台 Worker 进程和数据库插入
 */
export class FileIndexWorkerService {
  private static worker: Worker | null = null
  private static isIndexing = false
  private static isPaused = false // 新增：暂停状态
  private static progress: FileIndexProgressDto = {
    current: 0,
    total: 0,
    currentFile: '',
    isComplete: false
  }
  private static insertedCount = 0
  private static totalFiles = 0

  /**
   * 启动文件索引
   */
  static async startIndexing(forceFullScan: boolean = false): Promise<void> {
    if (this.isIndexing) {
      throw new Error('文件索引已在进行中')
    }

    try {
      this.isIndexing = true
      console.log('🚀 启动文件索引...')
      
      // 等待数据库准备就绪
      await this.waitForDatabaseReady()
      
      // 获取索引状态
      const indexStatus = await this.getIndexStatus()
      console.log('📊 当前索引状态:', indexStatus)
      
      let scanMode: 'full' | 'incremental' = 'incremental'
      
      if (forceFullScan) {
        console.log('🔄 用户强制全量扫描')
        scanMode = 'full'
        await this.clearIndex()
      } else if (indexStatus.totalFiles === 0) {
        console.log('🆕 首次索引或表为空，执行全量扫描')
        scanMode = 'full'
      } else if (indexStatus.isHealthy && indexStatus.lastIndexTime) {
        console.log('⚡ 执行增量扫描（只处理变化的文件）')
        console.log(`   - 上次索引时间: ${indexStatus.lastIndexTime}`)
        scanMode = 'incremental'
      } else {
        console.log('⚠️ 索引状态异常，执行全量扫描')
        console.log(`   - 总文件数: ${indexStatus.totalFiles}`)
        console.log(`   - 最后索引时间: ${indexStatus.lastIndexTime || '无'}`)
        console.log(`   - 状态健康: ${indexStatus.isHealthy}`)
        scanMode = 'full'
        await this.clearIndex()
      }

      console.log(`🎯 最终选择的扫描模式: ${scanMode}`)
      
      // 创建并启动 Worker
      console.log('🔧 创建 Worker...')
      await this.createWorker()
      
      console.log(`🚀 启动 Worker ${scanMode === 'full' ? '全量' : '增量'}扫描...`)
      this.worker!.postMessage({ 
        type: 'start-scan',
        scanMode,
        lastIndexTime: scanMode === 'incremental' ? indexStatus.lastIndexTime : null
      })
      console.log(`✅ Worker 已启动，开始后台${scanMode === 'full' ? '全量' : '增量'}文件索引...`)
      
    } catch (error) {
      this.isIndexing = false
      console.error('❌ 启动文件索引失败:', error)
      throw error
    }
  }

  /**
   * 获取索引状态
   */
  private static async getIndexStatus(): Promise<{
    totalFiles: number
    lastIndexTime: string | null
    isHealthy: boolean
  }> {
    try {
      // 获取总文件数
      const totalResult = await AppDataSource.query('SELECT COUNT(*) as count FROM file_index')
      const totalFiles = Number(totalResult?.[0]?.count ?? 0)

      // 获取最后索引时间
      const lastIndexResult = await AppDataSource.query(`
        SELECT MAX(index_time) as last_index_time FROM file_index
      `)
      const lastIndexTime = lastIndexResult?.[0]?.last_index_time || null

      // 调试信息
      console.log(`📊 索引状态检查:`)
      console.log(`  - 总文件数: ${totalFiles}`)
      console.log(`  - 最后索引时间: ${lastIndexTime || '无'}`)
      
      // 如果 lastIndexTime 是字符串 'null' 或 'undefined'，转换为 null
      let normalizedLastIndexTime = lastIndexTime
      if (typeof lastIndexTime === 'string' && (lastIndexTime === 'null' || lastIndexTime === 'undefined')) {
        normalizedLastIndexTime = null
        console.log(`🔄 检测到无效的 lastIndexTime 字符串，转换为 null`)
      }

      // 简单的健康检查：如果有文件但没有索引时间，认为不健康
      const isHealthy = totalFiles === 0 || normalizedLastIndexTime !== null

      console.log(`  - 标准化后的最后索引时间: ${normalizedLastIndexTime || '无'}`)
      console.log(`  - 索引状态健康: ${isHealthy}`)

      return {
        totalFiles,
        lastIndexTime: normalizedLastIndexTime,
        isHealthy
      }
    } catch (error) {
      console.error('❌ 获取索引状态失败:', error)
      return {
        totalFiles: 0,
        lastIndexTime: null,
        isHealthy: false
      }
    }
  }

  /**
   * 等待数据库准备就绪
   */
  private static async waitForDatabaseReady(): Promise<void> {
    const maxWaitTime = 30000 // 最多等待 30 秒
    const checkInterval = 500 // 每 500ms 检查一次
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 检查数据库连接
        if (!AppDataSource.isInitialized) {
          console.log('⏳ 等待数据库连接初始化...')
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          continue
        }
        
        // 检查 file_index 表是否存在
        const tableCheck = await AppDataSource.query(`
          SELECT COUNT(*) as count FROM sqlite_master 
          WHERE type='table' AND name='file_index'
        `)
        
        if (Number(tableCheck?.[0]?.count ?? 0) === 0) {
          console.log('⏳ 等待 file_index 表创建...')
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          continue
        }
        
        // 尝试执行一个简单查询来确保表可用
        await AppDataSource.query('SELECT COUNT(*) FROM file_index')
        console.log('✅ 数据库和表都已准备就绪')
        return
        
      } catch (error) {
        console.log('⏳ 数据库尚未完全准备好，继续等待...', (error as Error).message)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
    }
    
    throw new Error('等待数据库准备就绪超时')
  }

  /**
   * 停止文件索引
   */
  static async stopIndexing(): Promise<void> {
    if (!this.isIndexing) {
      return
    }

    try {
      console.log('⏹️ 发送停止扫描命令给 Worker...')
      this.worker?.postMessage({ type: 'stop-scan' })
      await this.terminateWorker()
      this.isIndexing = false
      console.log('✅ 文件索引已停止')
    } catch (error) {
      console.error('❌ 停止文件索引失败:', error)
      throw error
    }
  }

  /**
   * 获取索引进度
   */
  static getProgress(): FileIndexProgressDto {
    return { ...this.progress }
  }

  /**
   * 检查是否正在索引
   */
  static isIndexingInProgress(): boolean {
    return this.isIndexing
  }

  /**
   * 创建 Worker 进程
   */
  private static async createWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 确定 Worker 文件路径（构建后的 JS 文件）
        let workerPath: string
        
        if (process.env.NODE_ENV === 'development') {
          // 开发环境：使用相对路径
          workerPath = path.join(__dirname, 'worker/file-index.worker.js')
        } else {
          // 生产环境：使用 app.asar.unpacked 路径
          const { app } = require('electron')
          const isPackaged = app.isPackaged
          
          if (isPackaged) {
            // 打包后：使用 app.asar.unpacked 路径
            const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'worker', 'file-index.worker.js')
            workerPath = unpackedPath
          } else {
            // 开发环境但使用打包的渲染进程
            workerPath = path.join(__dirname, 'worker/file-index.worker.js')
          }
        }
        
        console.log('🔍 Worker 路径:', workerPath)
        console.log('🔍 当前 __dirname:', __dirname)
        console.log('🔍 环境:', process.env.NODE_ENV)
        console.log('🔍 是否打包:', require('electron').app.isPackaged)

        // 检查文件是否存在
        const fs = require('fs')
        if (!fs.existsSync(workerPath)) {
          console.error(`❌ Worker 文件不存在: ${workerPath}`)
          console.log('📁 当前目录:', __dirname)
          console.log('📁 尝试列出目录内容:')
          try {
            const parentDir = path.dirname(workerPath)
            console.log('📁 父目录:', parentDir)
            if (fs.existsSync(parentDir)) {
              const files = fs.readdirSync(parentDir)
              console.log('📄 目录文件:', files)
            } else {
              console.log('❌ 父目录不存在')
            }
          } catch (listError) {
            console.error('❌ 无法列出目录:', listError)
          }
          throw new Error(`Worker 文件不存在: ${workerPath}`)
        }

        console.log('🔧 创建 Worker 实例...')
        this.worker = new Worker(workerPath, {
          workerData: { type: 'file-index-worker' }
        })

        let workerReady = false
        let hasError = false

        console.log('📡 设置 Worker 消息处理器...')
        // 设置消息处理器
        this.worker.on('message', async (message: WorkerMessage) => {
          console.log('📨 收到 Worker 消息:', message.type)
          
          // 检查 Worker 是否准备就绪
          if (message.type === 'status' && message.data.type === 'worker-ready') {
            console.log('✅ Worker 已准备就绪')
            workerReady = true
            resolve()
            return
          }
          
          await this.handleWorkerMessage(message)
        })

        // 设置错误处理器
        this.worker.on('error', (error) => {
          console.error('❌ Worker 错误:', error)
          this.isIndexing = false
          hasError = true
          reject(error)
        })

        // 设置退出处理器
        this.worker.on('exit', (code) => {
          console.log(`🔄 Worker 退出，代码: ${code}`)
          this.isIndexing = false
          this.progress.isComplete = true
          
          if (!workerReady && !hasError) {
            console.error('❌ Worker 异常退出')
            reject(new Error(`Worker 异常退出，代码: ${code}`))
          }
        })

        // 设置超时，如果 Worker 没有在 10 秒内准备就绪，则失败
        const timeout = setTimeout(() => {
          if (!workerReady && !hasError) {
            console.error('⏰ Worker 启动超时 (10秒)')
            console.log('🔍 Worker 状态检查:')
            console.log('  - workerReady:', workerReady)
            console.log('  - hasError:', hasError)
            console.log('  - worker threadId:', this.worker?.threadId)
            this.worker?.terminate()
            reject(new Error('Worker 启动超时'))
          }
        }, 10000)

        // 成功或失败后清除超时
        const originalResolve = resolve
        const originalReject = reject
        
        resolve = (...args) => {
          clearTimeout(timeout)
          originalResolve(...args)
        }
        
        reject = (...args) => {
          clearTimeout(timeout)
          originalReject(...args)
        }

      } catch (error) {
        console.error('❌ 创建 Worker 失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 处理 Worker 消息
   */
  private static async handleWorkerMessage(message: WorkerMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'status':
          // 处理状态消息
          if (message.data.type === 'worker-ready') {
            console.log('✅ Worker 已准备就绪，可以开始索引')
          } else if (message.data.type === 'scan-started') {
            console.log('🚀 Worker 开始扫描文件系统')
          } else if (message.data.type === 'scan-complete') {
            console.log('✅ Worker 扫描完成')
          } else {
            console.log('📊 Worker 状态:', message.data)
          }
          break

        case 'progress':
          // 更新进度信息
          this.progress = {
            current: message.data.processedFiles || 0,
            total: message.data.totalFiles || 0,
            currentFile: message.data.currentFile || '',
            isComplete: false,
            currentDirectory: message.data.currentDirectory || ''
          }
          
          // 大幅减少进度日志输出，每 5000 个文件才输出一次
          const percentage = this.progress.total > 0 ? Math.round((this.progress.current / this.progress.total) * 100) : 0
          if (this.progress.current % 5000 === 0 || this.progress.current === this.progress.total) {
            console.log(`📊 索引进度: ${this.progress.current}/${this.progress.total} (${percentage}%) - 当前: ${this.progress.currentFile}`)
            console.log(`📁 正在扫描目录: ${this.progress.currentDirectory}`)
            console.log(`💾 已插入数据库: ${this.insertedCount} 个文件`)
          }
          break

        case 'files-batch':
          // 处理文件批次 - 实时插入数据库
          if (message.data.files && Array.isArray(message.data.files)) {
            const startTime = Date.now()
            const insertedCount = await this.insertFilesBatch(message.data.files)
            const endTime = Date.now()
            
            this.insertedCount += insertedCount
            
            // 大幅减少插入日志输出，每 50 个批次才输出一次
            if (this.insertedCount % 2500 === 0 || this.insertedCount < 100) {
              console.log(`💾 实时插入 ${insertedCount}/${message.data.files.length} 个文件 (耗时: ${endTime - startTime}ms)`)
              console.log(`📈 累计已索引: ${this.insertedCount} 个文件`)
            }
          }
          break

        case 'complete':
          this.totalFiles = message.data.totalFiles
          this.progress.isComplete = true
          this.isIndexing = false
          console.log('✅ 文件索引完成')
          console.log(`📊 最终统计: 共扫描 ${this.progress.total} 个文件，成功索引 ${this.insertedCount} 个文件`)
          await this.terminateWorker()
          break

        case 'error':
          console.error('❌ Worker 错误:', message.data.error)
          this.isIndexing = false
          await this.terminateWorker()
          break

        case 'directory-scan':
          // 目录扫描日志
          console.log(`📁 扫描目录: ${message.data.directory}`)
          break

        case 'file-found':
          // 文件发现日志（可选，避免日志过多）
          if (this.insertedCount % 100 === 0) {
            console.log(`🔍 发现文件: ${message.data.fileName} (${message.data.fileType})`)
          }
          break

        default:
          console.log('⚠️ 收到未知消息类型:', message.type, message.data)
      }
    } catch (error) {
      console.error('❌ 处理 Worker 消息失败:', error)
    }
  }

  /**
   * 批量插入文件到数据库
   */
  private static async insertFilesBatch(files: FileInfo[]): Promise<number> {
    if (!files || files.length === 0) return 0

    try {
      // 过滤掉不支持的文件类型，只索引有意义的文件
      const supportedFiles = files.filter(file => 
        file.fileType !== 'unknown' && file.fileType !== 'executable'
      )
      
      if (supportedFiles.length === 0) {
        console.log('📄 当前批次无支持的文件类型，跳过插入')
        return 0
      }

      // 使用原生 SQL 批量插入，提高性能
      const batchSize = 50 // 从 200 减少到 50，减少内存占用和 CPU 使用
      const startTime = Date.now()
      
      for (let i = 0; i < supportedFiles.length; i += batchSize) {
        const batch = supportedFiles.slice(i, i + batchSize)
        await this.insertBatchWithSQL(batch)
        
        // 优化：增加延迟，让出更多控制权，减少对主应用的影响
        // 每插入一个批次后让出控制权
        await new Promise(resolve => setTimeout(resolve, 50)) // 50ms 延迟
        
        // 每插入 2 个批次后，让出更多控制权
        if ((i / batchSize) % 2 === 0 && i > 0) {
          console.log(`⏸️ 主进程: 让出控制权，减少对主应用的影响...`)
          await new Promise(resolve => setTimeout(resolve, 200)) // 额外 200ms 延迟
        }
      }

      const endTime = Date.now()
      console.log(`💾 批量插入完成: ${supportedFiles.length}/${files.length} 个文件 (耗时: ${endTime - startTime}ms)`)
      
      // 统计文件类型分布
      const typeStats = supportedFiles.reduce((acc, file) => {
        acc[file.fileType] = (acc[file.fileType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log('📊 文件类型分布:', typeStats)
      
      return supportedFiles.length
      
    } catch (error) {
      console.error('❌ 批量插入文件失败:', error)
      throw error
    }
  }

  /**
   * 批量插入文件到数据库（带去重逻辑）
   */
  private static async insertBatchWithSQL(files: FileInfo[]): Promise<void> {
    if (files.length === 0) return

    try {
      // 在插入前为每个文件生成分词
      const filesWithSegmentation = files.map(file => {
        // 生成文件名分词
        const keywords = ChineseSegmentUtil.extractKeywords(file.fileName)
        let fileNameSegmented = keywords.join(' ')
        
        // 如果分词结果为空，使用备用方案
        if (keywords.length === 0) {
          // 对于英文文件名，至少保留原始文件名
          fileNameSegmented = file.fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ').trim()
        }
        
        // 强制确保 fileNameSegmented 不为空
        if (!fileNameSegmented || fileNameSegmented.trim() === '') {
          fileNameSegmented = file.fileName
        }
        
        return {
          ...file,
          fileNameSegmented
        }
      })
      
      // 使用 INSERT OR REPLACE 实现去重插入
      // 基于 file_path 作为唯一标识符
      const values = filesWithSegmentation.map(file => [
        file.fileName,
        file.fileNameSegmented,
        file.filePath,
        file.fileSize,
        file.fileType,
        file.createTime.toISOString(),
        file.updateTime.toISOString()
      ])

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',')
      const sql = `
        INSERT OR REPLACE INTO file_index (file_name, file_name_segmented, file_path, file_size, file_type, create_time, update_time)
        VALUES ${placeholders}
      `

      // 扁平化参数数组
      const params = values.flat()

      // 执行批量插入或替换
      await AppDataSource.query(sql, params)
      
      console.log(`💾 批量插入/替换完成: ${files.length} 个文件`)
    } catch (error) {
      console.error('SQL 批量插入失败:', error)
      throw error
    }
  }

  /**
   * 清空文件索引
   */
  private static async clearIndex(): Promise<void> {
    try {
      console.log('🗑️ 开始清空文件索引...')
      const startTime = Date.now()
      
      // 首先检查数据库连接是否正常
      if (!AppDataSource.isInitialized) {
        console.log('⚠️ 数据库未初始化，等待初始化完成...')
        // 等待最多 10 秒
        for (let i = 0; i < 100; i++) {
          if (AppDataSource.isInitialized) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        if (!AppDataSource.isInitialized) {
          throw new Error('数据库初始化超时')
        }
      }
      
      // 检查 file_index 表是否存在
      console.log('🔍 检查 file_index 表是否存在...')
      const tableExists = await AppDataSource.query(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='file_index'
      `)
      
      const exists = Number(tableExists?.[0]?.count ?? 0) > 0
      console.log('📊 file_index 表存在:', exists)
      
      if (!exists) {
        console.log('⚠️ file_index 表不存在，跳过清空操作，等待表创建...')
        // 等待表创建，最多等待 5 秒
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
          const checkExists = await AppDataSource.query(`
            SELECT COUNT(*) as count FROM sqlite_master 
            WHERE type='table' AND name='file_index'
          `)
          if (Number(checkExists?.[0]?.count ?? 0) > 0) {
            console.log('✅ file_index 表已创建')
            break
          }
        }
      }
      
      // 再次检查表是否存在
      const finalCheck = await AppDataSource.query(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='file_index'
      `)
      
      if (Number(finalCheck?.[0]?.count ?? 0) === 0) {
        console.log('⚠️ file_index 表仍不存在，创建空表以继续流程')
        return
      }
      
      // 检查表中是否有数据
      const countResult = await AppDataSource.query('SELECT COUNT(*) as count FROM file_index')
      const recordCount = Number(countResult?.[0]?.count ?? 0)
      console.log('📊 file_index 表当前记录数:', recordCount)
      
      if (recordCount === 0) {
        console.log('✅ file_index 表已为空，跳过清空操作')
        return
      }
      
      // 使用最简单和最快的清空策略
      console.log('🗑️ 执行快速清空操作...')
      
      // 方案1：先尝试简单的 PRAGMA 优化
      try {
        // 暂时禁用外键约束和触发器
        await AppDataSource.query('PRAGMA foreign_keys = OFF')
        await AppDataSource.query('PRAGMA triggers = OFF')
        
        // 先清空 FTS 表（如果存在）
        try {
          await AppDataSource.query('DELETE FROM file_index_fts')
                  console.log('✅ 已清空 FTS 表')
      } catch (ftsError) {
        console.log('⚠️ 清空 FTS 表失败（可能不存在）:', (ftsError as Error).message)
      }
        
        // 清空主表
        await AppDataSource.query('DELETE FROM file_index')
        console.log('✅ 已清空主表')
        
        // 重置自增ID
        await AppDataSource.query('DELETE FROM sqlite_sequence WHERE name="file_index"')
        console.log('✅ 已重置自增ID')
        
        // 恢复设置
        await AppDataSource.query('PRAGMA triggers = ON')
        await AppDataSource.query('PRAGMA foreign_keys = ON')
        
        console.log('✅ 快速清空完成')
        
      } catch (pragmaError) {
        console.log('⚠️ PRAGMA 方式失败，尝试备选方案:', (pragmaError as Error).message)
        
        // 备选方案：直接删除并重新创建表
        try {
          console.log('🔄 尝试重新创建表...')
          
          // 获取表结构
          const tableSchema = await AppDataSource.query(`
            SELECT sql FROM sqlite_master WHERE type='table' AND name='file_index'
          `)
          
          if (tableSchema && tableSchema[0] && tableSchema[0].sql) {
            // 删除旧表
            await AppDataSource.query('DROP TABLE IF EXISTS file_index')
            
            // 重新创建表
            await AppDataSource.query(tableSchema[0].sql)
            
            console.log('✅ 表重新创建完成')
          } else {
            throw new Error('无法获取表结构')
          }
          
        } catch (recreateError) {
          console.error('❌ 重新创建表失败:', (recreateError as Error).message)
          throw recreateError
        }
      }
      
      const endTime = Date.now()
      console.log(`✅ 文件索引已清空 (耗时: ${endTime - startTime}ms)`)
      
    } catch (error) {
      console.error('❌ 清空文件索引失败:', error)
      console.error('错误详情:', (error as Error).message)
      console.error('错误堆栈:', (error as Error).stack)
      
      // 如果是数据库锁定错误，尝试等待后重试一次
      if ((error as Error).message && (error as Error).message.includes('database is locked')) {
        console.log('🔄 检测到数据库锁定，等待 2 秒后重试...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        try {
          await AppDataSource.query('DELETE FROM file_index')
          console.log('✅ 重试清空成功')
          return
        } catch (retryError) {
          console.error('❌ 重试清空也失败:', retryError)
        }
      }
      
      throw error
    }
  }

  /**
   * 终止 Worker 进程
   */
  private static async terminateWorker(): Promise<void> {
    if (this.worker) {
      try {
        console.log('🔄 正在终止 Worker...')
        await this.worker.terminate()
        this.worker = null
        console.log('✅ Worker 已终止')
      } catch (error) {
        console.error('❌ 终止 Worker 失败:', error)
      }
    }
  }



  /**
   * 检查 Worker 是否正常运行
   */
  static isWorkerRunning(): boolean {
    return this.worker !== null && this.worker.threadId !== undefined
  }

  /**
   * 获取 Worker 状态信息
   */
  static getWorkerStatus(): {
    isRunning: boolean
    isIndexing: boolean
    workerId: number | null
    progress: FileIndexProgressDto
    insertedCount: number
  } {
    return {
      isRunning: this.worker !== null,
      isIndexing: this.isIndexing,
      workerId: this.worker?.threadId || null,
      progress: this.progress,
      insertedCount: this.insertedCount
    }
  }

  /**
   * 暂停文件索引
   */
  static pauseIndexing(): void {
    if (this.isIndexing && !this.isPaused) {
      this.isPaused = true
      console.log('⏸️ 文件索引已暂停')
      
      // 通知 Worker 暂停
      if (this.worker) {
        this.worker.postMessage({ type: 'pause-scan' })
      }
    }
  }

  /**
   * 恢复文件索引
   */
  static resumeIndexing(): void {
    if (this.isIndexing && this.isPaused) {
      this.isPaused = false
      console.log('▶️ 文件索引已恢复')
      
      // 通知 Worker 恢复
      if (this.worker) {
        this.worker.postMessage({ type: 'resume-scan' })
      }
    }
  }

  /**
   * 获取索引状态（包含暂停状态）
   */
  static getIndexingStatus(): { isIndexing: boolean; isPaused: boolean; progress: FileIndexProgressDto } {
    return {
      isIndexing: this.isIndexing,
      isPaused: this.isPaused,
      progress: this.progress
    }
  }
}
