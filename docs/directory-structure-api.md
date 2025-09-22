# Directory Structure API 文档

## 概述

`system:getDirectoryStructure` IPC服务用于递归获取指定文件夹的目录结构，并以字符串形式返回格式化的目录树。支持自定义缩进格式、深度限制、文件过滤等功能。

## API 接口

### 方法名
`system:getDirectoryStructure`

### 参数
- `dirPath` (string): 要获取目录结构的文件夹路径
- `options` (object, 可选): 配置选项
  - `indentSize` (number, 可选): 每级缩进的字符数量，默认 2
  - `indentChar` (string, 可选): 缩进字符，默认 '-'
  - `maxDepth` (number, 可选): 最大递归深度，默认 10
  - `includeHidden` (boolean, 可选): 是否包含隐藏文件/文件夹，默认 false
  - `includeFiles` (boolean, 可选): 是否包含文件，默认 true
  - `includeDirectories` (boolean, 可选): 是否包含目录，默认 true
  - `excludePatterns` (string[], 可选): 排除的文件/文件夹模式（正则表达式），默认 []

### 返回值
```typescript
interface DirectoryStructureResult {
  success: boolean;
  data?: string;
  error?: string;
  path?: string;
  totalLines?: number;
  options?: {
    indentSize: number;
    indentChar: string;
    maxDepth: number;
    includeHidden: boolean;
    includeFiles: boolean;
    includeDirectories: boolean;
    excludePatterns: string[];
  };
}
```

#### 成功响应
```typescript
{
  success: true,
  data: "文件夹1\n--文件1\n--文件2\n文件夹2\n--文件夹3\n----文件3",
  path: "/resolved/path",
  totalLines: 6,
  options: {
    indentSize: 2,
    indentChar: "-",
    maxDepth: 10,
    includeHidden: false,
    includeFiles: true,
    includeDirectories: true,
    excludePatterns: []
  }
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
// 获取默认格式的目录结构
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory');

if (result.success) {
  console.log('目录结构:', result.data);
} else {
  console.error('获取失败:', result.error);
}
```

### 自定义缩进格式
```typescript
// 使用4个空格缩进
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  indentSize: 4,
  indentChar: ' '
});

// 使用制表符缩进
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  indentSize: 1,
  indentChar: '\t'
});
```

### 深度限制
```typescript
// 只获取3层深度的目录结构
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  maxDepth: 3
});
```

### 文件过滤
```typescript
// 只包含目录，不包含文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  includeFiles: false,
  includeDirectories: true
});

// 包含隐藏文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  includeHidden: true
});

// 排除特定模式的文件/文件夹
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  excludePatterns: ['node_modules', '\\.git', '\\.DS_Store', '*.log']
});
```

### 自定义协议支持
```typescript
// 使用 user-data 协议
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 'user-data://documents');

// 使用 app 协议
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 'app://C:/Users/username/Documents');
```

## 输出格式示例

### 默认格式（2个'-'缩进）
```
项目文件夹
--src
----components
------Button.tsx
------Header.tsx
----utils
------helper.ts
--public
----index.html
----favicon.ico
--package.json
--README.md
```

### 自定义格式（4个空格缩进）
```
项目文件夹
    src
        components
            Button.tsx
            Header.tsx
        utils
            helper.ts
    public
        index.html
        favicon.ico
    package.json
    README.md
```

### 只显示目录结构
```
项目文件夹
--src
----components
----utils
--public
```

## 高级用法

### 组合配置
```typescript
const result = await window.electronAPI.invoke('system:getDirectoryStructure', '/path/to/directory', {
  indentSize: 3,
  indentChar: '>',
  maxDepth: 5,
  includeHidden: false,
  includeFiles: true,
  includeDirectories: true,
  excludePatterns: [
    'node_modules',
    '\\.git',
    '\\.DS_Store',
    '*.tmp',
    '*.log',
    'dist',
    'build'
  ]
});
```

### 错误处理
```typescript
try {
  const result = await window.electronAPI.invoke('system:getDirectoryStructure', path, options);
  
  if (result.success) {
    // 处理成功结果
    console.log('目录结构:', result.data);
    console.log('总行数:', result.totalLines);
    console.log('使用的选项:', result.options);
  } else {
    // 处理错误
    console.error('获取目录结构失败:', result.error);
    
    // 根据错误类型进行不同处理
    if (result.error.includes('路径不存在')) {
      showErrorMessage('指定的路径不存在');
    } else if (result.error.includes('不是目录')) {
      showErrorMessage('请选择一个文件夹');
    } else {
      showErrorMessage('获取目录结构时发生错误');
    }
  }
} catch (error: any) {
  console.error('IPC调用失败:', error);
  showErrorMessage('系统错误，请重试');
}
```

## 性能说明

### 优化特性
- **异步处理**: 不会阻塞主进程
- **深度限制**: 防止无限递归
- **错误容错**: 跳过无法访问的文件/目录
- **内存优化**: 流式处理大目录结构

