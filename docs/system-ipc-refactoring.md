# System IPC服务代码重构

## 概述

将system模块的IPC服务代码进行重构，将超过15行代码的接口抽取到service文件夹下，通用方法抽取到util文件夹下，保持index.ts的整洁。

## 重构目标

- **代码组织**: 将复杂的业务逻辑从IPC接口中分离
- **可维护性**: 提高代码的可读性和可维护性
- **复用性**: 将通用功能抽取为可复用的工具函数
- **职责分离**: 明确各模块的职责边界

## 重构结构

### 1. 工具函数 (util/)

#### `protocol.util.ts`
- `resolveProtocolPath()` - 通用的协议路径解析函数（支持user-data://和app://协议）

#### 现有工具保持不变
- `deviceInfo.ts` - 设备信息相关功能

### 2. 服务模块 (services/)

#### `file-open.service.ts`
- `openFileWithSystemApp()` - 通过路径使用本地应用打开文件

#### `image.service.ts`
- `getImageBase64()` - 获取图片base64数据

#### `url.service.ts`
- `openUrl()` - 打开http/https链接

#### `device-info.service.ts`
- `getSystemDeviceInfo()` - 获取设备信息

#### `reveal-explorer.service.ts`
- `revealInExplorer()` - 在系统资源管理器中打开指定目录

#### `directory-structure.service.ts`
- `getDirectoryStructure()` - 获取文件夹目录结构

### 3. 主入口文件 (index.ts)

重构后的`index.ts`文件：
- 只包含IPC接口定义
- 导入并使用service和util模块
- 保持原有的功能逻辑不变
- 代码行数从690行减少到约60行

## 重构前后对比

### 重构前
```typescript
// index.ts 包含所有逻辑（690行）
export function setupSystemIPC(): void {
  // 所有函数定义都在这里
  function resolveProtocolPath(protocolUrl: string): string | null { /* ... */ }
  // ... 更多函数定义
  
  // IPC接口
  ipcMain.handle('system:openFile', async (event, filePathParam) => {
    // 复杂的业务逻辑
  })
}
```

### 重构后
```typescript
// index.ts 只包含IPC接口（约60行）
import { openFileWithSystemApp } from './services/file-open.service'
import { getImageBase64 } from './services/image.service'
// ... 其他导入

export function setupSystemIPC(): void {
  // 只包含IPC接口定义
  ipcMain.handle('system:openFile', async (event, filePathParam) => {
    return await openFileWithSystemApp(filePathParam);
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
src/ipc/system/
├── index.ts                    # 主入口文件（重构后）
├── util/                       # 工具函数
│   ├── protocol.util.ts       # 协议路径处理
│   └── deviceInfo.ts          # 设备信息（现有）
└── services/                   # 服务模块
    ├── file-open.service.ts    # 文件打开
    ├── image.service.ts        # 图片处理
    ├── url.service.ts          # URL处理
    ├── device-info.service.ts  # 设备信息
    ├── reveal-explorer.service.ts  # 资源管理器
    └── directory-structure.service.ts  # 目录结构
```

## 删除的冗余代码

### 1. 重复的函数定义
- 删除了index.ts中重复的`resolveProtocolPath`函数定义
- 该函数已抽取到`util/protocol.util.ts`中

### 2. 不需要的导入
- 删除了`clipboard`、`shell`、`fse`、`path`等不再直接使用的导入
- 删除了`getDefaultStoragePath`、`getDeviceInfo`、`generateDeviceFingerprint`、`toUnicode`等导入
- 删除了`resolveProtocolPath`的导入（因为不再直接使用）

### 3. 冗余的工具文件
- 删除了`util/image.util.ts`，因为逻辑已直接放在`services/image.service.ts`中

## 注意事项

### 1. 导入管理
- 使用相对路径导入
- 避免循环依赖
- 合理使用service层封装

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

通过这次重构，system IPC服务的代码结构更加清晰，职责分离更加明确，为后续的开发和维护奠定了良好的基础。重构过程中保持了所有原有功能不变，确保了向后兼容性。同时删除了冗余代码，提高了代码的整洁性和可维护性。 