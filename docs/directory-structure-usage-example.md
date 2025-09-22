# Directory Structure 使用示例

## 前端调用示例

### React 组件示例

```tsx
import React, { useState } from 'react';

interface DirectoryStructureProps {
  path: string;
  options?: {
    indentSize?: number;
    indentChar?: string;
    maxDepth?: number;
    includeHidden?: boolean;
    includeFiles?: boolean;
    includeDirectories?: boolean;
    excludePatterns?: string[];
  };
}

const DirectoryStructure: React.FC<DirectoryStructureProps> = ({ 
  path, 
  options = {} 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [structure, setStructure] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const getStructure = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('system:getDirectoryStructure', path, options);
      
      if (result.success) {
        setStructure(result.data);
        console.log('目录结构获取成功:', result.totalLines, '行');
      } else {
        setError(result.error);
        console.error('获取目录结构失败:', result.error);
      }
    } catch (error: any) {
      setError(error.message);
      console.error('IPC调用失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="directory-structure">
      <button 
        onClick={getStructure}
        disabled={isLoading}
        className="get-structure-button"
      >
        {isLoading ? '获取中...' : '获取目录结构'}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {structure && (
        <div className="structure-display">
          <h3>目录结构:</h3>
          <pre className="structure-text">{structure}</pre>
        </div>
      )}
    </div>
  );
};

export default DirectoryStructure;
```

### Vue 组件示例

```vue
<template>
  <div class="directory-structure">
    <button 
      @click="getStructure"
      :disabled="isLoading"
      class="get-structure-button"
    >
      {{ isLoading ? '获取中...' : '获取目录结构' }}
    </button>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-if="structure" class="structure-display">
      <h3>目录结构:</h3>
      <pre class="structure-text">{{ structure }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  path: string;
  options?: {
    indentSize?: number;
    indentChar?: string;
    maxDepth?: number;
    includeHidden?: boolean;
    includeFiles?: boolean;
    includeDirectories?: boolean;
    excludePatterns?: string[];
  };
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({})
});

const isLoading = ref(false);
const structure = ref('');
const error = ref<string | null>(null);

const getStructure = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await window.electronAPI.invoke('system:getDirectoryStructure', props.path, props.options);
    
    if (result.success) {
      structure.value = result.data;
      console.log('目录结构获取成功:', result.totalLines, '行');
    } else {
      error.value = result.error;
      console.error('获取目录结构失败:', result.error);
    }
  } catch (err: any) {
    error.value = err.message;
    console.error('IPC调用失败:', err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.directory-structure {
  padding: 16px;
}

.get-structure-button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.get-structure-button:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.get-structure-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  font-size: 14px;
  margin-top: 8px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
}

.structure-display {
  margin-top: 16px;
}

.structure-text {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}
</style>
```

### 文件浏览器组件示例

```tsx
import React, { useState, useEffect } from 'react';
import DirectoryStructure from './DirectoryStructure';

interface FileBrowserProps {
  initialPath?: string;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ initialPath = '' }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [structure, setStructure] = useState<string>('');
  const [options, setOptions] = useState({
    indentSize: 2,
    indentChar: '-',
    maxDepth: 5,
    includeHidden: false,
    includeFiles: true,
    includeDirectories: true,
    excludePatterns: ['node_modules', '\\.git', '\\.DS_Store']
  });

  const getStructure = async () => {
    if (!currentPath) return;

    try {
      const result = await window.electronAPI.invoke('system:getDirectoryStructure', currentPath, options);
      
      if (result.success) {
        setStructure(result.data);
      } else {
        console.error('获取目录结构失败:', result.error);
        setStructure(`错误: ${result.error}`);
      }
    } catch (error: any) {
      console.error('IPC调用失败:', error);
      setStructure(`系统错误: ${error.message}`);
    }
  };

  useEffect(() => {
    if (currentPath) {
      getStructure();
    }
  }, [currentPath, options]);

  return (
    <div className="file-browser">
      <div className="controls">
        <input
          type="text"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          placeholder="输入文件夹路径"
          className="path-input"
        />
        <button onClick={getStructure} className="refresh-button">
          刷新
        </button>
      </div>

      <div className="options-panel">
        <h4>显示选项:</h4>
        <div className="option-group">
          <label>
            缩进大小:
            <input
              type="number"
              min="1"
              max="10"
              value={options.indentSize}
              onChange={(e) => setOptions(prev => ({ ...prev, indentSize: parseInt(e.target.value) }))}
            />
          </label>
        </div>
        
        <div className="option-group">
          <label>
            缩进字符:
            <input
              type="text"
              value={options.indentChar}
              onChange={(e) => setOptions(prev => ({ ...prev, indentChar: e.target.value }))}
              maxLength={5}
            />
          </label>
        </div>
        
        <div className="option-group">
          <label>
            最大深度:
            <input
              type="number"
              min="1"
              max="20"
              value={options.maxDepth}
              onChange={(e) => setOptions(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
            />
          </label>
        </div>
        
        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={options.includeHidden}
              onChange={(e) => setOptions(prev => ({ ...prev, includeHidden: e.target.checked }))}
            />
            包含隐藏文件
          </label>
        </div>
        
        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={options.includeFiles}
              onChange={(e) => setOptions(prev => ({ ...prev, includeFiles: e.target.checked }))}
            />
            包含文件
          </label>
        </div>
        
        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={options.includeDirectories}
              onChange={(e) => setOptions(prev => ({ ...prev, includeDirectories: e.target.checked }))}
            />
            包含目录
          </label>
        </div>
      </div>

      <div className="structure-display">
        <h3>目录结构:</h3>
        <pre className="structure-text">{structure}</pre>
      </div>
    </div>
  );
};

export default FileBrowser;
```

