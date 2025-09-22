# 文件索引使用示例

## 基本使用

### 1. 检查索引状态

```javascript
// 检查文件索引是否已经建立
const checkIndexStatus = async () => {
  try {
    const status = await window.fileIndexApi.getStatus()
    console.log('索引状态:', status)
    
    if (status.isHealthy) {
      console.log(`索引健康，已索引 ${status.indexedFiles} 个文件`)
      return true
    } else {
      console.log('索引不健康，需要重建索引')
      return false
    }
  } catch (error) {
    console.error('检查索引状态失败:', error)
    return false
  }
}
```

### 2. 启动文件索引

```javascript
// 启动异步文件索引
const startFileIndexing = async () => {
  try {
    const result = await window.fileIndexApi.indexSystemFiles()
    if (result.success) {
      console.log('文件索引已开始')
      return true
    } else {
      console.log('启动索引失败:', result.message)
      return false
    }
  } catch (error) {
    console.error('启动索引失败:', error)
    return false
  }
}
```

### 3. 监控索引进度

```javascript
// 监控索引进度
const monitorIndexProgress = () => {
  const progressInterval = setInterval(async () => {
    try {
      const progress = await window.fileIndexApi.getProgress()
      console.log(`索引进度: ${progress.percentage}%`)
      
      // 更新UI进度条
      updateProgressBar(progress.percentage)
      
      if (progress.isComplete || progress.percentage >= 100) {
        clearInterval(progressInterval)
        console.log('索引完成')
        onIndexComplete()
      }
    } catch (error) {
      console.error('获取进度失败:', error)
      clearInterval(progressInterval)
    }
  }, 1000)
  
  return progressInterval
}

// 更新进度条UI
const updateProgressBar = (percentage) => {
  const progressBar = document.getElementById('index-progress-bar')
  if (progressBar) {
    progressBar.style.width = `${percentage}%`
    progressBar.textContent = `${percentage}%`
  }
}
```

### 4. 搜索文件

```javascript
// 搜索文件
const searchFiles = async (keyword, options = {}) => {
  try {
    const searchParams = {
      keyword,
      limit: 20,
      ...options
    }
    
    const result = await window.fileIndexApi.search(searchParams)
    console.log(`找到 ${result.total} 个文件`)
    
    return result
  } catch (error) {
    console.error('搜索失败:', error)
    return { list: [], total: 0 }
  }
}

// 使用示例
const searchExamples = async () => {
  // 搜索所有包含 "document" 的文件
  const allDocs = await searchFiles('document')
  
  // 搜索 PDF 文件
  const pdfFiles = await searchFiles('report', { fileType: 'pdf' })
  
  // 搜索大文件
  const largeFiles = await searchFiles('video', { 
    minSize: 100 * 1024 * 1024, // 100MB
    fileType: 'video' 
  })
  
  // 搜索代码文件
  const codeFiles = await searchFiles('function', { fileType: 'code' })
}
```

## 完整的使用流程

