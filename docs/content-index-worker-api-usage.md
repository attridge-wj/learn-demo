# 文件夹内容索引 Worker API 使用说明

本文档介绍如何使用文件夹内容索引 Worker 功能，该功能使用单独的 Worker 进程来处理文件夹内容索引，避免阻塞主进程。

## 概述

文件夹内容索引 Worker 是一个独立的进程，专门用于处理文件夹内容索引任务。它提供了以下优势：

- **非阻塞处理**：索引过程在后台进行，不会阻塞主应用
- **实时进度监控**：可以实时获取索引进度和状态
- **详细状态信息**：提供支持索引的文件数量、已索引数量、失败数量等详细信息
- **可控制性**：支持启动、停止等操作

## API 接口

### 1. 索引文件夹

#### 功能描述
启动指定目录的文件夹内容索引任务，使用 Worker 进程在后台处理。

#### 调用方法
```typescript
const result = await window.contentIndexApi.indexFolder({
  dirPath: string,      // 要索引的目录路径
  spaceId?: string      // 空间ID（可选）
})
```

#### 返回值
```typescript
{
  success: boolean;     // 是否成功启动
  message: string;      // 状态消息
}
```

#### 使用示例
```typescript
// 启动文件夹内容索引
const result = await window.contentIndexApi.indexFolder({
  dirPath: 'C:\\Users\\Documents\\Projects',
  spaceId: 'default'
})

if (result.success) {
  console.log('文件夹内容索引已启动:', result.message)
  console.log('索引将在后台进行，请使用 getFolderIndexStatus 监控进度')
} else {
  console.error('启动文件夹内容索引失败:', result.message)
}
```

### 2. 获取文件夹内容索引状态

#### 功能描述
获取当前文件夹内容索引的详细状态信息，包括进度、文件统计等。

#### 调用方法
```typescript
const status = await window.contentIndexApi.getFolderIndexStatus()
```

#### 返回值
```typescript
{
  isIndexing: boolean;           // 是否正在索引
  currentDirectory: string;      // 当前索引的目录
  currentFile: string;           // 当前处理的文件
  processedFiles: number;        // 已处理的文件数量
  totalFiles: number;            // 总文件数量
  percentage: number;            // 进度百分比 (0-100)
  supportedFiles: number;        // 支持索引的文件数量
  indexedFiles: number;          // 成功索引的文件数量
  failedFiles: number;           // 索引失败的文件数量
  errors: string[];              // 错误信息列表
  workerStatus: {
    isWorkerReady: boolean;      // Worker 是否准备就绪
    hasWorker: boolean;          // 是否有 Worker 进程
  }
}
```

#### 使用示例
```typescript
// 获取当前文件夹内容索引状态
const status = await window.contentIndexApi.getFolderIndexStatus()

if (status.isIndexing) {
  console.log(`正在索引目录: ${status.currentDirectory}`)
  console.log(`当前文件: ${status.currentFile}`)
  console.log(`进度: ${status.percentage}% (${status.processedFiles}/${status.totalFiles})`)
  console.log(`支持索引的文件: ${status.supportedFiles}`)
  console.log(`成功索引: ${status.indexedFiles}`)
  console.log(`失败文件: ${status.failedFiles}`)
  
  if (status.errors.length > 0) {
    console.log('错误信息:', status.errors)
  }
} else {
  console.log('当前没有进行中的文件夹内容索引任务')
}
```

### 3. 停止文件夹内容索引

#### 功能描述
停止当前进行中的文件夹内容索引任务。

#### 调用方法
```typescript
const result = await window.contentIndexApi.stopFolderIndex()
```

#### 返回值
```typescript
{
  success: boolean;     // 是否成功停止
  message: string;      // 状态消息
}
```

#### 使用示例
```typescript
// 停止文件夹内容索引
const result = await window.contentIndexApi.stopFolderIndex()

if (result.success) {
  console.log('文件夹内容索引已停止:', result.message)
} else {
  console.error('停止文件夹内容索引失败:', result.message)
}
```

## 完整使用示例

### 带进度监控的文件夹内容索引

