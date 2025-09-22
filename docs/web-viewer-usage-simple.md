# Web Viewer 使用说明

## 概述

Web Viewer是一个功能强大的嵌入式网页查看器，支持在应用中直接显示网页内容，具备动画效果、智能错误处理、响应头拦截等高级功能。

## 快速开始

### 1. 创建查看器

```typescript
// 基础用法
const viewerId = await window.embeddedWebViewerApi.create({
  url: 'https://www.google.com',
  bounds: { x: 100, y: 100, width: 800, height: 600 }
})

// 高级用法
const viewerId = await window.embeddedWebViewerApi.create({
  url: 'https://example.com',
  title: '自定义标题',
  enableDevTools: true,
  enableAnimations: true,
  fallbackUrls: ['https://backup1.com', 'https://backup2.com'],
  customHeaders: { 'X-API-Key': 'your-key' },
  bounds: { x: 200, y: 200, width: 1000, height: 700 }
})
```

### 2. 管理查看器

```typescript
// 更新位置和尺寸
await window.embeddedWebViewerApi.updateBounds(viewerId, {
  x: 300, y: 300, width: 900, height: 600
}, true) // 第三个参数启用动画

// 隐藏/显示查看器
await window.embeddedWebViewerApi.hide(viewerId)
await window.embeddedWebViewerApi.show(viewerId)

// 关闭查看器
await window.embeddedWebViewerApi.close(viewerId)

// 获取所有查看器信息
const viewers = await window.embeddedWebViewerApi.getAll()
```

### 3. 事件监听

```typescript
// 监听加载失败事件
const unsubscribeLoadFailed = window.embeddedWebViewerEvents.onLoadFailed((event) => {
  console.log('加载失败:', event)
  // 处理错误
})

// 监听标题更新事件
const unsubscribeTitleUpdated = window.embeddedWebViewerEvents.onTitleUpdated((event) => {
  console.log('标题更新:', event)
})

// 监听加载完成事件
const unsubscribeLoaded = window.embeddedWebViewerEvents.onLoaded((event) => {
  console.log('加载完成:', event)
})

// 清理监听器
unsubscribeLoadFailed()
unsubscribeTitleUpdated()
unsubscribeLoaded()
```

## 主要特性

- 🎬 **动画过渡**: 支持平滑的位置和尺寸变化动画
- 🛡️ **安全突破**: 自动拦截限制性响应头，支持嵌入任何网页
- 🔄 **智能升级**: 自动尝试HTTP到HTTPS协议升级
- 🚀 **降级策略**: 多级错误恢复机制，包括备用URL
- ⚡ **性能优化**: 进程复用和内存管理
- 📊 **状态管理**: 完整的查看器状态跟踪

## 注意事项

1. 确保在组件卸载时清理事件监听器
2. 动画功能会消耗额外资源，低端设备建议禁用
3. 多个查看器会占用更多内存，注意及时清理
4. 某些网站可能有额外的反嵌入措施

## 错误处理

Web Viewer使用事件通知机制处理错误，不再显示错误页面，避免了加载失败的问题。所有错误都会通过`onLoadFailed`事件通知渲染进程，让应用决定如何处理。
