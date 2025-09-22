# Document IPC服务代码重构

## 概述

将document模块的IPC服务代码进行重构，将超过15行代码的接口抽取到service文件夹下，通用方法抽取到util文件夹下，保持index.ts的整洁。

## 重构目标

- **代码组织**: 将复杂的业务逻辑从IPC接口中分离
- **可维护性**: 提高代码的可读性和可维护性
- **复用性**: 将通用功能抽取为可复用的工具函数
- **职责分离**: 明确各模块的职责边界

## 重构结构

### 1. 工具函数 (util/)

#### `file-path.util.ts`
- `getStoragePath()` - 获取存储路径
- `resolveFilePath()` - 处理文件路径（支持user-data://和app://协议）

#### `system.util.ts`
- `getSpecialDirectories()` - 获取系统特殊目录
- `getSystemDrives()` - 获取系统盘符
- `getSystemEncoding()` - 获取系统默认编码
- `getShortcutTarget()` - 获取快捷方式目标路径
- `getFileIcon()` - 获取文件图标
- `cleanupShortcutCache()` - 清理过期的缓存

#### `file.util.ts`
- `isFileReadable()` - 检查文件是否可读
- `isFileWritable()` - 检查文件是否可写
- `detectFileEncoding()` - 获取文件编码
- `getFileInfo()` - 获取文件信息
- `getDirectoryContents()` - 获取目录内容
- `readFileContent()` - 读取文件内容
- `writeFileContent()` - 保存文件内容
- `readFileStream()` - 读取文件流

#### `search.util.ts`
- `extractSnippet()` - 提取包含关键词的文本片段
- `calculateRelevanceScore()` - 计算相关性分数
- `getMimeType()` - 获取MIME类型

### 2. 服务模块 (services/)

#### `document-directory.service.ts`
- `readDirectory()` - 读取目录内容

#### `document-file.service.ts`
- `openFile()` - 打开文件
- `copyFile()` - 复制文件到剪贴板
- `cutFile()` - 剪切文件到剪贴板
- `deleteFile()` - 删除文件
- `readFile()` - 读取文件内容
- `writeFile()` - 保存文件内容
- `readFileStream()` - 读取文件流

#### `document-page.service.ts`
- `getDocumentPages()` - 获取文档页面内容
- `getDocumentPage()` - 获取单个文档页面

#### 现有服务保持不变
- `document-index.service.ts` - 文档索引服务
- `document-fts.service.ts` - 全文搜索服务

### 3. 主入口文件 (index.ts)

重构后的`index.ts`文件：
- 只包含IPC接口定义
- 导入并使用service和util模块
- 保持原有的功能逻辑不变
- 代码行数从1110行减少到约300行

## 重构前后对比

### 重构前
```typescript
// index.ts 包含所有逻辑（1110行）
export function setupDocumentIPC(): void {
  // 所有函数定义都在这里
  function getStoragePath(): string { /* ... */ }
  function resolveFilePath(filePath: string): string { /* ... */ }
  function getSpecialDirectories() { /* ... */ }
  // ... 更多函数定义
  
  // IPC接口
  ipcMain.handle('document:readDirectory', async (event, dirPath) => {
    // 复杂的业务逻辑
  })
}
```

### 重构后
```typescript
// index.ts 只包含IPC接口（约300行）
import { getSpecialDirectories, getSystemDrives } from './util/system.util'
import { readDirectory } from './services/document-directory.service'
import { openFile, readFile } from './services/document-file.service'

export function setupDocumentIPC(): void {
  // 只包含IPC接口定义
  ipcMain.handle('document:readDirectory', async (event, dirPath) => {
    return await readDirectory(dirPath)
  })
}
```

## 优势

### 1. 代码组织
- **模块化**: 功能按职责分离到不同模块
- **可读性**: 主文件更简洁，易于理解
- **可维护性**: 修改某个功能只需要关注对应模块

### 2. 复用性
- **工具函数**: 通用功能可在多个地方复用
- **服务模块**: 业务逻辑可独立测试和使用
- **依赖清晰**: 明确的导入关系

### 3. 测试友好
- **单元测试**: 每个模块可独立测试
- **集成测试**: 可单独测试service层
- **模拟测试**: 易于模拟依赖

### 4. 扩展性
- **新功能**: 添加新功能时只需创建新的service
- **修改功能**: 修改功能时只需关注对应模块
- **重构**: 后续重构更容易进行

## 文件结构

```
src/ipc/document/
├── index.ts                    # 主入口文件（重构后）
├── util/                       # 工具函数
│   ├── file-path.util.ts      # 文件路径处理
│   ├── system.util.ts         # 系统相关功能
│   ├── file.util.ts           # 文件操作
│   └── search.util.ts         # 搜索相关
├── services/                   # 服务模块
│   ├── document-directory.service.ts  # 目录操作
│   ├── document-file.service.ts       # 文件操作
│   ├── document-page.service.ts       # 页面操作
│   ├── document-index.service.ts      # 索引服务（现有）
│   └── document-fts.service.ts        # 搜索服务（现有）
└── entities/                   # 实体定义（现有）
```

## 注意事项

### 1. 导入管理
- 使用相对路径导入
- 避免循环依赖
- 合理使用动态导入（如`resolveFilePath`）

### 2. 错误处理
- 保持原有的错误处理逻辑
- 在service层统一错误处理
- IPC层只做简单的错误传递

### 3. 性能考虑
- 工具函数保持轻量级
- 避免在工具函数中进行复杂计算
- 合理使用缓存机制

### 4. 向后兼容
- 保持所有IPC接口不变
- 保持返回数据结构不变
- 保持错误处理方式不变

## 后续优化建议

1. **类型定义**: 为所有函数添加完整的TypeScript类型定义
2. **单元测试**: 为每个service和util模块编写单元测试
3. **文档完善**: 为每个函数添加详细的JSDoc注释
4. **性能优化**: 对频繁调用的函数进行性能优化
5. **错误处理**: 完善错误处理机制，提供更详细的错误信息

## 总结

通过这次重构，document IPC服务的代码结构更加清晰，职责分离更加明确，为后续的开发和维护奠定了良好的基础。重构过程中保持了所有原有功能不变，确保了向后兼容性。 