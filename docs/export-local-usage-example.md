# 画布导出功能使用示例

## 功能概述

画布导出功能已经优化，解决了以下问题：

1. **关联卡片数据完整**：使用 `batchGetFullCards` 获取所有类型的完整卡片数据
2. **用户选择导出位置**：通过保存文件对话框让用户选择导出位置

## 主要改进

### 1. 完整数据查询

- 创建了 `batchGetFullCards` 函数替代 `batchGetCards`
- 支持所有卡片类型：draw-board, mind-map, multi-table, attachment, card, diary, mark, mermaid
- 获取完整的子表数据和关联信息

### 2. 用户选择导出位置

- 添加了保存文件对话框
- 用户可以选择导出文件的保存位置和文件名
- 支持 ZIP 文件格式过滤

## API 使用示例

### 基本用法

```typescript
// 导出画布，让用户选择保存位置
const result = await window.exportLocalApi.exportCanvas({
  id: 'canvas-card-id',
  exportFileMethod: 'in'  // 导出内部文件
});

if (result.success) {
  console.log('导出成功，文件路径:', result.filePath);
  // 可以打开文件所在目录
  window.systemApi.revealInExplorer(result.filePath);
} else {
  console.error('导出失败:', result.message);
}
```

### 不同文件导出方式

```typescript
// 1. 不导出任何文件
const result1 = await window.exportLocalApi.exportCanvas({
  id: 'canvas-card-id',
  exportFileMethod: 'none'
});

// 2. 只导出内部文件（user-data:// 开头的文件）
const result2 = await window.exportLocalApi.exportCanvas({
  id: 'canvas-card-id',
  exportFileMethod: 'in'
});

// 3. 导出所有文件
const result3 = await window.exportLocalApi.exportCanvas({
  id: 'canvas-card-id',
  exportFileMethod: 'all'
});
```

### 错误处理

```typescript
try {
  const result = await window.exportLocalApi.exportCanvas({
    id: 'canvas-card-id',
    exportFileMethod: 'in'
  });
  
  if (result.success) {
    // 导出成功
    showSuccessMessage('画布导出成功');
    
    // 可选：打开文件所在目录
    window.systemApi.revealInExplorer(result.filePath);
  } else {
    // 业务错误（如用户取消）
    if (result.message === '用户取消了导出') {
      showInfoMessage('已取消导出');
    } else {
      showErrorMessage(result.message || '导出失败');
    }
  }
} catch (error) {
  // 系统错误
  console.error('导出过程中发生错误:', error);
  showErrorMessage('导出过程中发生错误，请重试');
}
```

## 导出流程

1. **用户调用导出 API**
2. **显示保存文件对话框**：用户选择保存位置和文件名
3. **收集卡片信息**：递归收集所有关联卡片的完整信息
4. **收集文件信息**：根据 `exportFileMethod` 收集需要导出的文件
5. **创建临时目录**：在用户存储目录创建临时工作目录
6. **复制文件**：将相关文件复制到临时目录
7. **生成数据文件**：创建包含完整卡片数据的 `card-base.json`
8. **创建 ZIP 文件**：将临时目录打包成 ZIP 文件
9. **保存到用户选择的位置**：将 ZIP 文件保存到用户指定的位置
10. **清理临时文件**：删除临时工作目录

## 导出内容

导出的 ZIP 文件包含：

### 1. card-base.json
包含完整的卡片数据：
- `base-data`: 主画布卡片的完整信息
- `relate-data`: 所有关联卡片的完整信息数组

### 2. files/ 目录
包含所有需要导出的文件（如果选择了文件导出）

## 技术实现

### 完整数据查询

```typescript
// 新的查询函数支持所有卡片类型
export async function batchGetFullCards(ids: string[]) {
  // 查询基础卡片数据
  const cards = await repo.createQueryBuilder('card')
    .where('card.id IN (:...ids)', { ids })
    .andWhere('card.delFlag = :delFlag', { delFlag: 0 })
    .getMany()

  // 根据卡片类型查询对应的子表数据
  for (const card of cards) {
    switch (card.cardType) {
      case 'draw-board':
        // 查询画布数据
        break
      case 'mind-map':
        // 查询思维导图数据
        break
      case 'multi-table':
        // 查询多维表数据
        break
      // ... 其他类型
    }
  }
}
```

### 保存文件对话框

```typescript
// 在导出开始时显示保存对话框
const saveResult = await dialog.showSaveDialog({
  title: '导出画布',
  buttonLabel: '保存',
  defaultPath: `canvas-export-${id}-${Date.now()}.zip`,
  filters: [
    { name: 'ZIP文件', extensions: ['zip'] },
    { name: '所有文件', extensions: ['*'] }
  ]
})
```

## 注意事项

1. **权限要求**：确保应用有写入用户选择目录的权限
2. **文件大小**：复杂画布可能生成较大的 ZIP 文件
3. **循环嵌套**：自动处理画布、思维导图、多维表之间的循环引用
4. **错误处理**：建议始终检查返回的 `success` 字段
5. **用户体验**：导出过程中会显示保存对话框，用户可以选择取消

## 类型定义

```typescript
interface ExportCanvasDto {
  id: string;
  exportFileMethod: 'none' | 'in' | 'all';
}

interface CanvasExportResult {
  success: boolean;
  message?: string;
  filePath?: string;
}
```
