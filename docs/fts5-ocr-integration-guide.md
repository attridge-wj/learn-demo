# FTS5 + OCR 文档索引系统完整指南

## 概述

本系统实现了基于 SQLite FTS5 的高性能全文检索和基于 Tesseract.js 的图片OCR文字识别功能，支持多种文档格式的内容提取和智能搜索。

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   主表          │    │   FTS5虚拟表    │    │   OCR服务       │
│ document_index  │◄──►│ document_index_fts│◄──►│ Tesseract.js   │
│ (元数据)        │    │ (全文内容)      │    │ (图片识别)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 安装依赖

### 1. 安装文档处理库

```bash
npm install pdf-parse@^1.1.1 mammoth@^1.6.0 xlsx@^0.18.5 officegen@^0.6.5
```

### 2. 安装OCR和元数据库

```bash
npm install tesseract.js@^5.0.4 exif-reader@^1.0.3
```

### 3. 确保SQLite支持FTS5

```bash
# 检查SQLite版本（需要3.9.0+）
sqlite3 --version
```

## 功能特性

### 支持的文档类型

| 类型 | 扩展名 | 处理方式 | 说明 |
|------|--------|----------|------|
| 文本文件 | .txt, .md, .json, .xml, .html, .css, .js, .ts, .py, .java, .cpp, .c, .h, .sql, .log, .csv | 直接读取 | 支持多种编码自动检测 |
| PDF文档 | .pdf | pdf-parse | 提取纯文本内容 |
| Word文档 | .doc, .docx | mammoth | 转换为纯文本 |
| PowerPoint | .ppt, .pptx | officegen | 提取幻灯片文本 |
| Excel文档 | .xls, .xlsx | xlsx | 提取表格数据 |
| 图片文件 | .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg, .tiff, .tif | Tesseract.js OCR | 文字识别 + 元数据备选 |

### OCR功能特性

- **多语言支持**: 中文简体 + 英文
- **智能降级**: OCR失败时自动使用EXIF元数据
- **参数优化**: 针对不同图片类型优化识别参数
- **异步处理**: 后台异步识别，不阻塞主线程

### FTS5搜索特性

- **倒排索引**: 极快的全文检索性能
- **相关性排序**: 基于FTS5 rank算法的智能排序
- **片段提取**: 自动提取包含关键词的文本片段
- **关键词高亮**: 在搜索结果中高亮匹配的关键词

## 使用方法

### 1. 初始化服务

```typescript
// 在应用启动时初始化
const documentIndexService = new DocumentIndexService()
await documentIndexService.initialize()
```

### 2. 索引文档

```typescript
// 索引单个文件
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://documents/example.pdf')

// 索引整个目录
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://documents/')

// 索引图片（自动OCR）
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://images/screenshot.png')
```

### 3. 搜索文档

```typescript
// 全文搜索（包括图片中的文字）
const searchResult = await window.electronAPI.invoke('document:searchDocuments', {
  keyword: '关键词',
  limit: 50
})

// 搜索结果格式
{
  success: true,
  results: [
    {
      id: 1,
      fileName: 'example.pdf',
      filePath: 'user-data://documents/example.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      fileModifiedTime: '2024-01-01T00:00:00.000Z',
      protocol: 'user-data',
      snippet: '...包含关键词的文本片段...',
      relevanceScore: 85.5,
      rank: 0.1
    }
  ],
  total: 1,
  keyword: '关键词'
}
```

### 4. 管理索引

```typescript
// 获取索引统计
const stats = await window.electronAPI.invoke('document:getIndexStats')
// 返回: { total: 100, indexed: 95, failed: 5, ftsTableSize: 95 }

// 清理失败的索引
const result = await window.electronAPI.invoke('document:cleanupFailedIndexes')

// 重建FTS索引
const result = await window.electronAPI.invoke('document:rebuildFtsIndex')

// 优化FTS索引
const result = await window.electronAPI.invoke('document:optimizeFtsIndex')
```

## 性能优化

