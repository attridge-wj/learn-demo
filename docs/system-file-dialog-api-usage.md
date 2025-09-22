# 系统文件对话框 API 使用说明

本文档介绍如何使用系统模块中的文件对话框功能，包括选择文件夹和选择文件的API调用方法。

## 概述

系统模块提供了两个主要的文件对话框功能：
- `selectFolder()`: 选择文件夹弹框
- `selectFile(options)`: 选择文件弹框

这些功能通过 Electron 的 `dialog.showOpenDialog` API 实现，支持跨平台（Windows、macOS、Linux）。

## API 接口

### 1. 选择文件夹 (selectFolder)

#### 功能描述
打开系统文件夹选择对话框，允许用户选择一个文件夹。

#### 调用方法
```typescript
const result = await window.systemApi.selectFolder()
```

#### 参数
无参数

#### 返回值
```typescript
{
  success: boolean;        // 是否成功选择
  data?: string;          // 选中的文件夹路径（成功时）
  message?: string;       // 错误信息或取消信息（失败时）
}
```

#### 使用示例
```typescript
// 基础用法
const result = await window.systemApi.selectFolder()

if (result.success) {
  console.log('选中的文件夹路径:', result.data)
  // 使用选中的文件夹路径进行后续操作
} else {
  console.log('用户取消选择或发生错误:', result.message)
}
```

### 2. 选择文件 (selectFile)

#### 功能描述
打开系统文件选择对话框，允许用户选择一个或多个文件。

#### 调用方法
```typescript
const result = await window.systemApi.selectFile(options)
```

#### 参数
```typescript
interface SelectFileOptions {
  title?: string;                                    // 弹框标题
  buttonLabel?: string;                              // 按钮文字
  filters?: Array<{                                  // 文件类型过滤器
    name: string;                                    // 过滤器名称
    extensions: string[];                            // 文件扩展名数组
  }>;
  multiSelections?: boolean;                         // 是否支持多选
}
```

#### 返回值
```typescript
{
  success: boolean;        // 是否成功选择
  data?: string | string[]; // 选中的文件路径（单个文件为string，多个文件为string[]）
  message?: string;        // 错误信息或取消信息（失败时）
}
```

#### 使用示例

##### 基础用法：选择任意文件
```typescript
const result = await window.systemApi.selectFile()

if (result.success) {
  const filePath = result.data as string
  console.log('选中的文件:', filePath)
}
```

##### 选择特定类型文件
```typescript
const result = await window.systemApi.selectFile({
  title: '选择图片文件',
  buttonLabel: '选择图片',
  filters: [
    { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
    { name: '所有文件', extensions: ['*'] }
  ]
})

if (result.success) {
  const filePath = result.data as string
  console.log('选中的图片文件:', filePath)
}
```

##### 选择文档文件
```typescript
const result = await window.systemApi.selectFile({
  title: '选择文档文件',
  buttonLabel: '选择文档',
  filters: [
    { name: 'Word文档', extensions: ['doc', 'docx'] },
    { name: 'PDF文档', extensions: ['pdf'] },
    { name: '文本文件', extensions: ['txt', 'md'] },
    { name: '所有文件', extensions: ['*'] }
  ]
})

if (result.success) {
  const filePath = result.data as string
  console.log('选中的文档文件:', filePath)
}
```

##### 多选文件
```typescript
const result = await window.systemApi.selectFile({
  multiSelections: true,
  title: '选择多个文件',
  buttonLabel: '选择文件',
  filters: [
    { name: '图片文件', extensions: ['jpg', 'png', 'gif'] },
    { name: '文档文件', extensions: ['pdf', 'doc', 'txt'] }
  ]
})

if (result.success) {
  const filePaths = result.data as string[]
  console.log('选中的文件数量:', filePaths.length)
  filePaths.forEach((path, index) => {
    console.log(`文件 ${index + 1}:`, path)
  })
}
```

##### 选择代码文件
```typescript
const result = await window.systemApi.selectFile({
  title: '选择代码文件',
  buttonLabel: '选择代码',
  filters: [
    { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
    { name: 'Python', extensions: ['py'] },
    { name: 'Java', extensions: ['java'] },
    { name: 'C/C++', extensions: ['c', 'cpp', 'h', 'hpp'] },
    { name: '所有文件', extensions: ['*'] }
  ]
})

if (result.success) {
  const filePath = result.data as string
  console.log('选中的代码文件:', filePath)
}
```

## 常见使用场景

### 1. 导入文件
```typescript
// 选择要导入的文件
const result = await window.systemApi.selectFile({
  title: '选择要导入的文件',
  buttonLabel: '导入',
  filters: [
    { name: '支持的文件', extensions: ['json', 'csv', 'txt'] }
  ]
})

if (result.success) {
  const filePath = result.data as string
  // 执行文件导入逻辑
  await importFile(filePath)
}
```

### 2. 选择工作目录
```typescript
// 选择工作目录
const result = await window.systemApi.selectFolder()

if (result.success) {
  const folderPath = result.data as string
  // 设置工作目录
  setWorkingDirectory(folderPath)
}
```

### 3. 批量文件处理
```typescript
// 选择多个文件进行批量处理
const result = await window.systemApi.selectFile({
  multiSelections: true,
  title: '选择要处理的文件',
  buttonLabel: '开始处理',
  filters: [
    { name: '图片文件', extensions: ['jpg', 'png'] }
  ]
})

if (result.success) {
  const filePaths = result.data as string[]
  // 批量处理文件
  await batchProcessFiles(filePaths)
}
```

## 错误处理

### 用户取消选择
```typescript
const result = await window.systemApi.selectFile()

if (!result.success && result.message === '用户取消了选择') {
  // 用户主动取消，不需要特殊处理
  console.log('用户取消了文件选择')
} else if (!result.success) {
  // 其他错误情况
  console.error('选择文件失败:', result.message)
}
```

### 异常处理
```typescript
try {
  const result = await window.systemApi.selectFile()
  
  if (result.success) {
    // 处理成功情况
    handleFileSelection(result.data)
  } else {
    // 处理失败情况
    showErrorMessage(result.message)
  }
} catch (error) {
  console.error('调用文件选择API失败:', error)
  showErrorMessage('系统错误，无法打开文件选择对话框')
}
```

## 注意事项

1. **异步调用**: 所有API都是异步的，需要使用 `await` 或 `.then()` 处理
2. **路径格式**: 返回的路径是系统原生路径格式，Windows 使用反斜杠 `\`，macOS/Linux 使用正斜杠 `/`
3. **权限问题**: 在某些系统上，可能需要用户授权才能访问特定目录
4. **文件过滤器**: 过滤器只影响显示，用户仍可通过"所有文件"选项选择其他类型文件
5. **多选限制**: 多选模式下，`data` 字段始终是数组，即使只选择一个文件

## 兼容性

- **Windows**: 支持 Windows 7 及以上版本
- **macOS**: 支持 macOS 10.10 及以上版本  
- **Linux**: 支持主流 Linux 发行版
- **Electron**: 需要 Electron 12.0 及以上版本

## 相关链接

- [Electron Dialog API 文档](https://www.electronjs.org/docs/latest/api/dialog)
- [系统模块 IPC 配置](../src/ipc/system/index.ts)
- [文件打开服务](../src/ipc/system/services/file-open.service.ts)
- [Preload 脚本](../src/preload.ts)
