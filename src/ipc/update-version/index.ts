import { app, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import log from 'electron-log';

// 配置日志
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 更新服务器地址配置
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-update-server.com' // 需要替换为实际的更新服务器地址
});

// 检查更新
export function checkForUpdates(mainWindow: Electron.BrowserWindow) {
  // 检查更新出错
  autoUpdater.on('error', (err: Error) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  // 检查更新
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update');
  });

  // 有可用更新
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send('update-available', info);
  });

  // 没有可用更新
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    mainWindow.webContents.send('update-not-available', info);
  });

  // 更新下载进度
  autoUpdater.on('download-progress', (progressObj: {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  }) => {
    mainWindow.webContents.send('download-progress', progressObj);
  });

  // 更新下载完成
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow.webContents.send('update-downloaded', info);
  });

  // 开始检查更新
  autoUpdater.checkForUpdates();
}

// 注册IPC通信事件
export function registerUpdateEvents(mainWindow: Electron.BrowserWindow) {
  // 手动检查更新
  ipcMain.handle('check-for-updates', () => {
    checkForUpdates(mainWindow);
  });

  // 下载更新
  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate();
  });

  // 安装更新
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

// 自动检查更新（可以在app ready后调用）
export function setupAutoUpdater(mainWindow: Electron.BrowserWindow) {
  // 设置自动下载
  autoUpdater.autoDownload = false;
  
  // 每小时检查一次更新
  setInterval(() => {
    checkForUpdates(mainWindow);
  }, 60 * 60 * 1000);

  // 初始检查
  checkForUpdates(mainWindow);
}
