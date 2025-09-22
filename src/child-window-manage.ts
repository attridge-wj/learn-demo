import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import * as path from 'path'

let childWindow: BrowserWindow | null = null

function buildQuery(params?: Record<string, any>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  const qs = entries
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`
    })
    .join('&')
  return `?${qs}`
}

function getRendererIndexPath(params?: Record<string, any>): string {
  const isDev = !app.isPackaged
  const query = buildQuery(params)
  if (isDev) {
    return `http://localhost:8000/#/child-window${query}`
  }
  const rendererPath = app.isPackaged
    ? path.join(process.resourcesPath, 'renderer/dist/index.html')
    : path.join(__dirname, '../renderer/dist/index.html')
  const fileUrl = `file://${rendererPath.replace(/\\/g, '/')}`
  return `${fileUrl}#/child-window${query}`
}

export function createOrShowChildWindow(params?: Record<string, any>): void {
  const targetUrl = getRendererIndexPath(params)

  if (childWindow && !childWindow.isDestroyed()) {
    if (!childWindow.isVisible()) {
      childWindow.show()
    }
    childWindow.moveTop()
    // 切换到目标路由（带参数）
    childWindow.loadURL(targetUrl)
    return
  }

  childWindow = new BrowserWindow({
    width: 340,
    height: 460,
    resizable: true,
    minimizable: true,
    maximizable: true,
    frame: false,
    transparent: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      webSecurity: false,
      webgl: true,
      enablePreferredSizeMode: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Keep window always on top above all
  // Mac平台使用floating层级避免遮挡输入法候选词，Windows平台使用screen-saver层级
  const level = process.platform === 'darwin' ? 'floating' : 'screen-saver'
  childWindow.setAlwaysOnTop(true, level)
  childWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  childWindow.loadURL(targetUrl)
  const isDev = !app.isPackaged;
  if (isDev) {
    childWindow.webContents.openDevTools();
  }

  childWindow.on('closed', () => {
    childWindow = null
  })
}

export function toggleChildWindow(): void {
  if (childWindow && !childWindow.isDestroyed()) {
    if (childWindow.isVisible()) {
      childWindow.hide()
    } else {
      childWindow.show()
      childWindow.moveTop()
    }
  } else {
    createOrShowChildWindow()
  }
}

export function closeChildWindow(): void {
  if (!childWindow || childWindow.isDestroyed()) return
  try {
    childWindow.webContents.session.clearStorageData()
    childWindow.webContents.session.clearCache()
  } catch {}
  childWindow.close()
  childWindow = null
}

export function registerChildWindowShortcut(): void {
  // Ensure called after app is ready
  const ok = globalShortcut.register('Control+Q', () => {
    toggleChildWindow()
  })
  if (!ok) {
    console.warn('Failed to register Ctrl+Q shortcut for child window')
  }
  app.on('will-quit', () => {
    globalShortcut.unregister('Control+Q')
  })
}

ipcMain.on('child-window-close', () => {
  childWindow?.webContents.session.clearStorageData(); // 清除缓存
  childWindow?.webContents.session.clearCache();
  childWindow?.close();
});

ipcMain.on('child-window-open', (_event, params?: Record<string, any>) => {
  createOrShowChildWindow(params);
});

