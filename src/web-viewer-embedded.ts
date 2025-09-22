import { BrowserWindow, BrowserView, ipcMain, shell, session } from 'electron'
import * as path from 'path'

interface EmbeddedWebViewerOptions {
  url: string
  title?: string
  userAgent?: string
  enableDevTools?: boolean
  // 嵌入位置和尺寸
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  // 新增选项
  enableAnimations?: boolean
  fallbackUrls?: string[]
  customHeaders?: Record<string, string>
}

interface EmbeddedWebViewerInfo {
  id: string
  url: string
  title: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  isVisible: boolean
  processId?: number
  loadStatus: 'loading' | 'loaded' | 'failed' | 'idle'
}

class EmbeddedWebViewerManager {
  private viewers: Map<string, BrowserView> = new Map()
  private mainWindow: BrowserWindow | null = null
  private processPool = new Map<number, BrowserView[]>()
  private animationFrames = new Map<string, number>()

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * 创建嵌入式web查看器
   */
  createEmbeddedViewer(options: EmbeddedWebViewerOptions): string {
    if (!this.mainWindow) {
      throw new Error('Main window not set')
    }

    const { url, title, userAgent, enableDevTools, bounds, enableAnimations, fallbackUrls, customHeaders } = options
    
    // 生成唯一ID
    const viewerId = this.generateViewerId(url)
    
    // 检查是否已存在该URL的查看器
    if (this.viewers.has(viewerId)) {
      const existingViewer = this.viewers.get(viewerId)!
      // 更新位置和尺寸
      if (enableAnimations) {
        this.animateBounds(existingViewer, bounds)
      } else {
        existingViewer.setBounds(bounds)
      }
      existingViewer.setAutoResize({ width: true, height: true })
      return viewerId
    }

    // 创建新的BrowserView
    const viewer = new BrowserView({
      webPreferences: {
        webSecurity: true, // 保持安全性
        allowRunningInsecureContent: false,
        webgl: true,
        enablePreferredSizeMode: true,
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        // 移除不存在的userAgent属性
        sandbox: true
      }
    })

    // 设置位置和尺寸
    if (enableAnimations) {
      this.animateBounds(viewer, bounds)
    } else {
      viewer.setBounds(bounds)
    }
    viewer.setAutoResize({ width: true, height: true })

    // 设置响应头拦截
    this.setupHeaderInterception(viewer, customHeaders)

    // 加载URL（支持智能协议升级）
    this.loadUrlWithProtocolUpgrade(viewer, url, fallbackUrls)

    // 监听页面标题变化
    viewer.webContents.on('page-title-updated', (event, newTitle) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('embedded-viewer:title-updated', {
          viewerId,
          title: newTitle
        })
      }
    })

    // 监听外部链接，在默认浏览器中打开
    viewer.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    // 监听页面加载完成
    viewer.webContents.on('did-finish-load', () => {
      if (enableDevTools) {
        viewer.webContents.openDevTools()
      }
      
      // 通知渲染进程页面加载完成
      if (this.mainWindow) {
        this.mainWindow.webContents.send('embedded-viewer:loaded', {
          viewerId,
          url: viewer.webContents.getURL()
        })
      }
    })

    // 监听页面加载失败（多级降级策略）
    viewer.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Embedded viewer failed to load:', errorDescription, 'URL:', validatedURL)
      this.handleLoadFailure(viewer, errorCode, errorDescription, validatedURL, fallbackUrls)
    })

    // 将BrowserView添加到主窗口
    this.mainWindow.addBrowserView(viewer)
    
    // 存储查看器引用
    this.viewers.set(viewerId, viewer)

    // 记录进程ID用于复用
    const processId = viewer.webContents.getOSProcessId()
    if (!this.processPool.has(processId)) {
      this.processPool.set(processId, [])
    }
    this.processPool.get(processId)!.push(viewer)

    return viewerId
  }

  /**
   * 设置响应头拦截
   */
  private setupHeaderInterception(viewer: BrowserView, customHeaders?: Record<string, string>): void {
    const ses = viewer.webContents.session
    
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {}
      
      // 移除嵌入限制头部
      delete headers['x-frame-options']
      delete headers['content-security-policy']
      delete headers['x-content-type-options']
      
      // 添加允许嵌入的头部
      headers['x-frame-options'] = ['SAMEORIGIN']
      
      // 添加自定义头部
      if (customHeaders) {
        Object.entries(customHeaders).forEach(([key, value]) => {
          headers[key.toLowerCase()] = [value]
        })
      }
      
      callback({ responseHeaders: headers })
    })
  }

  /**
   * 智能协议升级加载URL
   */
  private async loadUrlWithProtocolUpgrade(viewer: BrowserView, url: string, fallbackUrls?: string[]): Promise<void> {
    try {
      const urlObj = new URL(url)
      
      if (urlObj.protocol === 'http:') {
        // 尝试升级到HTTPS
        const httpsUrl = url.replace('http:', 'https:')
        try {
          await viewer.webContents.loadURL(httpsUrl)
          return
        } catch (httpsError) {
          console.log('HTTPS upgrade failed, falling back to HTTP:', httpsError)
          // 如果HTTPS失败，回退到HTTP
          await viewer.webContents.loadURL(url)
        }
      } else {
        await viewer.webContents.loadURL(url)
      }
    } catch (error) {
      console.error('Invalid URL:', url, error)
      this.loadUrl(viewer, url) // 调用新的loadUrl方法
    }
  }

  /**
   * 处理加载失败（多级降级策略）
   */
  private async handleLoadFailure(
    viewer: BrowserView, 
    errorCode: number, 
    errorDescription: string, 
    validatedURL: string,
    fallbackUrls?: string[]
  ): Promise<void> {
    console.log(`Load failed: ${errorDescription}, Error code: ${errorCode}`)
    
    // 第一级：尝试刷新
    if (errorCode === -6) { // ERR_CONNECTION_REFUSED
      console.log('Connection refused, attempting refresh in 2 seconds...')
      setTimeout(() => {
        if (!viewer.webContents.isDestroyed()) {
          viewer.webContents.reload()
        }
      }, 2000)
      return
    }
    
    // 第二级：尝试备用URL
    if (fallbackUrls && fallbackUrls.length > 0) {
      console.log('Trying fallback URLs...')
      for (const fallbackUrl of fallbackUrls) {
        try {
          await viewer.webContents.loadURL(fallbackUrl)
          console.log('Successfully loaded fallback URL:', fallbackUrl)
          return
        } catch (fallbackError) {
          console.log('Fallback URL failed:', fallbackUrl, fallbackError)
          continue
        }
      }
    }
    
    // 第三级：发送错误通知到渲染进程，不显示错误页面
    if (this.mainWindow) {
      this.mainWindow.webContents.send('embedded-viewer:load-failed', {
        viewerId: this.getViewerIdByViewer(viewer),
        errorCode,
        errorDescription,
        url: validatedURL,
        timestamp: Date.now()
      })
    }
    
    // 记录错误日志
    console.error(`Viewer load failed: ${errorDescription} (${errorCode}) for URL: ${validatedURL}`)
  }

  /**
   * 动画过渡边界调整
   */
  private animateBounds(viewer: BrowserView, targetBounds: { x: number; y: number; width: number; height: number }, duration: number = 300): void {
    const startBounds = viewer.getBounds()
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // 使用缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      
      const currentBounds = {
        x: startBounds.x + (targetBounds.x - startBounds.x) * easeProgress,
        y: startBounds.y + (targetBounds.y - startBounds.y) * easeProgress,
        width: startBounds.width + (targetBounds.width - startBounds.width) * easeProgress,
        height: startBounds.height + (targetBounds.height - startBounds.height) * easeProgress
      }
      
      if (!viewer.webContents.isDestroyed()) {
        viewer.setBounds(currentBounds)
      }
      
      if (progress < 1) {
        const frameId = requestAnimationFrame(animate)
        this.animationFrames.set(viewer.webContents.id.toString(), frameId)
      }
    }
    
    animate()
  }

  /**
   * 更新查看器位置和尺寸
   */
  updateViewerBounds(viewerId: string, bounds: { x: number; y: number; width: number; height: number }, enableAnimation: boolean = false): boolean {
    const viewer = this.viewers.get(viewerId)
    if (viewer && !viewer.webContents.isDestroyed()) {
      if (enableAnimation) {
        this.animateBounds(viewer, bounds)
      } else {
        viewer.setBounds(bounds)
      }
      return true
    }
    return false
  }

  /**
   * 隐藏查看器
   */
  hideViewer(viewerId: string): boolean {
    const viewer = this.viewers.get(viewerId)
    if (viewer && !viewer.webContents.isDestroyed()) {
      this.mainWindow?.removeBrowserView(viewer)
      return true
    }
    return false
  }

  /**
   * 显示查看器
   */
  showViewer(viewerId: string): boolean {
    const viewer = this.viewers.get(viewerId)
    if (viewer && !viewer.webContents.isDestroyed()) {
      this.mainWindow?.addBrowserView(viewer)
      return true
    }
    return false
  }

  /**
   * 关闭查看器
   */
  closeViewer(viewerId: string): boolean {
    const viewer = this.viewers.get(viewerId)
    if (viewer) {
      // 取消动画帧
      const frameId = this.animationFrames.get(viewer.webContents.id.toString())
      if (frameId) {
        cancelAnimationFrame(frameId)
        this.animationFrames.delete(viewer.webContents.id.toString())
      }
      
      if (!viewer.webContents.isDestroyed()) {
        this.mainWindow?.removeBrowserView(viewer)
        viewer.webContents.close()
      }
      
      // 从进程池中移除
      const processId = viewer.webContents.getOSProcessId()
      const processViews = this.processPool.get(processId)
      if (processViews) {
        const index = processViews.indexOf(viewer)
        if (index > -1) {
          processViews.splice(index, 1)
        }
        if (processViews.length === 0) {
          this.processPool.delete(processId)
        }
      }
      
      this.viewers.delete(viewerId)
      return true
    }
    return false
  }

  /**
   * 关闭所有查看器
   */
  closeAllViewers(): void {
    // 取消所有动画帧
    this.animationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId)
    })
    this.animationFrames.clear()
    
    this.viewers.forEach((viewer) => {
      if (!viewer.webContents.isDestroyed()) {
        this.mainWindow?.removeBrowserView(viewer)
        viewer.webContents.close()
      }
    })
    this.viewers.clear()
    this.processPool.clear()
  }

  /**
   * 获取所有查看器信息
   */
  getAllViewers(): EmbeddedWebViewerInfo[] {
    return Array.from(this.viewers.entries()).map(([id, viewer]) => ({
      id,
      url: viewer.webContents.getURL(),
      title: viewer.webContents.getTitle(),
      bounds: viewer.getBounds(),
      isVisible: this.mainWindow?.getBrowserViews().includes(viewer) || false,
      processId: viewer.webContents.getOSProcessId(),
      loadStatus: this.getLoadStatus(viewer)
    }))
  }

  /**
   * 获取加载状态
   */
  private getLoadStatus(viewer: BrowserView): 'loading' | 'loaded' | 'failed' | 'idle' {
    if (viewer.webContents.isLoading()) {
      return 'loading'
    }
    // 这里可以根据实际需要添加更多状态判断逻辑
    return 'loaded'
  }

  /**
   * 根据BrowserView实例获取查看器ID
   */
  private getViewerIdByViewer(viewer: BrowserView): string | null {
    for (const [id, v] of this.viewers.entries()) {
      if (v === viewer) {
        return id
      }
    }
    return null
  }

  /**
   * 加载URL到查看器
   */
  private loadUrl(viewer: BrowserView, url: string): void {
    try {
      const urlObj = new URL(url)
      
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        viewer.webContents.loadURL(url)
      } else {
        shell.openExternal(url)
        throw new Error('Unsupported protocol')
      }
    } catch (error) {
      console.error('Invalid URL:', url, error)
      // 不显示错误页面，只发送通知
      if (this.mainWindow) {
        this.mainWindow.webContents.send('embedded-viewer:load-failed', {
          viewerId: this.getViewerIdByViewer(viewer),
          errorCode: -1,
          errorDescription: 'Invalid URL',
          url: url,
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 显示错误页面 - 已移除，改为发送IPC通知
   */
  // private showErrorPage(viewer: BrowserView, error: string, url: string): void {
  //   // 此方法已移除，改为发送IPC通知
  // }

  /**
   * 获取默认用户代理
   */
  private getDefaultUserAgent(): string {
    const platform = process.platform
    const electronVersion = process.versions.electron
    const chromeVersion = process.versions.chrome
    
    return `Mozilla/5.0 (${platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 
                          platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : 
                          'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 Electron/${electronVersion}`
  }

  /**
   * 生成查看器ID
   */
  private generateViewerId(url: string): string {
    return `embedded_${Buffer.from(url).toString('base64').substring(0, 16)}`
  }
}

// 创建全局实例
export const embeddedWebViewerManager = new EmbeddedWebViewerManager()

// 设置IPC通信
export function setupEmbeddedWebViewerIPC(): void {
  // 创建嵌入式web查看器
  ipcMain.handle('embedded-web-viewer:create', async (event, options: EmbeddedWebViewerOptions) => {
    try {
      const viewerId = embeddedWebViewerManager.createEmbeddedViewer(options)
      return { success: true, viewerId }
    } catch (error) {
      console.error('Failed to create embedded viewer:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 更新查看器位置和尺寸
  ipcMain.handle('embedded-web-viewer:update-bounds', async (event, viewerId: string, bounds: any, enableAnimation: boolean = false) => {
    try {
      const result = embeddedWebViewerManager.updateViewerBounds(viewerId, bounds, enableAnimation)
      return { success: true, updated: result }
    } catch (error) {
      console.error('Failed to update viewer bounds:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 隐藏查看器
  ipcMain.handle('embedded-web-viewer:hide', async (event, viewerId: string) => {
    try {
      const result = embeddedWebViewerManager.hideViewer(viewerId)
      return { success: true, hidden: result }
    } catch (error) {
      console.error('Failed to hide viewer:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 显示查看器
  ipcMain.handle('embedded-web-viewer:show', async (event, viewerId: string) => {
    try {
      const result = embeddedWebViewerManager.showViewer(viewerId)
      return { success: true, shown: result }
    } catch (error) {
      console.error('Failed to show viewer:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 关闭查看器
  ipcMain.handle('embedded-web-viewer:close', async (event, viewerId: string) => {
    try {
      const result = embeddedWebViewerManager.closeViewer(viewerId)
      return { success: true, closed: result }
    } catch (error) {
      console.error('Failed to close embedded viewer:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 关闭所有查看器
  ipcMain.handle('embedded-web-viewer:close-all', async () => {
    try {
      embeddedWebViewerManager.closeAllViewers()
      return { success: true }
    } catch (error) {
      console.error('Failed to close all embedded viewers:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 获取所有查看器信息
  ipcMain.handle('embedded-web-viewer:get-all', async () => {
    try {
      const viewers = embeddedWebViewerManager.getAllViewers()
      return { success: true, viewers }
    } catch (error) {
      console.error('Failed to get embedded viewers:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
