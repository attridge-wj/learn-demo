import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupUserIPC } from './ipc/user'
import { setupCardIPC } from './ipc/card'
import { setupRecentlyOpenIPC } from './ipc/recent-open'
import { setupSpaceIPC } from './ipc/space'
import { setupTagIPC } from './ipc/tag'
import { setupCardBoxIPC } from './ipc/card-box'
import { setupExportLocalIPC } from './ipc/export-local'
import { setupWebViewerIPC } from './ipc/web-viewer'
import { setupAiManageIPC } from './ipc/ai-manage'
import { setupSyncIPC } from './ipc/sync'
import { setupCollectIPC } from './ipc/collect'
import { initDatabase, closeDatabase } from './database/connection'
import { setupStorageIPC } from './ipc/storage'
import { setupSystemIPC } from './ipc/system'
import { setupDocumentIPC } from './ipc/document'
import { setupContentIndexIPC } from './ipc/content-index'
import { autoCleanupUnknownDocuments } from './ipc/content-index/service/auto-cleanup.service'
import { createWindow } from './window-manage'
import { registerProtocol, registerProtocolApp, handleProtocol, handleProtocolApp } from './custom-protocol'
import { setupEmbeddedWebViewerIPC } from './web-viewer-embedded'
import { initData } from './database/data-init'
import { startWebClipperSocket } from './web-clipper-socket'
import { setupAppMenu } from './menu'
import { appStartParamsManager } from './app-start-params'

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 检查是否已经有实例在运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果已经有实例在运行，退出当前实例
  console.log('应用已经在运行，退出当前实例');
  app.quit();
} else {
  // 注册协议（在 app.whenReady 之前）
  registerProtocolApp();
  registerProtocol();

  // 设置协议客户端（让系统知道如何处理 rebirth:// 链接）
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('rebirth', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('rebirth');
  }

  // 处理启动参数
  appStartParamsManager.handleStartupParams();

  // 监听协议启动事件（从浏览器或其他应用启动）
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url.startsWith('rebirth://')) {
      appStartParamsManager.handleRuntimeParams(url);
    }
  });

  // Windows 平台特殊处理
  if (process.platform === 'win32') {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // 处理第二个实例启动时的参数
      console.log('检测到第二个实例启动，处理协议参数');
      for (const arg of commandLine) {
        if (arg.startsWith('rebirth://')) {
          // 应用已运行，直接处理参数
          appStartParamsManager.handleRuntimeParams(arg);
        }
      }
    });
  }

  app.whenReady().then(async () => {
    // 设置应用图标
    const isDev = !app.isPackaged;
    let iconPath: string;
    if (isDev) {
      iconPath = path.join(__dirname, '../src/assets/icons/dev/icon-512x512.png');
    } else {
      // 根据操作系统选择对应的图标文件
      switch (process.platform) {
        case 'win32':
          iconPath = path.join(__dirname, 'assets/icons/windows/icon.ico');
          break;
        case 'darwin':
          iconPath = path.join(__dirname, 'dist/assets/icons/macos/icon.icns');
          break;
        case 'linux':
          iconPath = path.join(__dirname, 'dist/assets/icons/linux/icon-512x512.png');
          break;
        default:
          iconPath = path.join(__dirname, 'dist/assets/icons/dev/icon-512x512.png');
      }
    }
    
    // 调试信息：输出图标路径
    console.log('图标路径:', iconPath);
    console.log('__dirname:', __dirname);
    console.log('文件是否存在:', require('fs').existsSync(iconPath));
    
    if (process.platform === 'darwin') {
      try {
        app.dock?.setIcon(iconPath);
        console.log('Dock 图标设置成功');
      } catch (error) {
        console.warn('设置 Dock 图标失败:', error);
        // 尝试使用默认图标
        try {
          const defaultIconPath = path.join(__dirname, 'assets/icons/dev/icon-512x512.png');
          if (require('fs').existsSync(defaultIconPath)) {
            app.dock?.setIcon(defaultIconPath);
            console.log('使用默认图标成功');
          }
        } catch (defaultError) {
          console.warn('使用默认图标也失败:', defaultError);
        }
      }
    }
    
    // 初始化数据库
    await initDatabase()
    // 初始化数据
    initData();
    
    // macOS 设置应用菜单以启用剪切/复制/粘贴快捷键
    if (process.platform === 'darwin') {
      console.log('macOS 设置应用菜单以启用剪切/复制/粘贴快捷键')
      setupAppMenu()
    }
    
    // 初始化窗口（Windows 平台会在这里设置自定义菜单）
    createWindow();
    // 初始化ipc
    setupUserIPC();
    setupCardIPC();
    setupSpaceIPC();
    setupTagIPC();
    setupCollectIPC();
    setupRecentlyOpenIPC();
    setupCardBoxIPC();
    setupExportLocalIPC();
    setupWebViewerIPC();
    setupAiManageIPC();
    setupStorageIPC();
    setupSyncIPC();
    setupSystemIPC();
    setupDocumentIPC();
    setupContentIndexIPC();
    setupEmbeddedWebViewerIPC();
    
    // 自动清理未知类型的文档索引（异步执行，不阻塞启动）
    autoCleanupUnknownDocuments().catch(error => {
      console.error('自动清理失败:', error)
    })
    
    // 启动剪藏 WebSocket 服务
    startWebClipperSocket()
    // 处理协议请求（在 setupStoreIPC 之后）
    handleProtocol();
    handleProtocolApp();
    
    // 初始化窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', async () => {
    await closeDatabase()
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 记录错误到文件
    console.error('Stack trace:', error.stack);
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // 处理渲染进程崩溃
  app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details);
    if (details.reason === 'crashed') {
      console.log('Render process crashed, attempting to reload...');
      webContents.reload();
    }
  });

  // 处理子进程崩溃
  app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
  });
} 