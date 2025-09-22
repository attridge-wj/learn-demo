import { BrowserWindow, BrowserView } from 'electron'
import * as path from 'path'

interface WebMetadata {
  title: string
  description: string
  icon: string
  url: string
  success: boolean
  error?: string
}

/**
 * 获取网页元数据（标题、概要、图标）
 * @param url 网页URL
 * @returns 网页元数据
 */
export async function getWebMetadata(url: string): Promise<WebMetadata> {
  // 验证URL格式
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      title: '',
      description: '',
      icon: '',
      url,
      success: false,
      error: '无效的URL格式，必须以http://或https://开头'
    }
  }

  try {
    // 创建一个隐藏的BrowserView来加载网页
    const metadataView = new BrowserView({
      webPreferences: {
        webSecurity: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, '../../../../preload.js')
      }
    })

    // 设置较小的尺寸以减少资源占用
    metadataView.setBounds({ x: 0, y: 0, width: 1024, height: 768 })
    metadataView.setAutoResize({ width: false, height: false })

    // 创建临时窗口来容纳BrowserView（避免影响主窗口）
    const tempWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      show: false, // 不显示窗口
      webPreferences: {
        webSecurity: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 将BrowserView添加到临时窗口
    tempWindow.addBrowserView(metadataView)

    // 设置超时时间
    const timeout = 15000 // 15秒超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), timeout)
    })

    // 加载网页并获取元数据
    const metadataPromise = new Promise<WebMetadata>((resolve, reject) => {
      let metadata: WebMetadata = {
        title: '',
        description: '',
        icon: '',
        url,
        success: false
      }

      // 监听页面标题更新
      metadataView.webContents.on('page-title-updated', (event, title) => {
        metadata.title = title
      })

      // 监听页面加载完成
      metadataView.webContents.on('did-finish-load', async () => {
        try {
          // 执行JavaScript获取页面元数据
          const pageMetadata = await metadataView.webContents.executeJavaScript(`
            (() => {
              const metadata = {
                title: document.title || '',
                description: '',
                icon: ''
              }
              
              // 获取描述信息
              const metaDescription = document.querySelector('meta[name="description"]')
              if (metaDescription) {
                metadata.description = metaDescription.getAttribute('content') || ''
              }
              
              // 如果没有description，尝试获取其他描述信息
              if (!metadata.description) {
                const metaOgDescription = document.querySelector('meta[property="og:description"]')
                if (metaOgDescription) {
                  metadata.description = metaOgDescription.getAttribute('content') || ''
                }
              }
              
              // 获取图标
              const iconLink = document.querySelector('link[rel="icon"]') || 
                              document.querySelector('link[rel="shortcut icon"]') ||
                              document.querySelector('link[rel="apple-touch-icon"]')
              
              if (iconLink) {
                const iconHref = iconLink.getAttribute('href')
                if (iconHref) {
                  // 处理相对路径
                  if (iconHref.startsWith('http')) {
                    metadata.icon = iconHref
                  } else if (iconHref.startsWith('//')) {
                    metadata.icon = 'https:' + iconHref
                  } else if (iconHref.startsWith('/')) {
                    metadata.icon = new URL(iconHref, window.location.origin).href
                  } else {
                    metadata.icon = new URL(iconHref, window.location.href).href
                  }
                }
              }
              
              // 如果没有找到图标，使用默认的favicon.ico
              if (!metadata.icon) {
                metadata.icon = new URL('/favicon.ico', window.location.origin).href
              }
              
              return metadata
            })()
          `)

          metadata.description = pageMetadata.description
          metadata.icon = pageMetadata.icon
          metadata.success = true

          resolve(metadata)
        } catch (error) {
          reject(new Error(`获取页面元数据失败: ${error.message}`))
        }
      })

      // 监听加载失败
      metadataView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(`页面加载失败: ${errorDescription} (${errorCode})`))
      })

      // 开始加载页面
      metadataView.webContents.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      })
    })

    // 等待结果或超时
    const result = await Promise.race([metadataPromise, timeoutPromise])

    // 清理资源
    tempWindow.removeBrowserView(metadataView)
    metadataView.webContents.close()
    tempWindow.close()

    return result

  } catch (error) {
    return {
      title: '',
      description: '',
      icon: '',
      url,
      success: false,
      error: error.message || '获取网页元数据失败'
    }
  }
}
