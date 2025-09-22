import { ipcMain, IpcMainInvokeEvent } from 'electron'
import store from '../../utils/store';
import { getImageBase64 } from './services/image.service';
import { openFileWithSystemApp, selectFolder, selectFile, selectSaveFile } from './services/file-open.service';
import { openUrl } from './services/url.service';
import { getSystemDeviceInfo } from './services/device-info.service';
import { revealInExplorer } from './services/reveal-explorer.service';
import { getDirectoryStructure } from './services/directory-structure.service';
import { getWebMetadata } from './services/web-metadata.service';
import { BrowserWindow } from 'electron'
import { appStartParamsManager } from '../../app-start-params'

export function setupSystemIPC(): void {
  // 保存系统配置
  ipcMain.handle('system:configSave', async (_event: IpcMainInvokeEvent, config: any) => {
    store.set('systemConfig', config)
    return true
  })
  // 获取系统配置
  ipcMain.handle('system:configGet', async (_event: IpcMainInvokeEvent) => {
    return store.get('systemConfig')
  })

  // 通过路径使用本地应用打开文件
  ipcMain.handle('system:openFile', async (_event: IpcMainInvokeEvent, filePathParam: string) => {
    return await openFileWithSystemApp(filePathParam);
  })

  // 选择文件夹弹框
  ipcMain.handle('system:selectFolder', async (_event: IpcMainInvokeEvent) => {
    return await selectFolder();
  })

  // 选择文件弹框
  ipcMain.handle('system:selectFile', async (_event: IpcMainInvokeEvent, options?: any) => {
    return await selectFile(options);
  })

  // 保存文件弹框
  ipcMain.handle('system:selectSaveFile', async (_event: IpcMainInvokeEvent, options?: any) => {
    return await selectSaveFile(options);
  })

  // 获取user-data://或app://开头的图片地址对应的base64数据
  ipcMain.handle('system:getImageBase64', async (_event: IpcMainInvokeEvent, imageUrl: string) => {
    return await getImageBase64(imageUrl);
  })

  // 打开http/https链接
  ipcMain.handle('system:openUrl', async (_event: IpcMainInvokeEvent, url: string) => {
    return await openUrl(url);
  })

  // 获取设备信息，包含设备mac地址等等，兼容mac，win，linux
  ipcMain.handle('system:getDeviceInfo', async (_event: IpcMainInvokeEvent) => {
    return await getSystemDeviceInfo();
  })

  // 在系统资源管理器中打开指定目录
  ipcMain.handle('system:revealInExplorer', async (_event: IpcMainInvokeEvent, dirPath: string) => {
    return await revealInExplorer(dirPath);
  })

  // 获取文件夹目录结构
  ipcMain.handle('system:getDirectoryStructure', async (
    _event: IpcMainInvokeEvent, 
    dirPath: string, 
    options: {
      indentSize?: number;
      indentChar?: string;
      maxDepth?: number;
      includeHidden?: boolean;
      includeFiles?: boolean;
      includeDirectories?: boolean;
      excludePatterns?: string[];
    } = {}
  ) => {
    return await getDirectoryStructure(dirPath, options);
  })

  // 获取网页元数据（标题、概要、图标）
  ipcMain.handle('system:getWebMetadata', async (_event: IpcMainInvokeEvent, url: string) => {
    try {
      const metadata = await getWebMetadata(url)
      return metadata
    } catch (error) {
      return {
        title: '',
        description: '',
        icon: '',
        url,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 新增：渲染进程触发主进程广播事件到所有窗口
  ipcMain.handle('system:broadcast', async (_event: IpcMainInvokeEvent, channel: string, payload?: any) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      try { win.webContents.send(channel, payload) } catch {}
    }
    return { ok: true, sentTo: windows.length }
  })

  // 应用启动参数相关IPC
  // 获取当前参数
  ipcMain.handle('app-params:get', async (_event: IpcMainInvokeEvent) => {
    return appStartParamsManager.getParams();
  })

  // 清空当前参数
  ipcMain.handle('app-params:clear', async (_event: IpcMainInvokeEvent) => {
    appStartParamsManager.clearParams();
    return { success: true };
  })
}