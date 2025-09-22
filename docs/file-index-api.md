# 文件索引 API 文档

## 概述

文件索引模块提供了全盘文件索引和检索功能，支持 Windows、macOS 和 Linux 系统。该模块使用 fast-glob 进行文件扫描，SQLite FTS5 进行全文搜索，能够高效地索引和搜索系统文件。

### 索引范围

- **Windows**: 扫描所有可用的磁盘驱动器（C:, D:, E: 等）
- **macOS**: 扫描所有挂载的卷（包括外部磁盘）
- **Linux**: 扫描所有挂载的文件系统

### 排除规则

系统会自动排除以下类型的文件和目录：
- 系统关键目录（Windows 系统文件、macOS 系统文件、Linux 系统文件）
- 开发工具相关文件（node_modules、.git、IDE 配置等）
- 缓存文件和临时文件
- 依赖锁定文件

## API 使用说明

在渲染进程中，可以通过 `window.fileIndexApi` 对象访问文件索引相关的功能：

```javascript
// 检查索引状态
const status = await window.fileIndexApi.getStatus()

// 搜索文件
const result = await window.fileIndexApi.search({
  keyword: 'document',
  fileType: 'pdf'
})
```

## 功能特性

- **跨平台支持**: 支持 Windows 和 macOS 系统
- **智能排除**: 自动排除开发依赖文件和系统文件
- **异步索引**: 后台异步索引，不阻塞主进程
- **全文搜索**: 基于 SQLite FTS5 的高效搜索
- **文件类型识别**: 自动识别常见文件类型
- **进度监控**: 实时监控索引进度

## API 接口

### 1. 搜索功能

#### 1.1 标准搜索

**接口**: `file-index:search`

**描述**: 支持复杂过滤条件的精确搜索，适合需要特定条件的搜索场景

**参数**:
```typescript
{
  keyword: string          // 搜索关键词
  fileType?: string        // 文件类型过滤
  minSize?: number         // 最小文件大小（字节）
  maxSize?: number         // 最大文件大小（字节）
  limit?: number           // 返回结果数量限制（默认10）
  offset?: number          // 分页偏移量（默认0）
}
```

**返回**:
```typescript
{
  list: FileIndexItemDto[] // 文件列表
  total: number            // 总数量
  keyword: string          // 搜索关键词
  limit: number            // 限制数量
  offset: number           // 偏移量
}
```

**示例**:
```javascript
// 搜索包含 "document" 的 PDF 文件
const result = await window.fileIndexApi.search({
  keyword: 'document',
  fileType: 'pdf',
  minSize: 1024 * 1024, // 大于1MB
  limit: 20
})
```

#### 1.2 快速搜索

**接口**: `file-index:quick-search`

**描述**: 类似 Everything 的即时搜索功能，响应速度快，按相关性排序，适合实时搜索场景

**参数**:
```typescript
{
  keyword: string          // 搜索关键词
  limit?: number           // 返回结果数量限制（默认20）
}
```

**返回**:
```typescript
FileIndexItemDto[]         // 文件列表（按相关性排序）
```

**搜索语法支持**:
- `*.txt` - 搜索所有 .txt 文件
- `path:documents` - 搜索路径包含 documents 的文件
- `size:>1mb` - 搜索大于 1MB 的文件
- 普通关键词 - 支持模糊匹配和前缀搜索

**示例**:
```javascript
// 快速搜索所有 PDF 文件
const results = await window.fileIndexApi.quickSearch({
  keyword: '*.pdf',
  limit: 50
})

// 搜索路径包含 documents 的文件
const results = await window.fileIndexApi.quickSearch({
  keyword: 'path:documents'
})
```

#### 1.3 搜索建议（自动完成）

**接口**: `file-index:get-suggestions`

**描述**: 获取搜索建议，用于自动完成功能

**参数**:
```typescript
{
  partialKeyword: string   // 部分关键词
  limit?: number           // 建议数量限制（默认10）
}
```

**返回**:
```typescript
string[]                  // 建议列表
```

**示例**:
```javascript
// 获取搜索建议
const suggestions = await window.fileIndexApi.getSuggestions({
  partialKeyword: 'doc',
  limit: 5
})
```

### 2. 索引管理

#### 2.1 获取索引状态

**接口**: `file-index:get-status`

**描述**: 获取当前文件索引的状态信息

**返回**:
```typescript
{
  totalFiles: number       // 总文件数
  indexedFiles: number     // 已索引文件数
  lastIndexTime: string    // 最后索引时间
  isIndexing: boolean      // 是否正在索引
}
```

**示例**:
```javascript
const status = await window.fileIndexApi.getStatus()
console.log(`已索引 ${status.indexedFiles}/${status.totalFiles} 个文件`)
```

#### 2.2 获取索引进度

**接口**: `file-index:get-progress`

**描述**: 获取当前索引进度的详细信息

**返回**:
```typescript
{
  isIndexing: boolean      // 是否正在索引
  currentDirectory: string // 当前扫描目录
  processedFiles: number   // 已处理文件数
  totalFiles: number       // 总文件数
  percentage: number       // 进度百分比
}
```

