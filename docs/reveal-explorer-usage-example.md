# Reveal in Explorer 使用示例

## 前端调用示例

### React 组件示例

```tsx
import React, { useState } from 'react';

interface RevealInExplorerProps {
  path: string;
  label?: string;
  className?: string;
}

const RevealInExplorer: React.FC<RevealInExplorerProps> = ({ 
  path, 
  label = "在资源管理器中显示", 
  className = "" 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.invoke('system:revealInExplorer', path);
      
      if (result.success) {
        console.log('成功打开目录:', result.message);
        // 可以显示成功提示
        showSuccessMessage('已在资源管理器中打开');
      } else {
        setError(result.error);
        console.error('打开目录失败:', result.error);
      }
    } catch (error: any) {
      setError(error.message);
      console.error('IPC调用失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`reveal-in-explorer ${className}`}>
      <button 
        onClick={handleReveal}
        disabled={isLoading}
        className="reveal-button"
      >
        {isLoading ? '打开中...' : label}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default RevealInExplorer;
```

### Vue 组件示例

```vue
<template>
  <div class="reveal-in-explorer">
    <button 
      @click="handleReveal"
      :disabled="isLoading"
      class="reveal-button"
    >
      {{ isLoading ? '打开中...' : label }}
    </button>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  path: string;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: '在资源管理器中显示'
});

const isLoading = ref(false);
const error = ref<string | null>(null);

const handleReveal = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await window.electronAPI.invoke('system:revealInExplorer', props.path);
    
    if (result.success) {
      console.log('成功打开目录:', result.message);
      // 显示成功提示
      showSuccessMessage('已在资源管理器中打开');
    } else {
      error.value = result.error;
      console.error('打开目录失败:', result.error);
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
.reveal-in-explorer {
  display: inline-block;
}

.reveal-button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.reveal-button:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.reveal-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  font-size: 12px;
  margin-top: 4px;
}
</style>
```

### 文件列表组件示例

```tsx
import React from 'react';
import RevealInExplorer from './RevealInExplorer';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

interface FileListProps {
  files: FileItem[];
}

const FileList: React.FC<FileListProps> = ({ files }) => {
  return (
    <div className="file-list">
      {files.map((file, index) => (
        <div key={index} className="file-item">
          <div className="file-info">
            <span className="file-name">{file.name}</span>
            <span className="file-type">
              {file.type === 'file' ? '📄' : '📁'}
            </span>
            {file.size && (
              <span className="file-size">
                {formatFileSize(file.size)}
              </span>
            )}
          </div>
          
          <div className="file-actions">
            <RevealInExplorer 
              path={file.path}
              label="显示位置"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default FileList;
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

  const handleReveal = async () => {
    try {
      const result = await window.electronAPI.invoke('system:revealInExplorer', path);
      
      if (result.success) {
        console.log('成功打开目录:', result.message);
      } else {
        console.error('打开目录失败:', result.error);
        // 显示错误提示
        alert(`打开失败: ${result.error}`);
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
      <button onClick={handleReveal} className="menu-item">
        📁 在资源管理器中显示
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
        onContextMenu={(e) => handleContextMenu(e, '/path/to/file')}
      >
        示例文件
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

## 错误处理最佳实践

```typescript
// 统一的错误处理函数
const handleRevealError = (error: string) => {
  // 根据错误类型显示不同的用户友好信息
  const errorMessages: Record<string, string> = {
    '路径不存在': '指定的路径不存在，请检查路径是否正确',
    '无效的协议路径': '路径格式不正确，请使用有效的路径',
    '未找到可用的文件管理器': '系统未安装文件管理器，请安装后重试',
    '打开目录失败': '无法打开目录，请检查权限或重试'
  };

  const userMessage = errorMessages[error] || `操作失败: ${error}`;
  
  // 显示用户友好的错误信息
  showErrorMessage(userMessage);
  
  // 记录详细错误信息到日志
  console.error('Reveal in Explorer 错误:', error);
};

// 使用示例
const revealWithErrorHandling = async (path: string) => {
  try {
    const result = await window.electronAPI.invoke('system:revealInExplorer', path);
    
    if (result.success) {
      showSuccessMessage('已在资源管理器中打开');
    } else {
      handleRevealError(result.error);
    }
  } catch (error: any) {
    handleRevealError(error.message);
  }
};
```

## 性能优化建议

1. **防抖处理**: 避免用户快速点击
2. **加载状态**: 提供视觉反馈
3. **错误缓存**: 避免重复的错误提示
4. **路径验证**: 在调用前验证路径格式

```typescript
import { debounce } from 'lodash';

// 防抖处理
const debouncedReveal = debounce(async (path: string) => {
  // 实现逻辑
}, 300);

// 路径预验证
const isValidPath = (path: string): boolean => {
  return path && path.trim().length > 0;
};
``` 