### 右键菜单集成示例

```tsx
import React, { useState, useRef, useEffect } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, path, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleGetStructure = async () => {
    try {
      const result = await window.electronAPI.invoke('system:getDirectoryStructure', path);
      
      if (result.success) {
        // 复制到剪贴板
        await navigator.clipboard.writeText(result.data);
        alert('目录结构已复制到剪贴板');
      } else {
        alert(`获取失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('IPC调用失败:', error);
      alert(`系统错误: ${error.message}`);
    }
    
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{ 
        position: 'fixed', 
        left: x, 
        top: y,
        zIndex: 1000 
      }}
    >
      <button onClick={handleGetStructure} className="menu-item">
        📁 获取目录结构
      </button>
      <button onClick={onClose} className="menu-item">
        ❌ 取消
      </button>
    </div>
  );
};

// 使用示例
const FileExplorer: React.FC = () => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      path
    });
  };

  return (
    <div className="file-explorer">
      {/* 文件列表内容 */}
      <div 
        className="file-item"
        onContextMenu={(e) => handleContextMenu(e, '/path/to/directory')}
      >
        示例文件夹
      </div>
      
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
```

## 自定义排除模式

如果你想覆盖默认的排除模式，可以传入自定义的 `excludePatterns` 数组：

```typescript
// 只排除 node_modules 和 .git
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: ['node_modules', '\\.git']
  }
);

// 不排除任何文件（显示所有内容）
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: []
  }
);

// 添加自定义排除模式
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: [
      // 保留默认排除模式
      'node_modules', 'dist', 'build', '.git', '.vscode',
      // 添加自定义排除
      'my-custom-folder',
      '*.test.js',
      'test-.*'
    ]
  }
);
```

## 常见使用场景

### 1. 查看项目源代码结构
```typescript
// 只显示源代码，排除构建文件和依赖
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    maxDepth: 4,
    excludePatterns: [
      'node_modules', 'dist', 'build', '.git', '.vscode',
      '*.log', 'coverage', '.nyc_output'
    ]
  }
);
```

### 2. 查看文档结构
```typescript
// 只显示文档文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\docs',
  {
    maxDepth: 3,
    excludePatterns: [
      '*.tmp', '*.bak', '.DS_Store', 'Thumbs.db'
    ]
  }
);
```

### 3. 查看配置文件
```typescript
// 显示配置文件，包括隐藏文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\config',
  {
    includeHidden: true,
    excludePatterns: [
      '*.log', '*.tmp', '*.bak'
    ]
  }
);
```

## 高级用法示例

### 批量获取多个目录结构

```typescript
const batchGetStructures = async (paths: string[]) => {
  const results: { path: string; structure: string; error?: string }[] = [];
  
  for (const path of paths) {
    try {
      const result = await window.electronAPI.invoke('system:getDirectoryStructure', path);
      
      if (result.success) {
        results.push({
          path,
          structure: result.data
        });
      } else {
        results.push({
          path,
          structure: '',
          error: result.error
        });
      }
    } catch (error: any) {
      results.push({
        path,
        structure: '',
        error: error.message
      });
    }
  }
  
  return results;
};

// 使用示例
const paths = ['/path1', '/path2', '/path3'];
const structures = await batchGetStructures(paths);
```

### 自定义格式化输出

```typescript
const getFormattedStructure = async (path: string, format: 'tree' | 'list' | 'json') => {
  const result = await window.electronAPI.invoke('system:getDirectoryStructure', path);
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  switch (format) {
    case 'tree':
      return result.data; // 默认树形格式
      
    case 'list':
      // 转换为列表格式
      return result.data
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
      
    case 'json':
      // 转换为JSON格式
      const lines = result.data.split('\n');
      const structure = parseTreeToJson(lines);
      return JSON.stringify(structure, null, 2);
      
    default:
      return result.data;
  }
};

