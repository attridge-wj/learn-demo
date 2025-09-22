# 嵌入式Web查看器使用指南

## 概述

嵌入式Web查看器允许你在Vue3界面的指定div容器中直接显示网页内容，而不是创建新的窗口。这种方式提供了更好的用户体验，网页内容完全集成到你的应用中。

## 主要特性

- 🎯 **嵌入式显示**: 网页直接显示在指定的div容器中
- 📱 **响应式布局**: 支持动态调整位置和尺寸
- 🪟 **无边框集成**: 网页内容无缝集成到应用界面
- 🛠️ **开发者工具**: 可选启用开发者工具进行调试
- 🔒 **安全隔离**: 基于BrowserView的安全上下文隔离
- 📋 **智能管理**: 自动处理位置计算和尺寸调整

## 技术原理

嵌入式Web查看器使用Electron的`BrowserView`技术，将网页内容直接嵌入到主窗口的指定区域。与独立的`BrowserWindow`不同，`BrowserView`可以：

1. 在同一个窗口中显示多个网页内容
2. 精确控制显示位置和尺寸
3. 与主应用界面无缝集成
4. 共享主窗口的菜单和快捷键

## 快速开始

### 1. 基本用法

```vue
<template>
  <div class="web-viewer-container">
    <!-- 控制面板 -->
    <div class="controls">
      <input v-model="url" placeholder="输入URL" />
      <button @click="createViewer">创建查看器</button>
    </div>
    
    <!-- 网页显示区域 -->
    <div 
      ref="viewerDiv" 
      class="viewer-area"
      :style="{ width: '800px', height: '600px' }"
    >
      <!-- 网页将显示在这里 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const url = ref('https://www.google.com')
const viewerDiv = ref<HTMLDivElement>()

const createViewer = async () => {
  if (!viewerDiv.value) return
  
  // 获取容器位置
  const rect = viewerDiv.value.getBoundingClientRect()
  
  const result = await window.embeddedWebViewerApi.create({
    url: url.value,
    bounds: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: 800,
      height: 600
    }
  })
  
  if (result.success) {
    console.log('查看器创建成功:', result.viewerId)
  }
}
</script>
```

### 2. 动态调整尺寸

```vue
<template>
  <div class="resizable-viewer">
    <div class="size-controls">
      <label>宽度: <input v-model.number="width" type="number" /></label>
      <label>高度: <input v-model.number="height" type="number" /></label>
    </div>
    
    <div 
      ref="viewerDiv" 
      class="viewer-container"
      :style="{ width: width + 'px', height: height + 'px' }"
    >
      <!-- 网页内容 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const width = ref(800)
const height = ref(600)
const viewerDiv = ref<HTMLDivElement>()
let currentViewerId: string | null = null

// 监听尺寸变化
watch([width, height], async () => {
  if (currentViewerId && viewerDiv.value) {
    const rect = viewerDiv.value.getBoundingClientRect()
    
    await window.embeddedWebViewerApi.updateBounds(currentViewerId, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: width.value,
      height: height.value
    })
  }
})
</script>
```

### 3. 多查看器管理

```vue
<template>
  <div class="multi-viewer">
    <div class="viewer-list">
      <div 
        v-for="viewer in viewers" 
        :key="viewer.id"
        class="viewer-item"
      >
        <span>{{ viewer.title || viewer.url }}</span>
        <button @click="toggleViewer(viewer.id)">
          {{ viewer.isVisible ? '隐藏' : '显示' }}
        </button>
        <button @click="closeViewer(viewer.id)">关闭</button>
      </div>
    </div>
    
    <div class="viewer-grid">
      <div 
        v-for="viewer in viewers" 
        :key="viewer.id"
        class="viewer-slot"
        :style="{ 
          width: viewer.bounds.width + 'px', 
          height: viewer.bounds.height + 'px' 
        }"
      >
        <!-- 每个查看器占位符 -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { EmbeddedWebViewerInfo } from '../types/web-viewer'

const viewers = ref<EmbeddedWebViewerInfo[]>([])

const loadViewers = async () => {
  const result = await window.embeddedWebViewerApi.getAll()
  if (result.success) {
    viewers.value = result.viewers
  }
}

const toggleViewer = async (viewerId: string) => {
  const viewer = viewers.value.find(v => v.id === viewerId)
  if (viewer) {
    if (viewer.isVisible) {
      await window.embeddedWebViewerApi.hide(viewerId)
    } else {
      await window.embeddedWebViewerApi.show(viewerId)
    }
    await loadViewers()
  }
}

const closeViewer = async (viewerId: string) => {
  await window.embeddedWebViewerApi.close(viewerId)
  await loadViewers()
}

onMounted(() => {
  loadViewers()
})
</script>
```

## API参考

