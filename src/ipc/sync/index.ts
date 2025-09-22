import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { WebDavDto, S3Dto } from './dto/index'
import store from '../../utils/store'
import { getDefaultStoragePath } from '../../utils/file'
import { WebDavClient } from './util/webdav'
import { S3Client } from './util/s3'
import { getIncrementalData, mergeIncrementalData } from '../../database/sync-data'
import { SyncStateManager } from './util/sync-state-manager'
import { GlobalSyncManager } from './util/global-sync-manager'
import { SyncDirection, SyncType, SyncStatus } from './types/sync.types'
/**
 * 数据及文件同步设置
 */
export function setupSyncIPC(): void {
  ipcMain.handle('sync:getUploadTime', async (_event: IpcMainInvokeEvent, type: string) => {
    const uploadTime = store.get(`${type}-uploadTime`)
    return uploadTime
  })
  ipcMain.handle('sync:getSyncTime', async (_event: IpcMainInvokeEvent, type: string) => {
    const syncTime = store.get(`${type}-syncTime`)
    return syncTime
  })
  /**
   * webdav配置
   */
  // 保存webdav配置
  ipcMain.handle('sync:webdavSave', async (_event: IpcMainInvokeEvent, webdavDto: WebDavDto) => {
    store.set('webdavConfig', webdavDto)
    return true
  })
  // 测试webdav配置
  ipcMain.handle('sync:webdavTest', async (_event: IpcMainInvokeEvent, webdavDto: WebDavDto) => {
    const client = new WebDavClient({
      ...webdavDto
    })
    const result = await client.testConnection()
    return result
  })
  // 获取webdav配置
  ipcMain.handle('sync:webdavGet', async (_event: IpcMainInvokeEvent) => {
    const webdavConfig = store.get('webdavConfig')
    return webdavConfig
  })
  // webDav数据上传
  ipcMain.handle('sync:webdavUpload', async (_event: IpcMainInvokeEvent) => {
    const webdavConfig = store.get('webdavConfig')
    if (!webdavConfig) {
      return false
    }
    
    const client = new WebDavClient({
      ...webdavConfig
    })
    
    try {
      console.log(webdavConfig.basePath, 'webdavConfig.basePath');
      // 检查云端是否已有备份文件
      const remoteBackupFiles = await client.getBackupFiles(webdavConfig.basePath);
      console.log(remoteBackupFiles, 'remoteBackupFiles');
      const isFirstSync = remoteBackupFiles.length === 0;

      console.log(isFirstSync, 'isFirstSync');
      // 获取增量数据，传递webdav标识
      const lastSyncTime = store.get('webdav-uploadTime');
      const incrementalResult = await getIncrementalData(isFirstSync ? null : lastSyncTime, 'webdav');
      console.log(incrementalResult, 'incrementalResult');
      
      // 检查是否有数据需要同步
      if (!incrementalResult.hasData) {
        console.log('没有数据需要同步，跳过上传');
        return true; // 返回成功，但不执行实际上传
      }
      
      // 上传数据
    const localPath = store.get('storagePath') || getDefaultStoragePath();
      const remotePath = webdavConfig.basePath;
      console.log(localPath, remotePath, 'localPath, remotePath');
      // 不再删除远程db目录，保留所有备份文件
      const result = await client.upload(localPath, remotePath);
      console.log(result, 'result');
      if (result) {
        // 更新同步时间，使用统一的本地时间格式
        const { getSyncTimeFormat } = await import('../../common/util/time.util');
        const localTimeString = getSyncTimeFormat();
        
        store.set('webdav-uploadTime', localTimeString);
        // 记录已同步的备份文件
        store.set('webdav-lastBackupFile', incrementalResult.backupFileName);
        store.set('webdav-syncCount', (store.get('webdav-syncCount') || 0) + 1);
      }
      
      return result;
    } catch (error) {
      console.error('WebDAV上传失败:', error);
      return false;
    }
  })
  // webDav数据下载
  ipcMain.handle('sync:webdavDownload', async (_event: IpcMainInvokeEvent) => {
    const localPath = store.get('storagePath') || getDefaultStoragePath();
    const remotePath = store.get('webdavConfig')?.basePath;
    const webdavConfig = store.get('webdavConfig');
    
    if (!webdavConfig) {
      return false
    }
    
    const client = new WebDavClient({
      ...webdavConfig
    })
    
    try {
      console.log(`开始WebDAV下载: ${remotePath} -> ${localPath}`);
      
      // 直接调用syncToLocal方法，它会处理所有下载和数据恢复逻辑
      const result = await client.syncToLocal(localPath, remotePath);
      
      if (result) {
        // 更新同步时间，使用统一的本地时间格式
        const { getSyncTimeFormat } = await import('../../common/util/time.util');
        const localTimeString = getSyncTimeFormat();
        
        store.set('webdav-syncTime', localTimeString);
        console.log(`WebDAV下载完成，同步时间已更新: ${localTimeString}`);
      }
      
      return result;
    } catch (error) {
      console.error('WebDAV下载失败:', error);
      return false;
    }
  })

  /**
   * s3配置
   */
  // 保存s3配置
  ipcMain.handle('sync:s3Save', async (_event: IpcMainInvokeEvent, s3Dto: S3Dto) => {
    console.log(s3Dto, 's3Dto');
    const provider = s3Dto.provider as string
    store.set('s3Type', provider)
    store.set(`${provider}-s3Config`, s3Dto)
    return true
  })
  // 获取s3配置
  ipcMain.handle('sync:s3Get', async (_event: IpcMainInvokeEvent, provider: string) => {
    const s3Config = store.get(`${provider}-s3Config`)
    return s3Config
  })
   // 获取s3配置
   ipcMain.handle('sync:s3Type', async (_event: IpcMainInvokeEvent) => {
    const s3Type = store.get('s3Type')
    return s3Type
  })
  // 测试s3配置
  ipcMain.handle('sync:s3Test', async (_event: IpcMainInvokeEvent, s3Dto: S3Dto) => {
    const client = new S3Client({
      ...s3Dto,
      provider: s3Dto.provider as 'aws' | 'tencent' | 'aliyun'
    })
    return await client.testConnection()
  })
  //  s3数据上传
  ipcMain.handle('sync:s3Upload', async (_event: IpcMainInvokeEvent, provider: string) => {
    const s3Config = store.get(`${provider}-s3Config`)
    if (!s3Config) {
      return false
    }
    
    const client = new S3Client({
      ...s3Config
    })
    
    try {
      // 检查云端是否已有备份文件
      const remoteBackupFiles = await client.getBackupFiles(s3Config.basePath);
      const isFirstSync = remoteBackupFiles.length === 0;
      
      // 获取增量数据，传递provider标识
      const lastSyncTime = store.get(`${provider}-uploadTime`);
      const incrementalResult = await getIncrementalData(isFirstSync ? null : lastSyncTime, provider);
      
      // 检查是否有数据需要同步
      if (!incrementalResult.hasData) {
        console.log('没有数据需要同步，跳过上传');
        return true; // 返回成功，但不执行实际上传
      }
      
      // 上传数据
      const localPath = store.get('storagePath') || getDefaultStoragePath();
      const remotePath = s3Config.basePath;
      
      const result = await client.upload(localPath, remotePath);
      
      if (result) {
        // 更新同步时间，使用统一的本地时间格式
        const { getSyncTimeFormat } = await import('../../common/util/time.util');
        const localTimeString = getSyncTimeFormat();
        
        store.set(`${provider}-uploadTime`, localTimeString);
        // 记录已同步的备份文件
        store.set(`${provider}-lastBackupFile`, incrementalResult.backupFileName);
        store.set(`${provider}-syncCount`, (store.get(`${provider}-syncCount`) || 0) + 1);
      }
      
      return result;
    } catch (error) {
      console.error('S3上传失败:', error);
      return false;
    }
  })
  // s3数据下载
  ipcMain.handle('sync:s3Download', async (_event: IpcMainInvokeEvent, provider: string) => {
    const localPath = store.get('storagePath') || getDefaultStoragePath()
    const remotePath = store.get(`${provider}-s3Config`)?.basePath
    const s3Config = store.get(`${provider}-s3Config`)
    
    if (!s3Config) {
      return false
    }
    
    const client = new S3Client({
      ...s3Config
    })
    
    try {
      console.log(`开始S3下载: ${remotePath} -> ${localPath}`);
      
      // 直接调用syncToLocal方法，它会处理所有下载和数据恢复逻辑
      const result = await client.syncToLocal(localPath, remotePath);
      
      if (result) {
        // 更新同步时间，使用统一的本地时间格式
        const { getSyncTimeFormat } = await import('../../common/util/time.util');
        const localTimeString = getSyncTimeFormat();
        
        store.set(`${provider}-syncTime`, localTimeString);
        console.log(`S3下载完成，同步时间已更新: ${localTimeString}`);
      }
      
      return result;
    } catch (error) {
      console.error('S3下载失败:', error);
      return false;
    }
  })


  /**
   * 腾讯云cos配置
   */
  // 保存腾讯云cos配置
  ipcMain.handle('sync:tencentSave', async (_event: IpcMainInvokeEvent, tencentDto: S3Dto) => {
    console.log(tencentDto, 'tencentDto');
  })
  // 获取腾讯云cos配置
  ipcMain.handle('sync:tencentGet', async (_event: IpcMainInvokeEvent) => {
    const tencentConfig = store.get('tencentConfig')
    return tencentConfig
  })
  // 腾讯云cos数据上传
  ipcMain.handle('sync:tencentUpload', async (_event: IpcMainInvokeEvent, file: string) => {
    console.log(file, 'file');
    return true
  })
  // 腾讯云cos数据下载
  ipcMain.handle('sync:tencentDownload', async (_event: IpcMainInvokeEvent, file: string) => {
    console.log(file, 'file');
    return true
  })
  // 阿里云oss配置
  ipcMain.handle('sync:aliossSave', async (_event: IpcMainInvokeEvent, aliossDto: S3Dto) => {
    console.log(aliossDto, 'aliossDto');
  })
  // 获取阿里云oss配置
  ipcMain.handle('sync:aliossGet', async (_event: IpcMainInvokeEvent) => {
    const aliossConfig = store.get('aliossConfig')
    return aliossConfig
  })
  // 阿里云oss数据上传
  ipcMain.handle('sync:aliossUpload', async (_event: IpcMainInvokeEvent, file: string) => {
    console.log(file, 'file');
    return true
  })
  // 阿里云oss数据下载
  ipcMain.handle('sync:aliossDownload', async (_event: IpcMainInvokeEvent, file: string) => {
    console.log(file, 'file');
    return true;
  })

  // 新增：获取同步状态
  ipcMain.handle('sync:getStatus', async (_event: IpcMainInvokeEvent, type: string) => {
    const status = {
      lastUploadTime: store.get(`${type}-uploadTime`),
      lastSyncTime: store.get(`${type}-syncTime`),
      lastBackupFile: store.get(`${type}-lastBackupFile`),
      lastSyncedFile: store.get(`${type}-lastSyncedFile`),
      syncCount: store.get(`${type}-syncCount`) || 0,
      processedCount: store.get(`${type}-processedCount`) || 0
    };
    
    return status;
  })

  // 获取同步进度
  ipcMain.handle('sync:getProgress', async (_event: IpcMainInvokeEvent, type: string, direction?: string, syncType?: string) => {
    try {
      const syncDirection = direction as SyncDirection || undefined;
      const syncTypeEnum = syncType as SyncType || undefined;
      
      const progress = GlobalSyncManager.getCurrentProgress(type, syncDirection, syncTypeEnum);
      
      if (progress) {
        // 确保返回的completedFiles只包含成功同步的文件，不包含跳过的
        return {
          ...progress,
          completedFiles: progress.completedFiles.filter(file => file.status === SyncStatus.SUCCESS)
        };
      } else {
        // 返回默认进度对象
        return { 
          provider: type,
          direction: syncDirection || SyncDirection.UPLOAD,
          type: syncTypeEnum || SyncType.FILES,
          percentage: 0,
          totalFiles: 0,
          processedFiles: 0,
          successFiles: 0,
          failedFiles: 0,
          skippedFiles: 0,
          isCompleted: false,
          completedFiles: [], // 只包含成功同步的文件
          failedFilesList: []
        };
      }
    } catch (error) {
      return { 
        provider: type,
        direction: SyncDirection.UPLOAD,
        type: SyncType.FILES,
        error: error instanceof Error ? error.message : String(error), 
        percentage: 0,
        totalFiles: 0,
        processedFiles: 0,
        successFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
        isCompleted: false,
        completedFiles: [], // 只包含成功同步的文件
        failedFilesList: []
      };
    }
  })



  // 新增：清除同步记录
  ipcMain.handle('sync:clearRecords', async (_event: IpcMainInvokeEvent, type: string, direction?: string, syncType?: string) => {
    try {
      const syncDirection = direction as SyncDirection || undefined;
      const syncTypeEnum = syncType as SyncType || undefined;
      
      GlobalSyncManager.clearRecords(type, syncDirection, syncTypeEnum);
      return true;
    } catch (error) {
      return false;
    }
  })

  // 检查同步状态
  ipcMain.handle('sync:checkStatus', async (_event: IpcMainInvokeEvent, type: string, direction?: string, syncType?: string) => {
    try {
      const syncDirection = direction as SyncDirection || undefined;
      const syncTypeEnum = syncType as SyncType || undefined;
      
      const isRunning = GlobalSyncManager.isSyncRunning(type);
      const progress = GlobalSyncManager.getCurrentProgress(type, syncDirection, syncTypeEnum);
      
      return {
        isRunning,
        progress: progress ? {
          ...progress,
          completedFiles: progress.completedFiles.filter(file => file.status === SyncStatus.SUCCESS)
        } : {
          provider: type,
          direction: syncDirection || SyncDirection.UPLOAD,
          type: syncTypeEnum || SyncType.FILES,
          totalFiles: 0,
          processedFiles: 0,
          successFiles: 0,
          failedFiles: 0,
          skippedFiles: 0,
          currentFile: undefined,
          percentage: 0,
          isCompleted: false,
          completedFiles: [], // 只包含成功同步的文件
          failedFilesList: []
        }
      };
    } catch (error) {
      return {
        isRunning: false,
        progress: {
          provider: type,
          direction: SyncDirection.UPLOAD,
          type: SyncType.FILES,
          totalFiles: 0,
          processedFiles: 0,
          successFiles: 0,
          failedFiles: 0,
          skippedFiles: 0,
          currentFile: undefined,
          percentage: 0,
          isCompleted: false,
          completedFiles: [], // 只包含成功同步的文件
          failedFilesList: []
        }
      };
    }
  })

  // 清空备份数据（本地和远程）
  ipcMain.handle('sync:clearBackupData', async (_event: IpcMainInvokeEvent, type: string) => {
    try {
      console.log(`开始清空 ${type} 平台的备份数据`);
      
      const storagePath = getDefaultStoragePath();
      const localDbPath = `${storagePath}/db/${type}`;
      
      // 1. 清空本地备份数据
      console.log(`清空本地备份数据: ${localDbPath}`);
      const fs = await import('fs-extra');
      
      if (await fs.pathExists(localDbPath)) {
        await fs.remove(localDbPath);
        console.log(`本地备份数据已清空: ${localDbPath}`);
      } else {
        console.log(`本地备份数据不存在: ${localDbPath}`);
      }
      
      // 2. 清空远程备份数据
      let remoteClearResult = true;
      
      if (type === 'webdav') {
        const webdavConfig = store.get('webdavConfig');
        if (webdavConfig) {
          const client = new WebDavClient(webdavConfig);
          remoteClearResult = await client.clearRemoteBackupData();
        } else {
          console.log('WebDAV配置不存在，跳过远程清空');
        }
      } else if (['aws', 'tencent', 'aliyun'].includes(type)) {
        const s3Config = store.get(`${type}Config`);
        if (s3Config) {
          const client = new S3Client({ ...s3Config, provider: type });
          remoteClearResult = await client.clearRemoteBackupData();
        } else {
          console.log(`${type}配置不存在，跳过远程清空`);
        }
      }
      
      // 3. 清空相关同步记录
      console.log(`清空 ${type} 平台的同步记录`);
      GlobalSyncManager.clearRecords(type, SyncDirection.UPLOAD, SyncType.DATABASE);
      GlobalSyncManager.clearRecords(type, SyncDirection.DOWNLOAD, SyncType.DATABASE);
      
      // 4. 清空相关时间记录
      store.delete(`${type}-uploadTime`);
      store.delete(`${type}-syncTime`);
      
      console.log(`${type} 平台备份数据清空完成`);
      
      return {
        success: true,
        localCleared: true,
        remoteCleared: remoteClearResult,
        message: `${type} 平台备份数据已清空`
      };
    } catch (error) {
      console.error(`清空 ${type} 平台备份数据失败:`, error);
      return {
        success: false,
        localCleared: false,
        remoteCleared: false,
        message: `清空失败: ${String(error)}`
      };
    }
  })
}

