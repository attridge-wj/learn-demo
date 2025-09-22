# 文档索引性能优化指南

## 问题分析

当前文档索引服务在处理大文件或大量文件时存在以下性能问题：

1. **同步阻塞**: 索引过程会阻塞主线程，影响其他IPC服务
2. **内存占用**: 大文件处理时占用大量内存
3. **OCR耗时**: 图片OCR识别需要较长时间
4. **无进度反馈**: 用户无法了解索引进度
5. **资源竞争**: 多个文件同时处理时资源竞争激烈

## 优化解决方案

### 1. 异步队列处理

使用任务队列来管理索引任务，避免阻塞主线程：

```typescript
// 异步索引单个文件
await window.electronAPI.invoke('document:indexDocumentAsync', {
  path: 'user-data://documents/example.pdf',
  priority: 1 // 优先级，数字越大优先级越高
})

// 异步索引目录（带进度回调）
await window.electronAPI.invoke('document:indexDirectoryAsync', {
  path: 'user-data://documents/',
  progressCallback: true
})
```

### 2. 进度监控

监听索引进度：

```typescript
// 监听进度事件
window.electronAPI.on('document:indexProgress', (progress) => {
  console.log(`进度: ${progress.current}/${progress.total}`)
  console.log(`当前文件: ${progress.currentFile}`)
  console.log(`成功: ${progress.success}, 失败: ${progress.failed}`)
  console.log(`是否完成: ${progress.isComplete}`)
  
  // 更新UI进度条
  updateProgressBar(progress.current / progress.total * 100)
})
```

### 3. 队列管理

```typescript
// 获取队列状态
const status = await window.electronAPI.invoke('document:getQueueStatus')
console.log('队列长度:', status.queueLength)
console.log('活动任务数:', status.activeTasks)
console.log('是否正在处理:', status.isProcessing)

// 清空队列
await window.electronAPI.invoke('document:clearQueue')
```

### 4. 配置优化

```typescript
// 获取当前配置
const config = await window.electronAPI.invoke('document:getIndexConfig')
console.log('当前配置:', config.config)

// 更新配置
await window.electronAPI.invoke('document:updateIndexConfig', {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxConcurrent: 5, // 5个并发
  batchSize: 20, // 每批20个文件
  timeout: 60000, // 60秒超时
  enableOcr: false, // 禁用OCR
  ocrTimeout: 120000 // OCR 120秒超时
})
```

## 性能优化特性

### 1. 并发控制

- **最大并发数**: 默认3个，可配置
- **避免资源竞争**: 防止过多文件同时处理
- **智能调度**: 按优先级处理任务

### 2. 批量处理

- **批处理大小**: 默认10个文件一批
- **批次间延迟**: 100ms延迟避免过度占用资源
- **控制权让出**: 每5个文件让出控制权

### 3. 超时控制

- **文件处理超时**: 默认30秒
- **OCR超时**: 默认60秒
- **可配置超时**: 根据文件类型动态调整

### 4. 重试机制

- **自动重试**: 失败任务自动重试2次
- **递增延迟**: 重试间隔递增（1秒、2秒）
- **错误记录**: 记录失败原因

### 5. 内存优化

- **文件大小限制**: 默认50MB，可配置
- **深度限制**: 目录递归深度限制10层
- **错误处理**: 优雅处理无法访问的文件

## 使用建议

### 1. 大文件处理

```typescript
// 对于大文件，建议使用异步处理
await window.electronAPI.invoke('document:indexDocumentAsync', {
  path: 'user-data://documents/large-file.pdf',
  priority: 2 // 高优先级
})
```

### 2. 大量文件处理

```typescript
// 对于大量文件，建议分批处理并监控进度
await window.electronAPI.invoke('document:indexDirectoryAsync', {
  path: 'user-data://documents/',
  progressCallback: true
})
```

### 3. 性能调优

```typescript
// 根据系统性能调整配置
await window.electronAPI.invoke('document:updateIndexConfig', {
  maxConcurrent: navigator.hardwareConcurrency || 4, // 根据CPU核心数
  batchSize: 15, // 根据内存大小调整
  timeout: 45000 // 根据文件复杂度调整
})
```

### 4. OCR优化

```typescript
// 如果不需要OCR，可以禁用以提高性能
await window.electronAPI.invoke('document:updateIndexConfig', {
  enableOcr: false
})

// 或者增加OCR超时时间
await window.electronAPI.invoke('document:updateIndexConfig', {
  ocrTimeout: 180000 // 3分钟
})
```

## 监控和调试

### 1. 队列状态监控

```typescript
// 定期检查队列状态
setInterval(async () => {
  const status = await window.electronAPI.invoke('document:getQueueStatus')
  if (status.queueLength > 100) {
    console.warn('队列过长，考虑清空或暂停')
  }
}, 5000)
```

### 2. 性能统计

```typescript
// 获取索引统计
const stats = await window.electronAPI.invoke('document:getIndexStats')
console.log('总文件数:', stats.total)
console.log('已索引:', stats.indexed)
console.log('失败:', stats.failed)
console.log('FTS表大小:', stats.ftsTableSize)
```

### 3. 错误处理

```typescript
// 清理失败的索引
const cleanedCount = await window.electronAPI.invoke('document:cleanupFailedIndexes')
console.log('清理了', cleanedCount, '个失败索引')
```

## 最佳实践

1. **渐进式索引**: 先索引重要文件，再索引其他文件
2. **用户反馈**: 显示进度条和状态信息
3. **资源监控**: 监控CPU和内存使用情况
4. **错误恢复**: 提供重试和清理功能
5. **配置调优**: 根据实际使用情况调整配置参数

## 注意事项

1. **内存使用**: 大量文件索引时注意内存占用
2. **磁盘空间**: 索引数据会占用额外存储空间
3. **网络依赖**: OCR功能首次使用需要下载语言包
4. **权限问题**: 确保有足够的文件访问权限
5. **并发限制**: 避免设置过高的并发数导致系统卡顿 