### 1. FTS5优化

```sql
-- 定期优化FTS索引
INSERT INTO document_index_fts(document_index_fts) VALUES('optimize');

-- 使用合适的查询语法
-- 中文精确匹配
SELECT * FROM document_index_fts WHERE content MATCH '"关键词"'

-- 英文前缀匹配
SELECT * FROM document_index_fts WHERE content MATCH 'keyword*'
```

### 2. OCR优化

```typescript
// 设置OCR参数以提高准确率
await worker.setParameters({
  tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\u4e00-\u9fff',
  tessedit_pageseg_mode: '6',
  preserve_interword_spaces: '1'
})
```

### 3. 批量处理

```typescript
// 分批处理大量文件，避免内存溢出
const batchSize = 10
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize)
  await Promise.all(batch.map(file => documentIndexService.indexFile(file)))
}
```

## 错误处理

### 1. OCR失败处理

```typescript
try {
  const content = await extractImageContent(filePath)
} catch (error) {
  // 自动降级到EXIF元数据
  const fallbackContent = await extractImageMetadata(filePath)
}
```

### 2. 文件读取失败

```typescript
// 记录失败原因，便于后续重试
await this.repository.update(existingIndex.id, {
  indexStatus: 2,
  indexError: error.message,
  lastIndexTime: new Date()
})
```

## 监控和维护

### 1. 索引状态监控

```typescript
// 定期检查索引状态
const stats = await documentIndexService.getIndexStats()
if (stats.failed > stats.total * 0.1) {
  // 失败率超过10%，需要检查
  console.warn('索引失败率过高:', stats.failed / stats.total)
}
```

### 2. 性能监控

```typescript
// 监控搜索性能
const startTime = Date.now()
const results = await documentIndexService.searchDocuments(keyword)
const searchTime = Date.now() - startTime
console.log(`搜索耗时: ${searchTime}ms, 结果数: ${results.length}`)
```

## 注意事项

1. **首次OCR**: 首次使用OCR功能时会下载语言包，需要网络连接
2. **内存使用**: OCR识别过程会占用较多内存，建议分批处理
3. **存储空间**: FTS索引会占用额外存储空间，定期清理无用索引
4. **文件大小**: 单个文件限制50MB，避免处理过大的文件
5. **编码支持**: 自动检测文件编码，支持UTF-8、GBK、GB2312、Big5等

## 故障排除

### 1. OCR识别失败

```bash
# 检查Tesseract.js是否正确安装
npm list tesseract.js

# 检查语言包是否下载
# 语言包通常下载到 ~/.cache/tesseract.js/
```

### 2. FTS5搜索失败

```sql
-- 检查FTS表是否存在
SELECT name FROM sqlite_master WHERE type='table' AND name='document_index_fts';

-- 重建FTS索引
DELETE FROM document_index_fts;
-- 然后重新索引所有文档
```

### 3. 性能问题

```typescript
// 检查索引大小
const stats = await documentIndexService.getIndexStats()
console.log('FTS表大小:', stats.ftsTableSize)

// 如果索引过大，考虑优化
await documentIndexService.optimizeFtsIndex()
```

## 扩展功能

### 1. 添加新的文档类型

```typescript
// 在 SUPPORTED_EXTENSIONS 中添加新类型
const SUPPORTED_EXTENSIONS = {
  // ... 现有类型
  '.epub': 'epub',  // 新增EPUB支持
}

// 添加对应的内容提取函数
async function extractEpubContent(filePath: string): Promise<string> {
  // 实现EPUB内容提取逻辑
}
```

### 2. 自定义OCR参数

```typescript
// 针对特定图片类型优化OCR参数
if (fileType === 'screenshot') {
  await worker.setParameters({
    tessedit_pageseg_mode: '6',  // 统一文本块
    tessedit_ocr_engine_mode: '3'  // 默认模式
  })
}
```

这个完整的FTS5 + OCR系统提供了高性能的文档索引和搜索功能，特别适合需要处理大量文档和图片的应用场景。 