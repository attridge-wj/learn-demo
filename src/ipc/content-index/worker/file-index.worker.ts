import { parentPort, workerData } from 'worker_threads'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { glob } from 'fast-glob'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
// 注意：在 Worker 中不能直接使用 electron 相关的模块
// 将系统工具函数移到 Worker 内部实现

// 日志级别控制
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const isVerbose = LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// 日志输出函数
function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) {
  if (level === 'debug' && !isVerbose) return
  if (level === 'info' && isProduction && !isVerbose) return
  
  const prefix = `[Worker-${level.toUpperCase()}]`
  console[level](prefix, message, ...args)
}

// Worker 消息类型
interface WorkerMessage {
  type: 'progress' | 'complete' | 'error' | 'status'
  data: any
}

// 文件信息接口
interface FileInfo {
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  createTime: Date
  updateTime: Date
}

// 平台工具函数
function getSystemDirectories(): string[] {
  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === 'win32') {
    // 注意：这里需要同步返回，但 getWindowsDirectories 是异步的
    // 我们将在 startScan 中处理异步调用
    return getWindowsDirectoriesSync(homeDir)
  } else if (platform === 'darwin') {
    return getMacOSVolumes(homeDir)
  } else {
    return getLinuxMounts(homeDir)
  }
}

// 同步版本的 Windows 目录获取（作为备用）
function getWindowsDirectoriesSync(homeDir: string): string[] {
  const directories: string[] = []
  
  // 基本用户目录
  const basicUserDirs = [
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Pictures'),
    path.join(homeDir, 'Videos'),
    path.join(homeDir, 'Music'),
    path.join(homeDir, 'Favorites')
  ]
  
  for (const dir of basicUserDirs) {
    if (fs.existsSync(dir)) {
      directories.push(dir)
    }
  }
  
  // 扫描驱动器
  for (let i = 65; i <= 90; i++) {
    const driveLetter = String.fromCharCode(i)
    const drivePath = `${driveLetter}:\\`
    
    try {
      if (fs.existsSync(drivePath)) {
        directories.push(drivePath)
      }
    } catch (error) {
      // 忽略无法访问的驱动器
    }
  }
  
  return directories
}

// 异步版本的 Windows 目录获取（Worker 内部实现，不依赖 electron）
async function getWindowsDirectories(homeDir: string): Promise<string[]> {
  const directories: string[] = []
  
  try {
    // Worker 内部实现特殊目录获取，不依赖 electron
    const specialDirs = await getWindowsSpecialDirectories()
    
    // 添加所有存在的特殊目录
    for (const dir of specialDirs) {
      if (dir.path && await fs.pathExists(dir.path)) {
        directories.push(dir.path)
      }
    }
    
    // 获取系统驱动器
    const systemDrives = await getWindowsSystemDrives()
    
    // 添加所有存在的驱动器
    for (const drive of systemDrives) {
      if (drive.path && await fs.pathExists(drive.path)) {
        directories.push(drive.path)
      }
    }
    
    // 额外检查一些常见的用户目录（作为备用）
    const additionalUserDirs = [
      path.join(homeDir, 'OneDrive'),
      path.join(homeDir, 'OneDrive - Personal'),
      path.join(homeDir, 'OneDrive - 工作或学校'),
      path.join(homeDir, 'Dropbox'),
      path.join(homeDir, 'Google Drive')
    ]
    
    for (const dir of additionalUserDirs) {
      if (await fs.pathExists(dir)) {
        directories.push(dir)
      }
    }
    
  } catch (error) {
    // 备用方案：使用同步方法
    return getWindowsDirectoriesSync(homeDir)
  }
  
  return directories
}

// Worker 内部实现：获取 Windows 特殊目录
async function getWindowsSpecialDirectories(): Promise<Array<{name: string, path: string}>> {
  const directories: Array<{name: string, path: string}> = []
  
  try {
    // 使用 Node.js 内置模块获取用户目录
    const userProfile = process.env.USERPROFILE || process.env.HOME || ''
    const appData = process.env.APPDATA || ''
    const localAppData = process.env.LOCALAPPDATA || ''
    
    // 基本用户目录
    const basicDirs = [
      { name: 'Desktop', path: path.join(userProfile, 'Desktop') },
      { name: 'Documents', path: path.join(userProfile, 'Documents') },
      { name: 'Downloads', path: path.join(userProfile, 'Downloads') },
      { name: 'Pictures', path: path.join(userProfile, 'Pictures') },
      { name: 'Videos', path: path.join(userProfile, 'Videos') },
      { name: 'Music', path: path.join(userProfile, 'Music') },
      { name: 'Favorites', path: path.join(userProfile, 'Favorites') }
    ]
    
    for (const dir of basicDirs) {
      if (await fs.pathExists(dir.path)) {
        directories.push(dir)
      }
    }
    
    // 系统目录
    const systemDirs = [
      { name: 'Program Files', path: 'C:\\Program Files' },
      { name: 'Program Files (x86)', path: 'C:\\Program Files (x86)' },
      { name: 'Windows', path: 'C:\\Windows' }
    ]
    
    for (const dir of systemDirs) {
      if (await fs.pathExists(dir.path)) {
        directories.push(dir)
      }
    }
    
  } catch (error) {
    // 忽略获取特殊目录失败
  }
  
  return directories
}

