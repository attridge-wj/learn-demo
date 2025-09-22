# 存储文件导入优化使用指南

## 概述

针对大文件导入时渲染进程卡死的问题，我们实现了流式文件复制和进度回调机制。新的 API 支持：

- 流式文件复制，避免内存占用过大
- 实时进度回调，提供用户体验
- 可取消操作，允许用户中途停止
- 非阻塞式处理，避免渲染进程卡死
- 智能文件检测，避免重复复制相同文件

## API 接口

### 1. 简化的流式文件导入（推荐）

```typescript
// 导入文件（直接传入回调函数）
const result = await window.storageApi.importFileWithCallback({
  fileName: 'large-file.pdf',
  filePath: '/path/to/source/file.pdf',
  onProgress: (progress) => {
    console.log('导入进度:', {
      文件名: progress.fileName,
      已复制: formatBytes(progress.bytesCopied),
      总大小: formatBytes(progress.totalBytes),
      百分比: progress.percentage.toFixed(1) + '%',
      速度: formatBytes(progress.speed) + '/s',
      剩余时间: formatTime(progress.estimatedTimeRemaining)
    })
  }
})

if (result.success) {
  console.log('文件导入成功:', result.filePath)
} else {
  console.error('文件导入失败:', result.error)
}
```

### 2. 传统方式（需要手动管理监听器）

```typescript
// 导入文件（需要手动管理进度监听）
const operationId = 'unique-operation-id'

// 先注册进度监听
const progressCallback = (data: ImportProgressData) => {
  if (data.operationId === operationId) {
    console.log('进度:', data.progress.percentage + '%')
  }
}
window.storageApi.onImportProgress(progressCallback)

try {
  const result = await window.storageApi.importFileWithProgress({
    fileName: 'large-file.pdf',
    filePath: '/path/to/source/file.pdf',
    operationId
  })
  
  if (result.success) {
    console.log('文件导入成功:', result.filePath)
  }
} finally {
  // 记得清理监听器
  window.storageApi.offImportProgress(progressCallback)
}
```

### 3. 取消操作

```typescript
// 取消文件导入（需要操作ID）
const cancelResult = await window.storageApi.cancelImportFile('unique-operation-id')

if (cancelResult.success) {
  console.log('操作已取消')
} else {
  console.log('取消失败:', cancelResult.message)
}
```

## 完整使用示例

### 简化版本（推荐）

```typescript
class SimpleFileImporter {
  async importFile(fileName: string, filePath: string): Promise<boolean> {
    try {
      const result = await window.storageApi.importFileWithCallback({
        fileName,
        filePath,
        onProgress: (progress) => {
          this.updateProgress(progress)
        }
      })

      if (result.success) {
        console.log('文件导入成功:', result.filePath)
        return true
      } else {
        console.error('文件导入失败:', result.error)
        return false
      }
    } catch (error) {
      if (error.message === '文件复制已取消') {
        console.log('用户取消了文件导入')
      } else {
        console.error('文件导入出错:', error)
      }
      return false
    }
  }

  private updateProgress(progress: ImportProgress) {
    // 更新 UI 显示进度
    const progressElement = document.getElementById('import-progress')
    if (progressElement) {
      progressElement.innerHTML = `
        <div>文件: ${progress.fileName}</div>
        <div>进度: ${progress.percentage.toFixed(1)}%</div>
        <div>速度: ${this.formatBytes(progress.speed)}/s</div>
        <div>剩余时间: ${this.formatTime(progress.estimatedTimeRemaining)}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress.percentage}%"></div>
        </div>
      `
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private formatTime(seconds: number): string {
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
}

// 使用示例
const importer = new SimpleFileImporter()

// 第一次导入 - 会进行实际复制
const success1 = await importer.importFile('large-video.mp4', '/path/to/video.mp4')

// 第二次导入相同文件 - 会跳过复制，直接返回成功
const success2 = await importer.importFile('large-video.mp4', '/path/to/video.mp4')
```

### 高级版本（支持取消操作）

```typescript
class AdvancedFileImporter {
  private operationId: string | null = null

  async importFile(fileName: string, filePath: string): Promise<boolean> {
    this.operationId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const result = await window.storageApi.importFileWithProgress({
        fileName,
        filePath,
        operationId: this.operationId
      })

      if (result.success) {
        console.log('文件导入成功:', result.filePath)
        return true
      } else {
        console.error('文件导入失败:', result.error)
        return false
      }
    } catch (error) {
      if (error.message === '文件复制已取消') {
        console.log('用户取消了文件导入')
      } else {
        console.error('文件导入出错:', error)
      }
      return false
    } finally {
      this.operationId = null
    }
  }

  async cancelImport(): Promise<void> {
    if (this.operationId) {
      try {
        const result = await window.storageApi.cancelImportFile(this.operationId)
        if (result.success) {
          console.log('操作已取消')
        }
      } catch (error) {
        console.error('取消失败:', error)
      }
    }
  }

  // 设置进度监听
  setupProgressListener() {
    window.storageApi.onImportProgress((data) => {
      if (data.operationId === this.operationId) {
        this.updateProgress(data.progress)
      }
    })
  }

  // 清理进度监听
  cleanupProgressListener() {
    window.storageApi.offImportProgress(this.updateProgress)
  }

  private updateProgress(progress: ImportProgress) {
    // 更新 UI 显示进度
    console.log('进度:', progress.percentage.toFixed(1) + '%')
  }
}
```

## 性能优化说明

### 1. 流式复制
- 使用 `fs.createReadStream()` 和 `fs.createWriteStream()` 进行流式复制
- 默认块大小为 64KB，可根据需要调整
- 避免将整个文件加载到内存中

### 2. 智能文件检测
- **文件存在性检查**：导入前检查目标文件是否已存在
- **文件大小比较**：比较源文件和目标文件的大小
- **跳过重复复制**：如果文件大小相同，直接跳过复制操作
- **进度回调处理**：对于已存在的文件，立即发送100%进度回调

### 3. 进度回调优化
- 限制进度回调频率（最多每100ms调用一次）
- 避免频繁的 IPC 通信影响性能

### 4. 取消机制
- 使用 `AbortController` 实现优雅的取消操作
- 自动清理部分复制的文件
- 支持多个并发导入操作

### 5. 错误处理
- 完善的错误处理机制
- 区分取消操作和其他错误
- 自动清理资源

## 注意事项

1. **操作ID唯一性**：确保每个导入操作使用唯一的 `operationId`
2. **进度监听清理**：使用完毕后记得取消进度监听，避免内存泄漏
3. **错误处理**：妥善处理取消操作和其他错误情况
4. **并发限制**：虽然支持多个并发操作，但建议限制同时进行的导入数量

## 兼容性

- 保持原有 `importFile` API 的完全兼容性
- 新功能作为可选增强，不影响现有代码
- 支持渐进式迁移
