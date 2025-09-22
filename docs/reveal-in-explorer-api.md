# Reveal in Explorer API 文档

## 概述

`system:revealInExplorer` IPC服务用于在系统资源管理器中打开指定目录，类似于VS Code中的"Reveal in File Explorer"功能。该服务支持Windows、macOS和Linux平台，并兼容自定义协议路径。

## API 接口

### 方法名
`system:revealInExplorer`

### 参数
- `dirPath` (string): 要打开的目录或文件路径
  - 支持绝对路径和相对路径
  - 支持自定义协议：`user-data://` 和 `app://`
  - 如果是文件路径，会打开文件所在的目录

### 返回值
```typescript
interface RevealInExplorerResult {
  success: boolean;
  message?: string;
  error?: string;
  path?: string;
  isFile?: boolean;
}
```

#### 成功响应
```typescript
{
  success: true,
  message: "在资源管理器中打开目录成功",
  path: "/resolved/path",
  isFile: false
}
```

#### 错误响应
```typescript
{
  success: false,
  error: "错误描述"
}
```

## 使用示例

### 基本用法
```typescript
// 打开普通目录
const result = await window.electronAPI.invoke('system:revealInExplorer', '/path/to/directory');

// 打开文件所在目录
const result = await window.electronAPI.invoke('system:revealInExplorer', '/path/to/file.txt');

// 使用相对路径
const result = await window.electronAPI.invoke('system:revealInExplorer', './relative/path');
```

### 自定义协议支持
```typescript
// 使用 user-data 协议
const result = await window.electronAPI.invoke('system:revealInExplorer', 'user-data://documents');

// 使用 app 协议
const result = await window.electronAPI.invoke('system:revealInExplorer', 'app://C:/Users/username/Documents');
```

## 平台支持

### Windows
- 使用 `explorer` 命令
- 支持 `/select` 参数，可以选中指定文件
- 兼容Windows 10/11

### macOS
- 使用 `open -R` 命令
- 在Finder中显示文件/文件夹位置
- 兼容macOS 10.12+

### Linux
- 支持多种文件管理器：
  - `xdg-open` (通用)
  - `nautilus` (GNOME)
  - `dolphin` (KDE)
  - `thunar` (Xfce)
  - `pcmanfm` (LXDE)
  - `caja` (MATE)
- 自动检测并使用第一个可用的文件管理器

## 错误处理

### 常见错误
1. **路径不存在**: 指定的路径不存在
2. **无效协议**: 不支持的协议格式
3. **文件管理器不可用**: Linux系统上未找到可用的文件管理器
4. **系统错误**: 操作系统级别的错误

### 错误处理示例
```typescript
try {
  const result = await window.electronAPI.invoke('system:revealInExplorer', path);
  
  if (result.success) {
    console.log('成功打开目录:', result.message);
  } else {
    console.error('打开目录失败:', result.error);
    // 显示用户友好的错误信息
    showErrorMessage(result.error);
  }
} catch (error) {
  console.error('IPC调用失败:', error);
}
```

## 安全考虑

1. **路径验证**: 自动验证路径是否存在
2. **协议安全**: 只支持预定义的安全协议
3. **目录穿越防护**: 防止恶意路径访问
4. **错误信息**: 不暴露敏感的系统信息

## 性能说明

- 异步执行，不会阻塞主进程
- 文件系统操作使用 `fs-extra` 进行优化
- 支持大目录的快速打开
- 内存占用较低

## 注意事项

1. 在Linux系统上，如果用户没有安装任何支持的文件管理器，操作会失败
2. 某些Linux发行版可能需要额外的权限来执行文件管理器命令
3. 在macOS上，如果文件在隐藏目录中，可能需要额外的权限
4. 建议在UI中提供适当的加载状态和错误提示 