// 解析树形结构为JSON
const parseTreeToJson = (lines: string[]) => {
  const result: any = {};
  const stack: { level: number; obj: any }[] = [];
  
  for (const line of lines) {
    const level = (line.match(/^[-\s\t]*/)?.[0].length || 0) / 2;
    const name = line.replace(/^[-\s\t]*/, '');
    
    const item = { name, type: 'file' };
    
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      result[name] = item;
      stack.push({ level, obj: result[name] });
    } else {
      const parent = stack[stack.length - 1].obj;
      if (!parent.children) parent.children = {};
      parent.children[name] = item;
      stack.push({ level, obj: parent.children[name] });
    }
  }
  
  return result;
};
```

### 错误处理最佳实践

```typescript
const handleStructureError = (error: string) => {
  const errorMessages: Record<string, string> = {
    '路径不存在': '指定的路径不存在，请检查路径是否正确',
    '指定路径不是目录': '请选择一个文件夹而不是文件',
    '无效的协议路径': '路径格式不正确，请使用有效的路径',
    'EACCES: permission denied': '权限不足，无法访问该目录',
    'ENOENT: no such file or directory': '文件或目录不存在'
  };

  const userMessage = errorMessages[error] || `获取目录结构失败: ${error}`;
  
  // 显示用户友好的错误信息
  showErrorMessage(userMessage);
  
  // 记录详细错误信息到日志
  console.error('Directory Structure 错误:', error);
};

// 使用示例
const getStructureWithErrorHandling = async (path: string, options = {}) => {
  try {
    const result = await window.electronAPI.invoke('system:getDirectoryStructure', path, options);
    
    if (result.success) {
      return result.data;
    } else {
      handleStructureError(result.error);
      return null;
    }
  } catch (error: any) {
    handleStructureError(error.message);
    return null;
  }
};
```

## 性能优化建议

1. **防抖处理**: 避免用户快速输入路径
2. **缓存结果**: 缓存已获取的目录结构
3. **进度提示**: 对于大目录显示进度
4. **异步处理**: 避免阻塞UI线程

```typescript
import { debounce } from 'lodash';

// 防抖处理
const debouncedGetStructure = debounce(async (path: string, options = {}) => {
  // 实现逻辑
}, 500);

// 缓存机制
const structureCache = new Map<string, { data: string; timestamp: number }>();

const getStructureWithCache = async (path: string, options = {}, cacheTime = 60000) => {
  const cacheKey = `${path}-${JSON.stringify(options)}`;
  const cached = structureCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheTime) {
    return cached.data;
  }
  
  const result = await window.electronAPI.invoke('system:getDirectoryStructure', path, options);
  
  if (result.success) {
    structureCache.set(cacheKey, {
      data: result.data,
      timestamp: Date.now()
    });
    return result.data;
  }
  
  throw new Error(result.error);
};
```

## 针对特定编程语言的自定义排除

### Node.js 项目
```typescript
// 只排除 Node.js 相关的依赖
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\node-project',
  {
    excludePatterns: [
      'node_modules', 'npm-debug.log*', 'yarn-debug.log*', '.npm', '.yarn',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
      'dist', '.next', '.nuxt', '.output', '.parcel-cache', '.cache',
      '.git', '.vscode', '*.log', 'tmp', 'temp'
    ]
  }
);
```

### Java 项目
```typescript
// 只排除 Java 相关的构建文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\java-project',
  {
    excludePatterns: [
      'target', '.m2', '.gradle', 'build', 'out', '.classpath', '.project', '.settings', 'bin',
      '.git', '.idea', '*.log', 'tmp', 'temp'
    ]
  }
);
```

### Python 项目
```typescript
// 只排除 Python 相关的虚拟环境和缓存
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\python-project',
  {
    excludePatterns: [
      '__pycache__', '*.py[cod]', '*$py.class', '*.so', '.Python',
      'env', 'venv', 'ENV', 'env.bak', 'venv.bak',
      '.pytest_cache', '.coverage', 'htmlcov', '.tox', '.nox',
      '.hypothesis', '.mypy_cache', '.dmypy.json', 'dmypy.json',
      '.git', '.vscode', '*.log', 'tmp', 'temp'
    ]
  }
);
```

### 多语言混合项目
```typescript
// 排除多种语言的依赖目录
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\mixed-project',
  {
    excludePatterns: [
      // Node.js
      'node_modules', 'npm-debug.log*', '.npm', 'package-lock.json', 'yarn.lock',
      // Java
      'target', '.m2', '.gradle', 'build', 'out', 'bin',
      // Python
      '__pycache__', '*.py[cod]', 'env', 'venv', '.pytest_cache',
      // 通用
      '.git', '.vscode', '*.log', 'tmp', 'temp'
    ]
  }
);
```

## 显示所有文件（不排除任何内容）

如果你想查看完整的目录结构，包括所有依赖文件：

```typescript
// 不排除任何文件，显示所有内容
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: [],
    includeHidden: true
  }
);
```

## 只排除特定类型的依赖

```typescript
// 只排除 node_modules，保留其他所有文件
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: ['node_modules']
  }
);

// 只排除构建输出，保留依赖目录
const result = await window.electronAPI.invoke('system:getDirectoryStructure', 
  'C:\\Users\\username\\project',
  {
    excludePatterns: ['dist', 'build', 'out', 'target', 'bin', 'obj']
  }
);
```
``` 