```javascript
class FileIndexManager {
  constructor() {
    this.isIndexing = false
    this.progressInterval = null
  }
  
  // 初始化文件索引
  async initialize() {
    console.log('初始化文件索引...')
    
    // 检查索引状态
    const isHealthy = await this.checkIndexStatus()
    
    if (!isHealthy) {
      // 启动索引
      const started = await this.startIndexing()
      if (started) {
        // 开始监控进度
        this.startProgressMonitoring()
      }
    } else {
      console.log('文件索引已就绪')
      this.onReady()
    }
  }
  
  // 检查索引状态
  async checkIndexStatus() {
    try {
      const status = await window.fileIndexApi.getStatus()
      return status.isHealthy
    } catch (error) {
      console.error('检查索引状态失败:', error)
      return false
    }
  }
  
  // 启动索引
  async startIndexing() {
    try {
      this.isIndexing = true
      const result = await window.fileIndexApi.indexSystemFiles()
      
      if (result.success) {
        console.log('文件索引已开始')
        return true
      } else {
        console.log('启动索引失败:', result.message)
        this.isIndexing = false
        return false
      }
    } catch (error) {
      console.error('启动索引失败:', error)
      this.isIndexing = false
      return false
    }
  }
  
  // 开始监控进度
  startProgressMonitoring() {
    this.progressInterval = setInterval(async () => {
      try {
        const progress = await window.fileIndexApi.getProgress()
        this.updateProgressUI(progress)
        
        if (progress.isComplete || progress.percentage >= 100) {
          this.stopProgressMonitoring()
          this.isIndexing = false
          this.onIndexComplete()
        }
      } catch (error) {
        console.error('获取进度失败:', error)
        this.stopProgressMonitoring()
      }
    }, 1000)
  }
  
  // 停止监控进度
  stopProgressMonitoring() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }
  
  // 更新进度UI
  updateProgressUI(progress) {
    // 更新进度条
    const progressBar = document.getElementById('index-progress-bar')
    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`
      progressBar.textContent = `${progress.percentage}%`
    }
    
    // 更新状态文本
    const statusText = document.getElementById('index-status-text')
    if (statusText) {
      statusText.textContent = `正在索引: ${progress.currentFile}`
    }
  }
  
  // 索引完成回调
  onIndexComplete() {
    console.log('文件索引完成')
    this.onReady()
  }
  
  // 索引就绪回调
  onReady() {
    console.log('文件索引已就绪，可以开始搜索')
    // 这里可以启用搜索功能
    this.enableSearch()
  }
  
  // 启用搜索功能
  enableSearch() {
    const searchInput = document.getElementById('file-search-input')
    const searchButton = document.getElementById('file-search-button')
    
    if (searchInput && searchButton) {
      searchInput.disabled = false
      searchButton.disabled = false
      
      // 绑定搜索事件
      searchButton.addEventListener('click', () => {
        this.performSearch(searchInput.value)
      })
    }
  }
  
  // 执行搜索
  async performSearch(keyword) {
    if (!keyword.trim()) return
    
    try {
      const result = await window.fileIndexApi.search({
        keyword: keyword.trim(),
        limit: 50
      })
      
      this.displaySearchResults(result)
    } catch (error) {
      console.error('搜索失败:', error)
      this.displayError('搜索失败: ' + error.message)
    }
  }
  
  // 显示搜索结果
  displaySearchResults(result) {
    const resultsContainer = document.getElementById('search-results')
    if (!resultsContainer) return
    
    resultsContainer.innerHTML = ''
    
    if (result.total === 0) {
      resultsContainer.innerHTML = '<p>没有找到匹配的文件</p>'
      return
    }
    
    const resultsList = document.createElement('div')
    resultsList.className = 'search-results-list'
    
    result.list.forEach(file => {
      const fileItem = this.createFileItem(file)
      resultsList.appendChild(fileItem)
    })
    
    resultsContainer.appendChild(resultsList)
    
    // 显示总数
    const totalInfo = document.createElement('p')
    totalInfo.textContent = `找到 ${result.total} 个文件`
    resultsContainer.appendChild(totalInfo)
  }
  
  // 创建文件项
  createFileItem(file) {
    const item = document.createElement('div')
    item.className = 'file-item'
    
    const fileName = document.createElement('div')
    fileName.className = 'file-name'
    fileName.textContent = file.fileName
    
    const filePath = document.createElement('div')
    filePath.className = 'file-path'
    filePath.textContent = file.filePath
    
    const fileInfo = document.createElement('div')
    fileInfo.className = 'file-info'
    fileInfo.textContent = `${file.fileType} • ${this.formatFileSize(file.fileSize)}`
    
    item.appendChild(fileName)
    item.appendChild(filePath)
    item.appendChild(fileInfo)
    
    // 点击打开文件
    item.addEventListener('click', () => {
      this.openFile(file.filePath)
    })
    
    return item
  }
  
  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  // 打开文件
  openFile(filePath) {
    // 这里可以调用系统API打开文件
    console.log('打开文件:', filePath)
    // window.systemApi.openFile(filePath)
  }
  
  // 显示错误信息
  displayError(message) {
    const errorContainer = document.getElementById('error-message')
    if (errorContainer) {
      errorContainer.textContent = message
      errorContainer.style.display = 'block'
      
      setTimeout(() => {
        errorContainer.style.display = 'none'
      }, 5000)
    }
  }
}

// 使用示例
const fileIndexManager = new FileIndexManager()

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  fileIndexManager.initialize()
})
```

## HTML 模板示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>文件索引搜索</title>
    <style>
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .progress-container {
            margin: 20px 0;
            display: none;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
            text-align: center;
            line-height: 20px;
            color: white;
        }
        
        .search-container {
            margin: 20px 0;
        }
        
        .search-input {
            width: 70%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .search-button {
            width: 25%;
            padding: 10px;
            margin-left: 5%;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .search-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        
        .file-item {
            padding: 10px;
            border: 1px solid #ddd;
            margin: 5px 0;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .file-item:hover {
            background-color: #f5f5f5;
        }
        
        .file-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .file-path {
            color: #666;
            font-size: 12px;
            margin-bottom: 5px;
        }
        
        .file-info {
            color: #999;
            font-size: 11px;
        }
        
        .error-message {
            color: red;
            padding: 10px;
            background-color: #ffebee;
            border-radius: 4px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>文件索引搜索</h1>
        
        <!-- 进度条 -->
        <div class="progress-container" id="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="index-progress-bar">0%</div>
            </div>
            <p id="index-status-text">准备中...</p>
        </div>
        
        <!-- 搜索区域 -->
        <div class="search-container">
            <input type="text" id="file-search-input" placeholder="输入关键词搜索文件..." disabled>
            <button id="file-search-button" disabled>搜索</button>
        </div>
        
        <!-- 错误信息 -->
        <div class="error-message" id="error-message"></div>
        
        <!-- 搜索结果 -->
        <div id="search-results"></div>
    </div>
    
    <script src="file-index-manager.js"></script>
</body>
</html>
```

## 注意事项

1. **错误处理**: 所有API调用都应该包含适当的错误处理
2. **用户体验**: 在索引过程中提供清晰的进度反馈
3. **性能优化**: 大量文件索引时考虑分批处理和进度更新
4. **权限问题**: 某些系统目录可能需要特殊权限
5. **内存管理**: 及时清理定时器和事件监听器