### embeddedWebViewerApi.create(options)

创建嵌入式Web查看器。

**参数:**
```typescript
{
  url: string                    // 要显示的网页URL
  title?: string                 // 可选的标题
  userAgent?: string            // 自定义用户代理
  enableDevTools?: boolean      // 是否启用开发者工具
  bounds: {                     // 显示位置和尺寸
    x: number                   // X坐标（相对于窗口）
    y: number                   // Y坐标（相对于窗口）
    width: number               // 宽度
    height: number              // 高度
  }
}
```

**返回值:**
```typescript
{
  success: boolean
  viewerId?: string
  error?: string
}
```

### embeddedWebViewerApi.updateBounds(viewerId, bounds)

更新查看器的位置和尺寸。

**参数:**
- `viewerId`: 查看器ID
- `bounds`: 新的位置和尺寸

### embeddedWebViewerApi.hide(viewerId)

隐藏指定的查看器。

### embeddedWebViewerApi.show(viewerId)

显示指定的查看器。

### embeddedWebViewerApi.close(viewerId)

关闭指定的查看器。

### embeddedWebViewerApi.closeAll()

关闭所有查看器。

### embeddedWebViewerApi.getAll()

获取所有查看器信息。

## 位置计算

### 1. 获取容器位置

```typescript
const getContainerBounds = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}
```

### 2. 响应窗口变化

```typescript
import { onMounted, onUnmounted } from 'vue'

const handleResize = () => {
  if (currentViewerId && viewerDiv.value) {
    updateViewerBounds()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
```

### 3. 动态布局

```typescript
// 网格布局示例
const createGridLayout = (containers: HTMLElement[], cols: number) => {
  const containerWidth = 800 / cols
  const containerHeight = 600 / Math.ceil(containers.length / cols)
  
  containers.forEach((container, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    
    const bounds = {
      x: col * containerWidth,
      y: row * containerHeight,
      width: containerWidth,
      height: containerHeight
    }
    
    // 创建或更新查看器
    updateViewerBounds(container, bounds)
  })
}
```

## 最佳实践

### 1. 性能优化

```typescript
// 避免频繁更新
let resizeTimeout: NodeJS.Timeout

const debouncedResize = () => {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    updateViewerBounds()
  }, 100)
}

window.addEventListener('resize', debouncedResize)
```

### 2. 错误处理

```typescript
const createViewerSafely = async (url: string, container: HTMLElement) => {
  try {
    // 验证URL
    new URL(url)
    
    // 验证容器
    if (!container.offsetWidth || !container.offsetHeight) {
      throw new Error('容器尺寸无效')
    }
    
    const result = await window.embeddedWebViewerApi.create({
      url,
      bounds: getContainerBounds(container)
    })
    
    if (!result.success) {
      throw new Error(result.error || '创建失败')
    }
    
    return result.viewerId
  } catch (error) {
    console.error('创建查看器失败:', error)
    // 显示用户友好的错误信息
    showErrorMessage(error.message)
    return null
  }
}
```

### 3. 生命周期管理

```typescript
import { onMounted, onUnmounted, ref } from 'vue'

const viewerIds = ref<string[]>([])

onMounted(() => {
  // 组件挂载时的初始化
})

onUnmounted(() => {
  // 组件卸载时清理所有查看器
  viewerIds.value.forEach(id => {
    window.embeddedWebViewerApi.close(id)
  })
  viewerIds.value = []
})
```

## 注意事项

1. **位置计算**: 确保正确计算容器在窗口中的绝对位置
2. **尺寸同步**: 保持Vue组件尺寸与查看器尺寸的同步
3. **事件处理**: 正确处理窗口大小变化和滚动事件
4. **内存管理**: 及时关闭不需要的查看器
5. **性能考虑**: 避免同时创建过多查看器

## 故障排除

### 常见问题

**Q: 查看器显示位置不正确**
A: 检查容器位置计算，确保使用`getBoundingClientRect()`获取准确位置

**Q: 查看器尺寸不匹配**
A: 确保Vue组件的尺寸与查看器bounds设置一致

**Q: 查看器无法显示**
A: 检查容器是否可见，确保容器有有效的尺寸

**Q: 性能问题**
A: 限制同时显示的查看器数量，使用防抖处理resize事件

## 与独立窗口查看器的区别

| 特性 | 嵌入式查看器 | 独立窗口查看器 |
|------|-------------|---------------|
| 显示方式 | 嵌入到主窗口 | 独立窗口 |
| 集成度 | 高 | 低 |
| 位置控制 | 精确控制 | 窗口级别 |
| 性能 | 更好 | 一般 |
| 复杂度 | 较高 | 较低 |
| 适用场景 | 应用内集成 | 独立查看 |

---

*最后更新: 2024年*