// Worker 内部实现：获取 Windows 系统驱动器
async function getWindowsSystemDrives(): Promise<Array<{name: string, path: string}>> {
  const drives: Array<{name: string, path: string}> = []
  
  try {
    // 扫描 A-Z 驱动器
    for (let i = 65; i <= 90; i++) {
      const driveLetter = String.fromCharCode(i)
      const drivePath = `${driveLetter}:\\`
      
      if (await fs.pathExists(drivePath)) {
        drives.push({
          name: `${driveLetter}: 驱动器`,
          path: drivePath
        })
      }
    }
  } catch (error) {
    // 忽略获取系统驱动器失败
  }
  
  return drives
}

function getMacOSVolumes(homeDir: string): string[] {
  const volumes: string[] = []
  
  try {
    // 基本用户目录
    const userDirs = [
      homeDir,
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Downloads'),
      path.join(homeDir, 'Pictures'),
      path.join(homeDir, 'Movies'),
      path.join(homeDir, 'Music'),
      path.join(homeDir, 'Public')
    ]

    for (const dir of userDirs) {
      if (fs.existsSync(dir)) {
        volumes.push(dir)
      }
    }

    // 系统根目录
    const systemDirs = ['/', '/Volumes', '/System/Volumes']
    for (const dir of systemDirs) {
      if (fs.existsSync(dir)) {
        volumes.push(dir)
      }
    }

    // 扫描 /Volumes 目录（外部驱动器）
    const volumesDir = '/Volumes'
    if (fs.existsSync(volumesDir)) {
      try {
        const items = fs.readdirSync(volumesDir)
        for (const item of items) {
          // 跳过隐藏文件和系统文件
          if (item.startsWith('.')) continue
          
          const itemPath = path.join(volumesDir, item)
          try {
            if (fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
              volumes.push(itemPath)
            }
          } catch (statError) {
            // 忽略无法访问的项目
            continue
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
      }
    }

    // 扫描 /System/Volumes 目录（macOS 系统卷）
    const systemVolumesDir = '/System/Volumes'
    if (fs.existsSync(systemVolumesDir)) {
      try {
        const items = fs.readdirSync(systemVolumesDir)
        for (const item of items) {
          if (item.startsWith('.')) continue
          
          const itemPath = path.join(systemVolumesDir, item)
          try {
            if (fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
              volumes.push(itemPath)
            }
          } catch (statError) {
            continue
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
      }
    }

  } catch (error) {
    // 忽略获取 macOS 卷失败
  }

  return volumes
}

function getLinuxMounts(homeDir: string): string[] {
  const mounts: string[] = []
  const commonMounts = [
    '/',
    '/home',
    '/mnt',
    '/media',
    homeDir,
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Pictures'),
    path.join(homeDir, 'Videos'),
    path.join(homeDir, 'Music')
  ]

  for (const mount of commonMounts) {
    if (fs.existsSync(mount)) {
      mounts.push(mount)
    }
  }

  const mountDirs = ['/mnt', '/media']
  for (const mountDir of mountDirs) {
    if (fs.existsSync(mountDir)) {
      try {
        const items = fs.readdirSync(mountDir)
        for (const item of items) {
          const itemPath = path.join(mountDir, item)
          if (fs.existsSync(itemPath)) {
            mounts.push(itemPath)
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
      }
    }
  }

  return mounts
}

function getExcludePatterns(): string[] {
  return [
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/node_modules/**',
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    '**/venv/**',
    '**/env/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**',
    '**/.cache/**',
    '**/cache/**',
    '**/temp/**',
    '**/.temp/**',
    '**/*.tmp',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/desktop.ini',
    '**/AppData/Local/ElevatedDiagnostics/**',
    '**/AppData/Local/Temp/**',
    '**/System Volume Information/**',
    '**/$RECYCLE.BIN/**'
  ]
}

function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (!ext) return 'unknown'
  
  // 纯文本格式
  if (['.txt', '.log', '.md', '.rtf'].includes(ext)) return 'text'
  
  // 代码文件（支持任意代码和配置文件）
  const codeExtensions = [
    // 主流编程语言
    '.java', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.scss', '.less', 
    '.py', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift',
    '.kt', '.scala', '.clj', '.hs', '.ml', '.fs', '.vb', '.sql', '.sh', '.bat', '.ps1',
    
    // 配置文件
    '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.cfg', '.conf', '.config', 
    '.properties', '.env',
    
    // 版本控制和构建文件
    '.gitignore', '.gitattributes', '.dockerfile', '.makefile', '.cmake', '.gradle', 
    '.maven', '.pom', '.sbt', '.cabal', '.cargo',
    
    // 前端框架和工具配置
    '.vue', '.svelte', '.astro',
    
    // 数据库相关
    '.sqlite', '.db',
    
    // 脚本文件
    '.bash', '.zsh', '.fish', '.cmd', '.psm1',
    
    // 标记语言
    '.markdown', '.rst', '.adoc', '.ltx'
  ]
  
  if (codeExtensions.includes(ext)) return 'code'
  
  // Microsoft Office 格式
  if (['.doc', '.docx'].includes(ext)) return 'word'
  if (['.xls', '.xlsx'].includes(ext)) return 'excel'
  if (['.ppt', '.pptx'].includes(ext)) return 'powerpoint'
  if (['.one'].includes(ext)) return 'onenote'
  
  // PDF 格式
  if (['.pdf'].includes(ext)) return 'pdf'
  
  // 邮件格式
  if (['.eml'].includes(ext)) return 'email'
  
  // 电子书格式
  if (['.mobi', '.epub', '.azw', '.azw3', '.djvu'].includes(ext)) return 'ebook'
  
  // Microsoft 编译 HTML 帮助
  if (['.chm'].includes(ext)) return 'chm'
  
  // WPS 格式
  if (['.wps', '.et', '.dps'].includes(ext)) return 'wps'
  
  // 思维导图格式
  if (['.lighten', '.mmap', '.emmx', '.mm', '.xmind'].includes(ext)) return 'mindmap'
  
  // 其他文档格式
  if (['.ofd', '.ziw', '.eddx'].includes(ext)) return 'document'
  
  // LaTeX 格式
  if (['.tex', '.ltx', '.sty', '.cls', '.bbl', '.aux', '.toc', '.lof', '.lot'].includes(ext)) return 'latex'
  
  // 图片格式（支持 OCR）
  if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.gif', '.webp'].includes(ext)) return 'image'
  
  // 可执行文件
  if (['.exe', '.dll', '.so', '.dylib', '.app', '.msi', '.deb', '.rpm', '.pkg'].includes(ext)) return 'executable'
  
  return 'unknown'
}

// 扫描状态
interface ScanStatus {
  isScanning: boolean
  currentDirectory: string
  currentFile: string
  processedFiles: number
  totalFiles: number
  percentage: number
}

class FileIndexWorker {
  private isScanning = false
  private scanStatus: ScanStatus = {
    isScanning: false,
    currentDirectory: '',
    currentFile: '',
    processedFiles: 0,
    totalFiles: 0,
    percentage: 0
  }

  constructor() {
    try {
      this.setupMessageHandlers()
      
      // 发送启动确认消息
      this.sendMessage('status', { type: 'worker-ready', message: 'Worker 已准备就绪' })
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
          case 'start-scan':
            const scanMode = message.scanMode || 'full'
            const lastIndexTime = message.lastIndexTime
            await this.startScan(scanMode, lastIndexTime)
            break
          case 'stop-scan':
            await this.stopScan()
            break
          case 'get-status':
            this.sendMessage('status', this.scanStatus)
            break
          
        case 'pause-scan':
          this.isScanning = false
          this.sendMessage('status', { type: 'scan-paused', message: '扫描已暂停' })
          break
          
        case 'resume-scan':
          this.sendMessage('status', { type: 'scan-resumed', message: '扫描已恢复' })
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

  private async startScan(scanMode: 'full' | 'incremental' = 'full', lastIndexTime?: string) {
    if (this.isScanning) {
      this.sendMessage('error', { error: '扫描已在进行中' })
      return
    }

    this.isScanning = true
    this.scanStatus.isScanning = true
    this.scanStatus.processedFiles = 0
    this.scanStatus.totalFiles = 0
    this.scanStatus.percentage = 0

    try {
      // 获取扫描目录
      let systemDirs: string[] = []
      
      if (os.platform() === 'win32') {
        try {
          // 尝试使用异步方法获取更准确的目录信息
          systemDirs = await getWindowsDirectories(os.homedir())
        } catch (error) {
          systemDirs = getSystemDirectories()
        }
      } else {
        systemDirs = getSystemDirectories()
      }
      
      const excludePatterns = getExcludePatterns()

      // 发送扫描开始状态
      this.sendMessage('status', { 
        type: 'scan-started', 
        message: `开始${scanMode === 'full' ? '全量' : '增量'}扫描文件系统` 
      })

      let totalProcessed = 0
      let totalChanged = 0
      let totalSkipped = 0

      // 扫描每个系统目录
      for (let dirIndex = 0; dirIndex < systemDirs.length; dirIndex++) {
        if (!this.isScanning) break // 检查是否被停止

        const dir = systemDirs[dirIndex]
        
        if (!await fs.pathExists(dir)) {
          continue
        }

        this.scanStatus.currentDirectory = dir
        this.sendMessage('progress', this.scanStatus)
        
        // 发送目录扫描消息
        this.sendMessage('directory-scan', { directory: dir })

        
        try {
          const result = await this.scanDirectory(dir, excludePatterns, scanMode, lastIndexTime)
          totalProcessed += result.processed
          totalChanged += result.changed
          totalSkipped += result.skipped
          
          
          // 更新进度
          this.scanStatus.processedFiles = totalProcessed
          this.scanStatus.percentage = Math.round((dirIndex + 1) / systemDirs.length * 100)
          this.sendMessage('progress', this.scanStatus)
          
          // 每扫描完一个目录就让出控制权，避免长时间阻塞
          await new Promise(resolve => setImmediate(resolve))
          
        } catch (error) {
          console.error(`❌ Worker: 扫描目录 ${dir} 失败:`, error)
          this.sendMessage('error', { error: `扫描目录 ${dir} 失败: ${(error as Error)?.message || '未知错误'}` })
          
          // 重要：即使某个目录扫描失败，也要继续扫描其他目录
          // 不要设置 isScanning = false，让扫描继续进行
        }
      }

      
      this.sendMessage('complete', { 
        totalFiles: totalProcessed,
        changedFiles: totalChanged,
        skippedFiles: totalSkipped,
        scanMode 
      })
      
      // 发送扫描完成状态
      this.sendMessage('status', { 
        type: 'scan-complete', 
        message: `${scanMode === 'full' ? '全量' : '增量'}文件系统扫描完成` 
      })
      
    } catch (error) {
      console.error('❌ Worker: 扫描失败:', error)
      this.sendMessage('error', { error: error instanceof Error ? error.message : '未知错误' })
    } finally {
      this.isScanning = false
      this.scanStatus.isScanning = false
      this.sendMessage('status', this.scanStatus)
    }
  }

  private async stopScan() {
    this.isScanning = false
    this.scanStatus.isScanning = false
    this.sendMessage('status', this.scanStatus)
  }

  private async scanDirectory(
    dirPath: string,
    excludePatterns: string[],
    scanMode: 'full' | 'incremental' = 'full',
    lastIndexTime?: string
  ): Promise<{processed: number, changed: number, skipped: number}> {
    let totalProcessed = 0
    let totalChanged = 0
    let totalSkipped = 0

    try {
      let filePaths: string[] = []
      try {
        filePaths = await glob('**/*', {
          cwd: dirPath,
          ignore: excludePatterns,
          onlyFiles: true,
          followSymbolicLinks: false,
          dot: false,
          absolute: true
        })
      } catch (error) {
        return { processed: 0, changed: 0, skipped: 0 }
      }

      // 分块处理，避免大数组操作和内存溢出，边处理边发送到主进程
      const chunkSize = 100 // 从 1000 减少到 100，减少内存占用
      const totalFiles = filePaths.length
      
      for (let chunkStart = 0; chunkStart < totalFiles; chunkStart += chunkSize) {
        if (!this.isScanning) break // 检查是否被停止
        
        const chunkEnd = Math.min(chunkStart + chunkSize, totalFiles)
        const chunk = filePaths.slice(chunkStart, chunkEnd)
        const chunkFiles: FileInfo[] = []
        
        // 处理当前块
        for (let i = 0; i < chunk.length; i++) {
          if (!this.isScanning) break
          
          try {
            const filePath = chunk[i]
            const globalIndex = chunkStart + i
            
            this.scanStatus.currentFile = filePath
            this.scanStatus.processedFiles = globalIndex + 1
            this.scanStatus.totalFiles = totalFiles
            this.scanStatus.percentage = Math.round(((globalIndex + 1) / totalFiles) * 100)
            
            const fileInfo = this.getFileInfoFast(filePath)
            if (fileInfo) {
              // 根据扫描模式处理文件
              if (scanMode === 'incremental' && lastIndexTime) {
                // 增量扫描：检查文件是否需要更新
                const needsUpdate = this.shouldUpdateFile(fileInfo, lastIndexTime)
                if (needsUpdate) {
                  chunkFiles.push(fileInfo)
                  totalChanged++
                } else {
                  totalSkipped++
                }
              } else {
                // 全量扫描：处理所有文件
                chunkFiles.push(fileInfo)
                totalChanged++
              }
              totalProcessed++
            }
          } catch (error) {
            // 忽略单个文件错误，继续处理
          }
        }

        // 每处理完一个块就发送给主进程进行数据库插入
        if (chunkFiles.length > 0) {
          this.sendMessage('files-batch', { files: chunkFiles, directory: dirPath })
        }

        // 发送进度更新
        this.sendMessage('progress', this.scanStatus)
        
        // 优化：增加延迟，让出更多控制权，减少对主应用的影响
        // 每处理完一个批次就让出控制权，避免长时间阻塞
        await new Promise(resolve => setTimeout(resolve, 100)) // 增加 100ms 延迟
        
        // 每处理 3 个批次后，让出更多控制权
        if ((chunkStart / chunkSize) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 300)) // 额外 300ms 延迟
        }
      }

      return { processed: totalProcessed, changed: totalChanged, skipped: totalSkipped }
    } catch (error) {
      console.error(`❌ Worker: 扫描目录 ${dirPath} 失败:`, error)
      return { processed: 0, changed: 0, skipped: 0 }
    }
  }

  private getFileInfoFast(filePath: string): FileInfo | null {
    try {
      // 获取文件基本信息，包括修改时间用于增量检测
      const fileName = path.basename(filePath)
      const fileType = getFileType(filePath)
      
      let fileSize = 0
      let updateTime = new Date()
      let createTime = new Date()
      
      try {
        // 尝试获取文件状态，用于增量检测
        const stats = fs.statSync(filePath)
        fileSize = stats.size
        updateTime = stats.mtime
        createTime = stats.birthtime
      } catch (statError) {
      // 如果无法获取文件状态，使用默认值
      }

      // 简化：不再在 Worker 中处理分词，只返回基本文件信息
      const fileInfo = {
        fileName,
        filePath,
        fileSize,
        fileType,
        createTime,
        updateTime
      }
      

      return fileInfo
    } catch (error) {
      console.error(`❌ getFileInfoFast 失败: ${filePath}`, error)
      return null
    }
  }

  /**
   * 检查文件是否需要更新（用于增量扫描）
   * 新的逻辑：不仅要检查文件修改时间，还要考虑文件是否已经被索引过
   */
  private shouldUpdateFile(fileInfo: FileInfo, lastIndexTime: string): boolean {
    try {
      // 如果 lastIndexTime 为空或无效，认为需要更新
      if (!lastIndexTime || lastIndexTime === 'null' || lastIndexTime === 'undefined') {
        return true
      }
      
      const lastIndexDate = new Date(lastIndexTime)
      const fileUpdateDate = new Date(fileInfo.updateTime)
      
      // 检查日期是否有效
      if (isNaN(lastIndexDate.getTime()) || isNaN(fileUpdateDate.getTime())) {
        return true
      }
      
      // 新的逻辑：文件需要更新的条件
      // 1. 文件修改时间晚于上次索引时间
      // 2. 或者文件修改时间早于上次索引时间但文件可能从未被索引过
      const fileModifiedAfterIndex = fileUpdateDate > lastIndexDate
      
      // 如果文件修改时间晚于索引时间，肯定需要更新
      if (fileModifiedAfterIndex) {
        return true
      }
      
      // 如果文件修改时间早于索引时间，我们需要进一步判断
      // 这里我们采用保守策略：如果文件修改时间在合理范围内，认为需要检查
      const timeDiff = lastIndexDate.getTime() - fileUpdateDate.getTime()
      const maxReasonableDiff = 24 * 60 * 60 * 1000 // 24小时
      
      if (timeDiff > maxReasonableDiff) {
        // 文件修改时间远早于索引时间，可能从未被索引过
        return true
      }
      
      // 文件修改时间在合理范围内，且早于索引时间，认为不需要更新
      return false
      
    } catch (error) {
      // 如果时间比较失败，保守起见认为需要更新
      return true
    }
  }
}

// 启动 Worker
new FileIndexWorker()