### 性能考虑
- 大目录（>10000个文件）可能需要较长时间
- 建议设置合理的 `maxDepth` 值
- 使用 `excludePatterns` 排除不需要的目录
- 对于超大目录，考虑分批处理

## 安全考虑

1. **路径验证**: 自动验证路径是否存在和是否为目录
2. **协议安全**: 只支持预定义的安全协议
3. **深度限制**: 防止恶意路径导致的无限递归
4. **权限检查**: 自动跳过无权限访问的文件/目录

## 注意事项

1. **权限问题**: 某些系统目录可能需要管理员权限
2. **符号链接**: 会跟随符号链接，可能导致循环引用
3. **特殊文件**: 某些特殊文件可能无法读取
4. **编码问题**: 文件名包含特殊字符时可能显示异常
5. **性能影响**: 大目录结构可能影响应用性能

## 常见错误

### 路径不存在
```
{
  success: false,
  error: "路径不存在: /path/to/directory"
}
```

### 不是目录
```
{
  success: false,
  error: "指定路径不是目录: /path/to/file.txt"
}
```

### 权限不足
```
{
  success: true,
  data: "目录名\n--[错误: EACCES: permission denied]"
}
```

### 无效协议
```
{
  success: false,
  error: "无效的协议路径: invalid://path"
}
```

## 参数说明

### dirPath (string, 必需)
要获取目录结构的路径，支持以下格式：
- 绝对路径：`C:\Users\username\Documents`
- 相对路径：`./src`
- 自定义协议：`user-data://files/project` 或 `app://C:\Users\username\Documents`

### options (object, 可选)
配置选项对象，包含以下属性：

#### indentSize (number, 默认: 2)
缩进大小，表示每一级目录的缩进字符数。

#### indentChar (string, 默认: '-')
缩进字符，用于表示层级关系。

#### maxDepth (number, 默认: 6)
最大递归深度，超过此深度的子目录将被忽略。

#### includeHidden (boolean, 默认: false)
是否包含隐藏文件和目录（以 `.` 开头的文件/目录）。

#### includeFiles (boolean, 默认: true)
是否包含文件。

#### includeDirectories (boolean, 默认: true)
是否包含目录。

#### excludePatterns (string[], 默认: 见下方列表)
要排除的文件和目录模式数组，支持正则表达式。默认主要排除各种编程语言和开发工具的依赖目录：

**注意：** 正则表达式模式使用 JavaScript 正则表达式语法，例如：
- `.*\\.py[cod]` 匹配所有 `.pyc`, `.pyo`, `.pyd` 文件
- `.*\\.log` 匹配所有 `.log` 文件
- `.*~` 匹配所有以 `~` 结尾的文件

**Node.js 相关：**
- `node_modules`, `npm-debug.log*`, `yarn-debug.log*`, `.npm`, `.yarn`, `.yarnrc`

**Java 相关：**
- `target`, `.m2`, `.gradle`, `build`, `out`, `.classpath`, `.project`, `.settings`, `bin`

**Python 相关：**
- `__pycache__`, `.*\\.py[cod]`, `env`, `venv`, `.pytest_cache`, `.coverage`, `.tox`, `.mypy_cache`

**Ruby 相关：**
- `vendor/bundle`, `vendor/cache`, `.bundle`, `.*\\.gem`, `.ruby-version`

**PHP 相关：**
- `vendor`, `composer.lock`, `.composer`

**Go 相关：**
- `vendor`, `go.sum`, `.go`

**Rust 相关：**
- `target`, `Cargo.lock`

**.NET 相关：**
- `bin`, `obj`, `packages`, `.*\\.user`, `.*\\.suo`, `.vs`

**C/C++ 相关：**
- `build`, `cmake-build-.*`, `Makefile`, `.*\\.o`, `.*\\.obj`, `.*\\.exe`, `.*\\.dll`, `.*\\.so`

**前端构建工具：**
- `dist`, `.next`, `.nuxt`, `.output`, `.svelte-kit`, `.astro`, `.parcel-cache`

**版本控制：**
- `.git`, `.svn`, `.hg`, `.gitignore`, `.gitattributes`

**IDE 和编辑器：**
- `.idea`, `.vscode`, `.vs`, `.*\\.swp`, `.*\\.swo`, `.*~`, `.DS_Store`, `Thumbs.db`

**缓存文件：**
- `.cache`, `cache`, `.eslintcache`, `.stylelintcache`, `.babel-cache`, `.webpack`

**依赖锁定文件：**
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`

**系统文件：**
- `System Volume Information`, `\\$RECYCLE\\.BIN`, `.Trashes`, `.Spotlight-V100`, `.fseventsd`

**Docker 相关：**
- `.dockerignore`, `Dockerfile.*`, `docker-compose.*`, `.docker`

**其他开发工具：**
- `.eslintrc.*`, `.prettierrc.*`, `.babelrc.*`, `.editorconfig`, `.nvmrc`, `.node-version`, `.ruby-version`, `.python-version`, `.tool-versions` 