```typescript
class FolderIndexManager {
  private isMonitoring = false
  private progressInterval: NodeJS.Timeout | null = null

  /**
   * 开始索引并监控进度
   */
  async startIndexingWithProgress(dirPath: string, spaceId?: string) {
    try {
      // 1. 启动文件夹内容索引
      const startResult = await window.contentIndexApi.indexFolder({
        dirPath,
        spaceId
      })

      if (!startResult.success) {
        throw new Error(startResult.message)
      }

      console.log('文件夹内容索引已启动，开始监控进度...')

      // 2. 开始进度监控
      this.startProgressMonitoring()

      return true
    } catch (error) {
      console.error('启动文件夹内容索引失败:', error)
      return false
    }
  }

  /**
   * 开始进度监控
   */
  private startProgressMonitoring() {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.progressInterval = setInterval(async () => {
      try {
        const status = await window.contentIndexApi.getFolderIndexStatus()
        
        if (status.isIndexing) {
          // 更新UI进度
          this.updateProgressUI(status)
        } else {
          // 索引完成或停止
          this.stopProgressMonitoring()
          this.onIndexComplete(status)
        }
      } catch (error) {
        console.error('获取文件夹内容索引状态失败:', error)
        this.stopProgressMonitoring()
      }
    }, 1000) // 每秒更新一次
  }

  /**
   * 停止进度监控
   */
  private stopProgressMonitoring() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
    this.isMonitoring = false
  }

  /**
   * 更新进度UI
   */
  private updateProgressUI(status: any) {
    // 更新进度条
    const progressBar = document.getElementById('progress-bar')
    if (progressBar) {
      progressBar.value = status.percentage
    }

    // 更新状态文本
    const statusText = document.getElementById('status-text')
    if (statusText) {
      statusText.textContent = `文件夹索引中: ${status.currentFile} (${status.percentage}%)`
    }

    // 更新统计信息
    const statsText = document.getElementById('stats-text')
    if (statsText) {
      statsText.textContent = `已处理: ${status.processedFiles}/${status.totalFiles} | 成功: ${status.indexedFiles} | 失败: ${status.failedFiles}`
    }
  }

  /**
   * 索引完成回调
   */
  private onIndexComplete(status: any) {
    console.log('文件夹内容索引完成:', status)
    
    // 显示完成消息
    const message = `文件夹内容索引完成！共处理 ${status.totalFiles} 个文件，成功 ${status.indexedFiles} 个，失败 ${status.failedFiles} 个`
    
    if (status.errors.length > 0) {
      console.warn('索引过程中的错误:', status.errors)
    }

    // 可以在这里显示完成通知或更新UI
    this.showCompletionMessage(message)
  }

  /**
   * 显示完成消息
   */
  private showCompletionMessage(message: string) {
    // 这里可以实现具体的UI更新逻辑
    console.log(message)
    
    // 例如：显示通知、更新状态等
    const notification = new Notification('文件夹内容索引完成', {
      body: message,
      icon: '/path/to/icon.png'
    })
  }

  /**
   * 停止索引
   */
  async stopIndexing() {
    try {
      const result = await window.contentIndexApi.stopFolderIndex()
      
      if (result.success) {
        console.log('文件夹内容索引已停止:', result.message)
        this.stopProgressMonitoring()
        return true
      } else {
        console.error('停止文件夹内容索引失败:', result.message)
        return false
      }
    } catch (error) {
      console.error('停止文件夹内容索引失败:', error)
      return false
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopProgressMonitoring()
  }
}

// 使用示例
const folderIndexManager = new FolderIndexManager()

// 开始索引
document.getElementById('start-btn').addEventListener('click', async () => {
  const dirPath = document.getElementById('dir-input').value
  if (dirPath) {
    await folderIndexManager.startIndexingWithProgress(dirPath, 'default')
  }
})

// 停止索引
document.getElementById('stop-btn').addEventListener('click', async () => {
  await folderIndexManager.stopIndexing()
})

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  folderIndexManager.cleanup()
})
```

## 支持的文件类型

文件夹内容索引 Worker 支持以下文件类型的内容索引：

### 文档格式
- `.pdf` - PDF 文档
- `.doc`, `.docx` - Word 文档
- `.txt` - 纯文本文件
- `.md` - Markdown 文件
- `.rtf` - 富文本文件

### 代码文件
- `.js`, `.ts`, `.jsx`, `.tsx` - JavaScript/TypeScript 文件
- `.html`, `.htm`, `.css`, `.scss`, `.less` - 前端文件
- `.java`, `.py`, `.cpp`, `.c`, `.h`, `.hpp` - 编程语言文件
- `.cs`, `.php`, `.rb`, `.go`, `.rs`, `.swift` - 其他编程语言
- `.kt`, `.scala`, `.sql`, `.sh`, `.bat`, `.ps1` - 脚本文件

### 配置文件
- `.yaml`, `.yml`, `.json`, `.xml` - 配置文件
- `.toml`, `.ini`, `.cfg`, `.conf` - 配置文件
- `.gitignore`, `.dockerfile`, `.makefile`, `.cmake` - 构建文件

### 其他文本格式
- `.log` - 日志文件
- `.latex`, `.tex` - LaTeX 文档

## 注意事项

1. **Worker 进程管理**：Worker 进程会在需要时自动启动，索引完成后会自动管理
2. **进度更新频率**：建议每秒更新一次进度，避免过于频繁的API调用
3. **错误处理**：索引过程中可能遇到文件访问权限、格式不支持等问题，这些会被记录在 `errors` 数组中
4. **资源清理**：在页面卸载或组件销毁时，记得调用 `cleanup()` 方法清理资源

## 性能优化建议

1. **批量处理**：Worker 内部会批量处理文件，减少进程间通信开销
2. **进度更新**：合理设置进度更新频率，避免过于频繁的状态查询
3. **错误收集**：收集索引过程中的错误信息，便于问题排查和优化
4. **资源管理**：及时清理不需要的监控定时器，避免内存泄漏

## 相关链接

- [文件夹内容索引 Worker 服务](../src/ipc/content-index/service/content-index-worker.service.ts)
- [文件夹内容索引 Worker 进程](../src/ipc/content-index/worker/content-index.worker.ts)
- [文档索引 IPC 服务](../src/ipc/content-index/service/document-index-ipc.service.ts)
- [内容索引 IPC 配置](../src/ipc/content-index/index.ts)
- [Preload 脚本](../src/preload.ts)
