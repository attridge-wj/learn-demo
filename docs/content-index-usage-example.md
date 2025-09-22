# Content Index 全文搜索服务使用指南

## 概述

Content Index 模块提供了基于 SQLite FTS5 的全文搜索功能，支持对卡片的各种内容进行快速搜索。

## 功能特性

- 🔍 **全文搜索**：支持对卡片名称、文本、描述、富文本、文件内容等进行搜索
- 🏢 **空间隔离**：自动使用当前空间ID，确保数据隔离
- ⚡ **高性能**：基于 SQLite FTS5 虚拟表，搜索速度快
- 🎯 **高亮显示**：搜索结果包含关键词高亮
- 📊 **搜索统计**：提供搜索结果数量统计
- 🔧 **索引管理**：支持重建索引、优化索引、查看索引状态

## API 接口

### 基础搜索

```typescript
// 基础搜索（自动使用当前空间）
const result = await window.contentIndexApi.search({
  keyword: '搜索关键词',
  limit: 10,
  offset: 0,
  includeDeleted: false
})

console.log('搜索结果:', result.results)
console.log('总数:', result.total)
```

### 高级搜索

```typescript
// 高级搜索（自动使用当前空间）
const result = await window.contentIndexApi.advancedSearch({
  keyword: '搜索关键词',
  fields: ['name', 'text', 'rich_text'], // 只在指定字段中搜索
  limit: 20,
  offset: 0
})
```

### 搜索统计

```typescript
// 获取搜索结果数量（自动使用当前空间）
const count = await window.contentIndexApi.searchCount({ keyword: '搜索关键词' })
console.log('搜索结果数量:', count)
```

### 索引管理

```typescript
// 获取索引状态（自动使用当前空间）
const status = await window.contentIndexApi.getIndexStatus()
console.log('索引状态:', status)

// 重建索引（自动使用当前空间）
await window.contentIndexApi.rebuildIndex()

// 优化索引
await window.contentIndexApi.optimizeIndex()
```

## 搜索结果字段说明

搜索结果包含以下字段：

- `id`: 卡片 ID
- `name`: 卡片名称
- `text`: 卡片文本内容
- `description`: 卡片描述
- `extra_data`: 额外数据
- `mark_text`: 标记文本
- `rich_text`: 富文本内容
- `file_content`: 文件内容
- `drawboard_content`: 画板内容
- `mind_map_content`: 思维导图内容
- `highlight`: 高亮显示的匹配内容
- `rank`: 搜索排名（数值越小越相关）

## 使用示例

### 1. 简单搜索

```typescript
async function simpleSearch() {
  try {
    // 搜索（自动使用当前空间）
    const result = await window.contentIndexApi.search({
      keyword: '项目',
      limit: 10
    })
    
    console.log('搜索结果:', result.results.length)
    
    // 显示结果
    result.results.forEach(item => {
      console.log(`卡片: ${item.name}`)
      console.log(`高亮: ${item.highlight}`)
      console.log(`排名: ${item.rank}`)
    })
  } catch (error) {
    console.error('搜索失败:', error)
  }
}
```

### 2. 分页搜索

```typescript
async function paginatedSearch(keyword: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize
  
  const result = await window.contentIndexApi.search({
    keyword,
    limit: pageSize,
    offset
  })
  
  return {
    items: result.results,
    total: result.total,
    page,
    pageSize,
    totalPages: Math.ceil(result.total / pageSize)
  }
}
```

### 3. 多字段搜索

```typescript
async function searchInSpecificFields(keyword: string) {
  const result = await window.contentIndexApi.advancedSearch({
    keyword,
    fields: ['name', 'description'], // 只在名称和描述中搜索
    limit: 20
  })
  
  return result.results
}
```

### 4. 索引状态监控

```typescript
async function checkIndexHealth() {
  // 检查索引状态（自动使用当前空间）
  const status = await window.contentIndexApi.getIndexStatus()
  
  if (!status.isHealthy) {
    console.warn('索引状态不健康，建议重建索引')
    console.log(`总记录数: ${status.totalRecords}`)
    console.log(`已索引记录数: ${status.indexedRecords}`)
    console.log(`索引覆盖率: ${(status.indexedRecords / status.totalRecords * 100).toFixed(2)}%`)
  }
  
  return status
}
```

### 5. 错误处理

```typescript
async function safeSearch(keyword: string) {
  try {
    const result = await window.contentIndexApi.search({ keyword })
    return result
  } catch (error) {
    console.error('搜索失败:', error)
    
    // 检查是否是索引问题
    const status = await window.contentIndexApi.getIndexStatus()
    if (!status.isHealthy) {
      console.warn('索引状态异常，尝试重建索引...')
      await window.contentIndexApi.rebuildIndex()
    }
    
    throw error
  }
}
```

## 注意事项

1. **索引初始化**：首次使用前需要确保 FTS 索引已正确初始化
2. **搜索性能**：大量数据时，建议使用分页搜索
3. **索引重建**：重建索引会清空现有索引并重新构建，耗时较长
4. **关键词处理**：FTS5 支持多种搜索语法，如 `"精确短语"`、`AND`、`OR` 等
5. **高亮显示**：高亮内容会自动添加 `<b>` 标签，需要在前端进行 HTML 渲染

## 错误处理

```typescript
async function safeSearch(keyword: string) {
  try {
    const result = await window.contentIndexApi.search({ keyword })
    return result
  } catch (error) {
    console.error('搜索失败:', error)
    
    // 检查是否是索引问题
    const status = await window.contentIndexApi.getIndexStatus()
    if (!status.isHealthy) {
      console.warn('索引状态异常，尝试重建索引...')
      await window.contentIndexApi.rebuildIndex()
    }
    
    throw error
  }
}
```

## 最佳实践

1. **定期检查索引状态**：建议定期检查索引健康状态
2. **合理使用分页**：大量数据时使用分页避免性能问题
3. **缓存搜索结果**：对于重复搜索，可以考虑缓存结果
4. **用户友好的错误处理**：提供清晰的错误提示和恢复建议
5. **搜索建议**：根据用户输入提供搜索建议和自动完成功能 
5. **搜索建议**：根据用户输入提供搜索建议和自动完成功能 
5. **搜索建议**：根据用户输入提供搜索建议和自动完成功能 