**示例**:
```javascript
const progress = await window.fileIndexApi.getProgress()
if (progress.isIndexing) {
  console.log(`索引进度: ${progress.percentage}%`)
}
```

#### 2.3 启动系统文件索引

**接口**: `file-index:index-system-files`

**描述**: 启动系统文件索引，支持全量扫描和增量扫描

**参数**:
```typescript
{
  forceFullScan?: boolean  // 是否强制全量扫描（默认false）
}
```

**返回**:
```typescript
{
  success: boolean         // 是否成功启动
  message: string          // 状态消息
}
```

**示例**:
```javascript
// 启动增量索引
const result = await window.fileIndexApi.indexSystemFiles()

// 启动全量索引
const result = await window.fileIndexApi.indexSystemFiles({ forceFullScan: true })
```

#### 2.4 重建文件索引

**接口**: `file-index:rebuild`

**描述**: 重建整个文件索引，清除所有现有索引数据

**返回**:
```typescript
{
  success: boolean         // 是否成功
}
```

**示例**:
```javascript
const result = await window.fileIndexApi.rebuild()
if (result.success) {
  console.log('文件索引重建成功')
}
```

#### 2.5 停止文件索引

**接口**: `file-index:stop-indexing`

**描述**: 停止当前进行中的文件索引任务

**返回**:
```typescript
{
  success: boolean         // 是否成功停止
  message: string          // 状态消息
}
```

**示例**:
```javascript
const result = await window.fileIndexApi.stopIndexing()
if (result.success) {
  console.log('文件索引已停止')
}
```

## 快速搜索 vs 标准搜索的区别

### 快速搜索（Quick Search）
- **用途**: 实时搜索，用户输入时即时显示结果
- **特点**: 
  - 响应速度快，适合实时搜索
  - 按相关性排序
  - 支持搜索语法（如 `*.pdf`、`path:documents`）
  - 参数简单，只支持关键词和数量限制
- **适用场景**: 搜索框的实时搜索、快速文件查找

### 标准搜索（Standard Search）
- **用途**: 精确搜索，需要特定条件的搜索
- **特点**:
  - 支持复杂的过滤条件（文件类型、大小范围等）
  - 支持分页
  - 返回总数和分页信息
  - 适合需要精确控制的搜索场景
- **适用场景**: 文件管理器的搜索功能、需要过滤条件的搜索

### 选择建议
- **使用快速搜索**: 当需要实时搜索、简单关键词搜索时
- **使用标准搜索**: 当需要复杂过滤条件、分页功能时

## 完整使用示例

```javascript
class FileIndexManager {
  /**
   * 启动文件索引并监控进度
   */
  async startIndexing() {
    try {
      // 启动索引
      const result = await window.fileIndexApi.indexSystemFiles()
      if (result.success) {
        console.log('文件索引已启动:', result.message)
        
        // 开始监控进度
        this.monitorProgress()
      }
    } catch (error) {
      console.error('启动文件索引失败:', error)
    }
  }

  /**
   * 监控索引进度
   */
  async monitorProgress() {
    const interval = setInterval(async () => {
      try {
        const progress = await window.fileIndexApi.getProgress()
        
        if (progress.isIndexing) {
          console.log(`索引进度: ${progress.percentage}% (${progress.processedFiles}/${progress.totalFiles})`)
        } else {
          console.log('文件索引完成')
          clearInterval(interval)
        }
      } catch (error) {
        console.error('获取进度失败:', error)
        clearInterval(interval)
      }
    }, 1000)
  }

  /**
   * 搜索文件
   */
  async searchFiles(keyword, fileType) {
    try {
      // 使用标准搜索进行精确搜索
      const result = await window.fileIndexApi.search({
        keyword,
        fileType,
        limit: 20
      })
      
      console.log(`找到 ${result.total} 个文件`)
      return result.list
    } catch (error) {
      console.error('搜索失败:', error)
      return []
    }
  }

  /**
   * 快速搜索文件
   */
  async quickSearchFiles(keyword) {
    try {
      // 使用快速搜索进行实时搜索
      const results = await window.fileIndexApi.quickSearch({
        keyword,
        limit: 10
      })
      
      console.log(`快速搜索找到 ${results.length} 个文件`)
      return results
    } catch (error) {
      console.error('快速搜索失败:', error)
      return []
    }
  }
}

// 使用示例
const fileManager = new FileIndexManager()

// 启动索引
await fileManager.startIndexing()

// 搜索 PDF 文件
const pdfFiles = await fileManager.searchFiles('document', 'pdf')

// 快速搜索
const quickResults = await fileManager.quickSearchFiles('*.txt')
```

## 注意事项

1. **索引范围**: 系统会自动排除系统文件和开发依赖文件，确保索引效率
2. **性能考虑**: 首次索引可能需要较长时间，建议在系统空闲时进行
3. **存储空间**: 索引数据会占用一定的存储空间
4. **实时性**: 索引是异步进行的，新文件可能需要一段时间才会被索引
5. **搜索性能**: 快速搜索比标准搜索响应更快，但功能相对简单
