# 画布副本导入功能使用示例

## 功能概述

画布副本导入功能允许用户将之前导出的画布副本（ZIP 文件）重新导入到系统中，恢复画布及其关联卡片的数据。

## 主要特性

1. **文件选择**：自动弹出文件选择对话框，用户选择要导入的 ZIP 文件
2. **ZIP 文件解压**：自动解压包含 `card-base.json` 和 `files` 目录的 ZIP 文件
3. **文件处理**：将 `files` 目录中的文件复制到用户数据存储目录的 `files` 文件夹
4. **导入模式**：支持跳过模式和覆盖模式两种导入方式
5. **数据入库**：将卡片数据导入到数据库，支持重复数据检测和覆盖
6. **空间归属**：自动将所有卡片的 `spaceId` 替换为当前用户的空间ID
7. **字段序列化**：自动将对象字段（如 `extraData`、`content`、`viewList` 等）序列化为 JSON 字符串
8. **错误处理**：完善的错误处理和临时文件清理机制

## API 接口

### 导入画布副本

```typescript
// 导入画布副本（跳过模式）
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

if (result.success) {
  console.log('导入成功')
  console.log('主卡片ID:', result.data?.baseCardId)
  console.log('导入卡片数量:', result.data?.importedCount)
  console.log('跳过卡片数量:', result.data?.skippedCount)
  console.log('覆盖卡片数量:', result.data?.overwrittenCount)
} else {
  console.error('导入失败:', result.message)
}
```

## 使用流程

### 1. 跳过模式导入

```typescript
// 跳过模式：如果数据已存在则跳过
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

if (result.success) {
  alert(`导入成功！\n主卡片ID: ${result.data?.baseCardId}\n导入卡片: ${result.data?.importedCount} 个\n跳过卡片: ${result.data?.skippedCount} 个`)
} else {
  alert(`导入失败: ${result.message}`)
}
```

### 2. 覆盖模式导入

```typescript
// 覆盖模式：如果数据已存在则覆盖
const result = await window.exportLocalApi.importCanvas({
  importMode: 'overwrite'
})

if (result.success) {
  alert(`导入成功！\n主卡片ID: ${result.data?.baseCardId}\n导入卡片: ${result.data?.importedCount} 个\n跳过卡片: ${result.data?.skippedCount} 个\n覆盖卡片: ${result.data?.overwrittenCount} 个`)
} else {
  alert(`导入失败: ${result.message}`)
}
```

### 3. 完整示例

```typescript
async function importCanvasBackup(importMode: 'skip' | 'overwrite' = 'skip') {
  try {
    // 执行导入（会自动弹出文件选择对话框）
    console.log('开始导入画布副本...')
    const importResult = await window.exportLocalApi.importCanvas({
      importMode: importMode
    })

    // 处理结果
    if (importResult.success) {
      console.log('导入成功!')
      console.log('主卡片ID:', importResult.data?.baseCardId)
      console.log('导入卡片数量:', importResult.data?.importedCount)
      console.log('跳过卡片数量:', importResult.data?.skippedCount)
      console.log('覆盖卡片数量:', importResult.data?.overwrittenCount)
      
      // 可以在这里刷新界面或跳转到导入的卡片
      // 例如：跳转到主卡片
      // window.location.href = `/card/${importResult.data?.baseCardId}`
    } else {
      console.error('导入失败:', importResult.message)
      alert(`导入失败: ${importResult.message}`)
    }
  } catch (error) {
    console.error('导入过程中发生错误:', error)
    alert('导入过程中发生错误，请重试')
  }
}

// 绑定到按钮点击事件
document.getElementById('importSkipButton')?.addEventListener('click', () => importCanvasBackup('skip'))
document.getElementById('importOverwriteButton')?.addEventListener('click', () => importCanvasBackup('overwrite'))
```

## 数据结构

### ImportCanvasDto

```typescript
interface ImportCanvasDto {
  importMode: 'skip' | 'overwrite';  // 导入模式：跳过或覆盖
}
```

### CanvasImportResult

```typescript
interface CanvasImportResult {
  success: boolean;  // 是否成功
  message?: string;  // 结果消息
  data?: {
    baseCardId: string;        // 主卡片ID
    importedCount: number;     // 导入的卡片数量
    skippedCount: number;      // 跳过的卡片数量（重复数据）
    overwrittenCount: number;  // 覆盖的卡片数量
  };
}
```

## 注意事项

1. **文件格式**：导入的 ZIP 文件必须包含 `card-base.json` 文件和 `files` 目录
2. **导入模式**：
   - **跳过模式**：如果数据已存在则跳过（不覆盖）
   - **覆盖模式**：如果数据已存在则覆盖（先删除子表数据，再删除主表数据，然后重新创建）
3. **文件冲突**：
   - **跳过模式**：如果用户数据目录的 `files` 文件夹中已存在同名文件，将跳过该文件
   - **覆盖模式**：如果用户数据目录的 `files` 文件夹中已存在同名文件，将覆盖该文件
4. **文件位置**：所有文件都会复制到用户数据存储目录的 `files` 文件夹中
5. **空间归属**：导入的所有卡片都会自动归属到当前用户的空间，源数据的 `spaceId` 会被替换
6. **空间要求**：导入前必须确保用户已选择空间，否则导入会失败
7. **字段处理**：对象类型字段（如 `extraData`、`content`、`viewList`、`data`、`attrList`、`markList`、`cardMap`、`config`）会自动序列化为 JSON 字符串
8. **权限要求**：需要文件系统读写权限
9. **存储空间**：确保有足够的存储空间用于解压和文件复制

## 错误处理

导入过程中可能遇到的错误：

- `压缩包中缺少 card-base.json 文件`：ZIP 文件格式不正确
- `card-base.json 文件格式不正确`：JSON 文件内容不符合预期格式
- `未找到当前用户的空间ID，请先选择空间`：用户未选择空间
- `导入失败`：数据库操作或其他系统错误

建议在调用时添加适当的错误处理和用户提示。
