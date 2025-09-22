import { BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { registerChildWindowShortcut } from './child-window-manage'
import { embeddedWebViewerManager } from './web-viewer-embedded'

let mainWindow: BrowserWindow | null = null;

export function createWindow() {
  const isDev = !app.isPackaged;
  let iconPath: string;
  if (isDev) {
    iconPath = path.join(__dirname, '../src/assets/icons/dev/icon-512x512.png');
  } else {
    // 根据操作系统选择对应的图标文件
    switch (process.platform) {
      case 'win32':
        iconPath = path.join(__dirname, '../assets/icons/windows/icon.ico');
        break;
      case 'darwin':
        iconPath = path.join(__dirname, '../assets/icons/macos/icon.icns');
        break;
      case 'linux':
        iconPath = path.join(__dirname, '../assets/icons/linux/icon-512x512.png');
        break;
      default:
        iconPath = path.join(__dirname, '../assets/icons/dev/icon-512x512.png');
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 500,
    minHeight: 300,
    resizable: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 8, y: 9 },
    frame: false,
    icon: iconPath,
    webPreferences: {
      webviewTag: true,
      webSecurity: true, // 关闭同源策略
      // contextIsolation: false, // 关闭上下文隔离
      webgl: true,
      enablePreferredSizeMode: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // 主进程中
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.clearHistory(); // 清除历史缓存
  });


  // 加载渲染进程的 index.html
  if (isDev) {
    // 开发环境：使用本地服务器
    mainWindow.loadURL('http://localhost:8000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：使用打包后的文件
    const rendererPath = app.isPackaged
      ? path.join(process.resourcesPath, 'renderer/dist/index.html')
      : path.join(__dirname, '../renderer/dist/index.html');

    console.log('加载渲染进程路径:', rendererPath);
    mainWindow.loadFile(rendererPath);
    // mainWindow.webContents.openDevTools()

  }
  // 自定义菜单栏，这里我们定义一个空的模板来去除默认工具栏,此处mac不执行这个逻辑
  if (process.platform !== 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
  });

  ipcMain.on('window-minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  });

  // 注册子窗口快捷键（Ctrl+E）
  registerChildWindowShortcut()
  
  // 设置嵌入式web查看器的主窗口引用
  embeddedWebViewerManager.setMainWindow(mainWindow)
}

export function getMainWindow() {
  return mainWindow;
}
