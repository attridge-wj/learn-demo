// WebDAV同步客户端 - 优化版本
import { WebDavDto, SyncFile } from '../dto/index'
import fs from 'fs-extra'
import * as path from 'path'
import { mergeIncrementalData } from '../../../database/sync-data'
import { SyncStateManager } from './sync-state-manager';
import { SyncStatus, SyncDirection, SyncType, FileSyncInfo } from '../types/sync.types';
import { GlobalSyncManager } from './global-sync-manager';

export class WebDavClient {
  private client: any;
  private config: WebDavDto;

  constructor (config: WebDavDto) {
    this.config = config;
    this.initClient();
  }

  private async initClient() {
    const { createClient } = await import('webdav');
    this.client = createClient(this.config.url, {
      username: this.config.username,
      password: this.config.password
    });
  }

  // 测试连接
  public async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        await this.initClient();
      }
      await this.client.getDirectoryContents('/');
      return true;
    } catch (error) {
      console.error('WebDAV连接测试失败:', error);
      return false;
    }
  }

  /**
   * 上传到云端
   * 业务逻辑：
   * 1. 第一次同步：全量生成数据库文件，同步db和files文件夹
   * 2. 后续同步：根据同步时间生成增量数据，只同步修改的文件
   */
  public async upload(localPath: string, remotePath: string, lastSyncTime?: string): Promise<boolean> {
    try {
      if (!this.client) {
        await this.initClient();
      }

      // 确保本地必要文件夹存在
      await this.ensureRequiredFolders(localPath);

      // 获取上传进度管理器
      const uploadManager = GlobalSyncManager.getManager('webdav', SyncDirection.UPLOAD, SyncType.FILES);
      
      // 获取需要上传的文件列表
      const filesToUpload = await this.getFilesToUpload(localPath, lastSyncTime);
      
      if (filesToUpload.length > 0) {
        uploadManager.startSync(filesToUpload.length);
        
        // 同步files文件夹
        const filesResult = await this.syncFilesToRemote(localPath, remotePath, filesToUpload, uploadManager);
        
        if (!filesResult) {
          return false;
        }
      }
      
      // 同步db文件夹（数据库备份文件）
      const dbResult = await this.syncDbToRemote(localPath, remotePath);

      return dbResult;
    } catch (error) {
      console.error('WebDAV上传失败:', error);
      return false;
    }
  }

  /**
   * 从云端同步到本地
   * 业务逻辑：
   * 1. 本地无db和files：创建文件夹，全量同步
   * 2. 本地有db和files：增量同步，只处理新的备份文件和修改的文件
   */
  public async syncToLocal(localPath: string, remotePath: string): Promise<boolean> {
    try {
      if (!this.client) {
        await this.initClient();
      }

      // 确保本地必要文件夹存在
      await this.ensureRequiredFolders(localPath);

      // 获取下载进度管理器
      const downloadManager = GlobalSyncManager.getManager('webdav', SyncDirection.DOWNLOAD, SyncType.FILES);
      
      // 获取需要下载的文件列表
      const filesToDownload = await this.getFilesToDownload(localPath, remotePath);
      
      if (filesToDownload.length > 0) {
        downloadManager.startSync(filesToDownload.length);
        
        // 同步files文件夹
        const filesResult = await this.syncFilesFromRemote(localPath, remotePath, filesToDownload, downloadManager);
        
        if (!filesResult) {
          return false;
        }
      }
      
      // 同步数据库备份文件
      const dbResult = await this.syncDatabaseFromRemote(localPath, remotePath);

      return dbResult;
    } catch (error) {
      console.error('WebDAV下载失败:', error);
      return false;
    }
  }

  /**
   * 获取需要上传的文件列表
   */
  private async getFilesToUpload(localPath: string, lastSyncTime?: string): Promise<FileSyncInfo[]> {
    console.log(`扫描本地文件，路径: ${localPath}，上次同步时间: ${lastSyncTime}`);
    
    const uploadManager = GlobalSyncManager.getManager('webdav', SyncDirection.UPLOAD, SyncType.FILES);
    const allFiles = await uploadManager.getFilesToSync(localPath);
    
    console.log(`发现本地文件总数: ${allFiles.length}`);
    if (allFiles.length > 0) {
      console.log('本地文件列表:', allFiles.map(f => f.filePath));
    }
    
    if (!lastSyncTime) {
      // 第一次同步，返回所有文件
      console.log('第一次同步，返回所有文件');
      return allFiles;
    }
    
    // 根据修改时间过滤需要同步的文件
    const lastSyncDate = new Date(lastSyncTime);
    const filteredFiles = allFiles.filter(file => new Date(file.lastModified) > lastSyncDate);
    
    console.log(`根据修改时间过滤后，需要上传的文件数: ${filteredFiles.length}`);
    if (filteredFiles.length > 0) {
      console.log('需要上传的文件:', filteredFiles.map(f => f.filePath));
    }
    
    return filteredFiles;
  }

  /**
   * 获取需要下载的文件列表
   */
  private async getFilesToDownload(localPath: string, remotePath: string): Promise<FileSyncInfo[]> {
    const filesToDownload: FileSyncInfo[] = [];
    
    try {
      const remoteFilesPath = `${remotePath}/files`;
      const remoteExists = await this.checkRemoteExists(remoteFilesPath);
      
      if (!remoteExists) {
        return filesToDownload;
      }

      await this.scanRemoteDirectory(remoteFilesPath, localPath, filesToDownload);
    } catch (error) {
      console.error('扫描远程文件失败:', error);
    }

    return filesToDownload;
  }

  /**
   * 扫描远程目录
   */
  private async scanRemoteDirectory(remoteDirPath: string, localPath: string, filesToDownload: FileSyncInfo[]): Promise<void> {
    const dirContents = await this.client.getDirectoryContents(remoteDirPath);
    
    for (const item of dirContents) {
      const itemName = path.basename(item.filename);
      const remoteItemPath = `${remoteDirPath}/${itemName}`;
      const localItemPath = path.join(localPath, 'files', path.relative(`${remoteDirPath}`, remoteItemPath));
      
      if (item.type === 'directory') {
        await this.scanRemoteDirectory(remoteItemPath, localPath, filesToDownload);
      } else if (item.type === 'file') {
        const needsDownload = await this.shouldDownloadFile(remoteItemPath, localItemPath, item.size || 0);
        if (needsDownload) {
          const relativePath = path.relative(localPath, localItemPath).replace(/\\/g, '/');
          const fileInfo: FileSyncInfo = {
            filePath: relativePath,
            fileName: itemName,
            fileSize: item.size || 0,
            lastModified: new Date(item.lastmod).getTime(),
            status: SyncStatus.PENDING,
            provider: 'webdav'
          };
          filesToDownload.push(fileInfo);
        }
      }
    }
  }

  /**
   * 同步files文件夹到云端
   */
  private async syncFilesToRemote(
    localPath: string, 
    remotePath: string, 
    filesToUpload: FileSyncInfo[], 
    uploadManager: SyncStateManager
  ): Promise<boolean> {
    try {
      console.log(`开始同步files文件夹，共 ${filesToUpload.length} 个文件`);
      
      if (filesToUpload.length === 0) {
        console.log('没有files文件需要上传');
        return true;
      }

      const remoteFilesPath = `${remotePath}/files`;
      console.log(`确保远程files目录存在: ${remoteFilesPath}`);
      await this.ensureRemoteDirectoryExists(remoteFilesPath);

      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const fileInfo of filesToUpload) {
        uploadManager.setCurrentFile(fileInfo.filePath);
        
        const localFilePath = path.join(localPath, fileInfo.filePath);
        const remoteFilePath = `${remotePath}/${fileInfo.filePath}`;
        
        console.log(`处理文件: ${fileInfo.filePath}`);
        
        try {
          // 检查本地文件是否存在
          if (!(await fs.pathExists(localFilePath))) {
            console.error(`本地文件不存在: ${localFilePath}`);
            uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.FAILED, '本地文件不存在');
            failedCount++;
            continue;
          }

          // 检查远程文件是否存在，如果存在且不同则覆盖（以本地为准）
          const remoteExists = await this.checkRemoteExists(remoteFilePath);
          if (remoteExists) {
            const needsUpload = await this.shouldUploadFile(localFilePath, remoteFilePath, fileInfo.fileSize);
            if (needsUpload) {
              console.log(`文件需要更新: ${fileInfo.filePath}`);
              await this.uploadFile(localFilePath, remoteFilePath);
              uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SUCCESS);
              successCount++;
              console.log(`文件上传成功: ${fileInfo.filePath}`);
            } else {
              console.log(`文件内容相同，跳过: ${fileInfo.filePath}`);
              uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SKIPPED);
              skippedCount++;
            }
          } else {
            console.log(`新文件上传: ${fileInfo.filePath}`);
            await this.uploadFile(localFilePath, remoteFilePath);
            uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SUCCESS);
            successCount++;
            console.log(`文件上传成功: ${fileInfo.filePath}`);
          }
        } catch (error) {
          console.error(`文件上传失败: ${fileInfo.filePath}`, error);
          uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.FAILED, String(error));
          failedCount++;
        }
      }

      console.log(`files文件夹同步完成 - 成功: ${successCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);
      
      // 如果有文件上传失败，返回false
      if (failedCount > 0) {
        console.error(`有 ${failedCount} 个文件上传失败`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('同步files到云端失败:', error);
      return false;
    }
  }

  /**
   * 同步db文件夹到云端
   */
  private async syncDbToRemote(localPath: string, remotePath: string): Promise<boolean> {
    try {
      const localDbPath = path.join(localPath, 'db', 'webdav');
      const remoteDbPath = `${remotePath}/db/webdav`;

      if (!(await fs.pathExists(localDbPath))) {
        console.log('本地db/webdav文件夹不存在，跳过同步');
        return true;
      }

      console.log(`开始同步db文件夹: ${localDbPath} -> ${remoteDbPath}`);

      // 确保远程db目录存在
      await this.ensureRemoteDirectoryExists(`${remotePath}/db`);
      await this.ensureRemoteDirectoryExists(remoteDbPath);

      // 获取数据库同步管理器
      const dbSyncManager = GlobalSyncManager.getManager('webdav', SyncDirection.UPLOAD, SyncType.DATABASE);
      
      // 同步所有.json备份文件
      const files = await fs.readdir(localDbPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`发现 ${jsonFiles.length} 个数据库备份文件`);

      // 获取之前失败的db文件列表
      const dbFileTracker = dbSyncManager.tracker;
      const failedDbFiles = dbFileTracker.getFailedFilesList();
      
      if (failedDbFiles.length > 0) {
        console.log(`发现 ${failedDbFiles.length} 个之前同步失败的数据库文件，将重试同步`);
        
        // 添加失败的文件到待同步列表中
        for (const failedFile of failedDbFiles) {
          const fileName = path.basename(failedFile);
          if (fileName.endsWith('.json') && !jsonFiles.includes(fileName)) {
            jsonFiles.push(fileName);
          }
        }
      }

      let successCount = 0;
      let failedCount = 0;

      for (const file of jsonFiles) {
        try {
          const localFilePath = path.join(localDbPath, file);
          const remoteFilePath = `${remoteDbPath}/${file}`;
          const dbFilePath = `db/webdav/${file}`;
          
          // 检查本地文件是否存在
          if (!(await fs.pathExists(localFilePath))) {
            console.log(`本地数据库文件不存在，跳过: ${file}`);
            continue;
          }
          
          console.log(`上传数据库备份文件: ${file}`);
          await this.uploadFile(localFilePath, remoteFilePath);
          console.log(`成功上传: ${file}`);
          
          // 更新数据库文件同步状态为成功
          dbFileTracker.updateFileStatus(dbFilePath, SyncStatus.SUCCESS);
          successCount++;
        } catch (fileError) {
          console.error(`上传数据库备份文件失败: ${file}`, fileError);
          
          // 将失败的文件添加到失败列表
          const dbFilePath = `db/webdav/${file}`;
          dbFileTracker.updateFileStatus(dbFilePath, SyncStatus.FAILED, String(fileError));
          failedCount++;
        }
      }

      console.log(`数据库文件同步完成 - 成功: ${successCount}, 失败: ${failedCount}`);
      
      return failedCount === 0; // 如果有失败的文件，返回false
    } catch (error) {
      console.error('同步db到云端失败:', error);
      return false;
    }
  }

  /**
   * 同步files从云端到本地
   */
  private async syncFilesFromRemote(
    localPath: string, 
    remotePath: string, 
    filesToDownload: FileSyncInfo[], 
    downloadManager: SyncStateManager
  ): Promise<boolean> {
    try {
      for (const fileInfo of filesToDownload) {
        downloadManager.setCurrentFile(fileInfo.filePath);
        
        const localFilePath = path.join(localPath, fileInfo.filePath);
        const remoteFilePath = `${remotePath}/${fileInfo.filePath}`;
        
        try {
          // 确保本地目录存在
          await fs.ensureDir(path.dirname(localFilePath));
          
          // 如果本地文件存在且已被修改，先删除
          if (await fs.pathExists(localFilePath)) {
            await fs.remove(localFilePath);
          }
          
          const fileBuffer = await this.client.getFileContents(remoteFilePath);
          await fs.writeFile(localFilePath, fileBuffer);
          
          downloadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SUCCESS);
        } catch (error) {
          downloadManager.updateFileStatus(fileInfo.filePath, SyncStatus.FAILED, String(error));
        }
      }

      return true;
    } catch (error) {
      console.error('从云端同步files失败:', error);
      return false;
    }
  }

  /**
   * 同步数据库从云端到本地
   */
  private async syncDatabaseFromRemote(localPath: string, remotePath: string): Promise<boolean> {
    try {
      // 获取云端备份文件列表
      const remoteBackupFiles = await this.getBackupFiles(remotePath);
      if (remoteBackupFiles.length === 0) {
        return true;
      }

      // 确保本地db/webdav目录存在
      const localDbPath = path.join(localPath, 'db', 'webdav');
      await fs.ensureDir(localDbPath);

      // 获取本地已有的备份文件
      const localBackupFiles = await this.getLocalBackupFiles(localDbPath);

      // 找出需要下载的新文件
      const newBackupFiles = remoteBackupFiles.filter(remote => 
        !localBackupFiles.includes(remote.fileName)
      );

      if (newBackupFiles.length === 0) {
        return true;
      }

      // 下载新的备份文件并合并数据
      const newBackupFilesData: Array<{
        fileName: string;
        encryptedData: any;
        timestamp: string;
      }> = [];

      for (const backupFile of newBackupFiles) {
        const fileContent = await this.downloadBackupFile(remotePath, backupFile.fileName);
        if (fileContent) {
          // 保存到本地
          const localFilePath = path.join(localDbPath, backupFile.fileName);
          await fs.writeFile(localFilePath, fileContent);

          // 收集数据用于合并
          const encryptedData = JSON.parse(fileContent.toString());
          newBackupFilesData.push({
            fileName: backupFile.fileName,
            encryptedData,
            timestamp: backupFile.timestamp
          });
        }
      }

      // 按时间顺序合并新下载的备份数据
      if (newBackupFilesData.length > 0) {
        // 按时间戳排序
        newBackupFilesData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        await mergeIncrementalData(newBackupFilesData);
      }

      return true;
    } catch (error) {
      console.error('从云端同步数据库失败:', error);
      return false;
    }
  }

  /**
   * 判断是否需要上传文件（比较文件大小）
   */
  private async shouldUploadFile(localPath: string, remotePath: string, localSize: number): Promise<boolean> {
    try {
      const remoteInfo = await this.getRemoteFileInfo(remotePath);
      if (!remoteInfo) {
        return true; // 远程文件不存在，需要上传
      }
      
      // 比较文件大小
      return localSize !== remoteInfo.size;
    } catch (error) {
      return true; // 出错时默认上传
    }
  }

  /**
   * 判断是否需要下载文件
   */
  private async shouldDownloadFile(remotePath: string, localPath: string, remoteSize: number): Promise<boolean> {
    try {
      const localExists = await fs.pathExists(localPath);
      if (!localExists) {
        return true; // 本地文件不存在，需要下载
      }
      
      const localStats = await fs.stat(localPath);
      const localSize = localStats.size;
      
      // 比较文件大小
      return localSize !== remoteSize;
    } catch (error) {
      return true; // 出错时默认下载
    }
  }

  /**
   * 上传文件到云端
   */
  private async uploadFile(localPath: string, remotePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(localPath);
      
      // 先尝试直接上传，如果目录不存在再创建
      try {
        await this.client.putFileContents(remotePath, fileContent);
      } catch (firstError: any) {
        if (firstError.status === 404 || firstError.response?.status === 404) {
          // 目录不存在，先创建目录再上传
          await this.ensureRemoteDirectoryExists(path.dirname(remotePath));
          await this.client.putFileContents(remotePath, fileContent);
        } else if (firstError.status === 409 || firstError.response?.status === 409) {
          // 409冲突，可能是坚果云的特殊行为，尝试重新上传
          console.log(`检测到409冲突，重试上传: ${remotePath}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
          await this.client.putFileContents(remotePath, fileContent);
        } else {
          throw firstError;
        }
      }
    } catch (error: any) {
      console.error(`上传文件失败: ${remotePath}`, {
        status: error.status,
        message: error.message,
        response: error.response?.status
      });
      throw error;
    }
  }

  /**
   * 获取远程文件信息
   */
  private async getRemoteFileInfo(remotePath: string): Promise<{ size: number } | null> {
    try {
      const stat = await this.client.stat(remotePath);
      return {
        size: stat.size || 0
      };
    } catch (error) {
      return null; // 文件不存在
    }
  }

  /**
   * 确保远程目录存在
   */
  private async ensureRemoteDirectoryExists(remotePath: string): Promise<void> {
    try {
      const exists = await this.checkRemoteExists(remotePath);
      if (!exists) {
        await this.createDirectoryRecursively(remotePath);
      }
    } catch (error: any) {
      // 忽略409冲突（目录已存在）和405方法不允许
      if (error.status !== 409 && error.response?.status !== 409 && 
          error.status !== 405 && error.response?.status !== 405) {
        console.error(`创建远程目录失败: ${remotePath}`, {
          status: error.status,
          message: error.message,
          response: error.response?.status
        });
        throw error;
      }
    }
  }

  /**
   * 递归创建目录
   */
  private async createDirectoryRecursively(remotePath: string): Promise<void> {
    if (!remotePath || remotePath === '/' || remotePath === '.') {
      return;
    }

    const parentPath = path.dirname(remotePath);
    if (parentPath !== remotePath && parentPath !== '/' && parentPath !== '.') {
      // 确保父目录存在
      const parentExists = await this.checkRemoteExists(parentPath);
      if (!parentExists) {
        await this.createDirectoryRecursively(parentPath);
      }
    }

    try {
      await this.client.createDirectory(remotePath);
    } catch (error: any) {
      // 忽略409冲突（目录已存在）
      if (error.status !== 409 && error.response?.status !== 409) {
        throw error;
      }
    }
  }

  /**
   * 检查远程路径是否存在
   */
  private async checkRemoteExists(remotePath: string): Promise<boolean> {
    try {
      await this.client.stat(remotePath);
      return true;
    } catch (error: any) {
      // 404表示不存在，405可能是坚果云的特殊响应
      if (error.status === 404 || error.response?.status === 404 ||
          error.status === 405 || error.response?.status === 405) {
        return false;
      }
      
      // 对于其他错误，尝试用getDirectoryContents检查
      try {
        await this.client.getDirectoryContents(remotePath);
        return true;
      } catch (secondError: any) {
        if (secondError.status === 404 || secondError.response?.status === 404) {
          return false;
        }
        // 如果还是失败，记录日志但不抛出错误
        console.warn(`检查远程路径存在性时出现未知错误: ${remotePath}`, {
          firstError: error.status,
          secondError: secondError.status
        });
        return false; // 保守处理，假设不存在
      }
    }
  }

  /**
   * 获取云端备份文件列表
   */
  public async getBackupFiles(remotePath: string): Promise<Array<{
    fileName: string;
    timestamp: string;
    size: number;
  }>> {
    try {
      if (!this.client) {
        await this.initClient();
      }
      
      const backupPath = `${remotePath}/db/webdav`;
      const contents = await this.client.getDirectoryContents(backupPath);
      
      const files: Array<{
        fileName: string;
        timestamp: string;
        size: number;
      }> = [];
      
      for (const item of contents) {
        if (item.type === 'file' && item.filename.endsWith('.json')) {
          const fileName = item.filename.includes('/') 
            ? item.filename.split('/').pop() || item.filename
            : item.filename;
            
          files.push({
            fileName: fileName,
            timestamp: new Date(item.lastmod).toISOString(),
            size: item.size || 0
          });
        }
      }
      
      // 按时间戳排序
      return files.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.error('获取云端备份文件失败:', error);
      return [];
    }
  }

  /**
   * 下载指定备份文件
   */
  public async downloadBackupFile(remotePath: string, fileName: string): Promise<Buffer | null> {
    try {
      if (!this.client) {
        await this.initClient();
      }
      
      const filePath = `${remotePath}/db/webdav/${fileName}`;
      const content = await this.client.getFileContents(filePath);
      
      if (content instanceof Buffer) {
        return content;
      } else if (typeof content === 'string') {
        return Buffer.from(content, 'utf-8');
      } else {
        return Buffer.from(content);
      }
    } catch (error) {
      console.error(`下载备份文件 ${fileName} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取本地备份文件列表
   */
  private async getLocalBackupFiles(localBackupPath: string): Promise<string[]> {
    try {
      if (!(await fs.pathExists(localBackupPath))) {
        return [];
      }
      
      const files = await fs.readdir(localBackupPath);
      return files.filter(file => file.endsWith('.json') && file.includes('rebirth-data-'));
    } catch (error) {
      console.error(`读取本地备份文件失败: ${localBackupPath}`, error);
      return [];
    }
  }

  /**
   * 确保必要的文件夹结构存在
   */
  private async ensureRequiredFolders(rootPath: string): Promise<void> {
    try {
      const filesPath = path.join(rootPath, 'files');
      const dbPath = path.join(rootPath, 'db');
      
      // 确保files文件夹存在
      const filesExists = await fs.pathExists(filesPath);
      if (!filesExists) {
        await fs.ensureDir(filesPath);
      }
      
      // 确保db文件夹存在
      const dbExists = await fs.pathExists(dbPath);
      if (!dbExists) {
        await fs.ensureDir(dbPath);
        // 为新创建的db文件夹生成初始备份
        await this.createInitialBackup(rootPath);
      }
    } catch (error) {
      console.error('初始化必要文件夹失败:', error);
      throw error;
    }
  }

  /**
   * 创建初始数据备份
   */
  private async createInitialBackup(rootPath: string): Promise<void> {
    try {
      const { getIncrementalData } = await import('../../../database/sync-data');
      const backupResult = await getIncrementalData(null, 'webdav');
      
      if (backupResult.hasData) {
        console.log(`初始备份创建完成: ${backupResult.backupFileName}`);
      }
    } catch (error) {
      console.error('创建初始备份失败:', error);
      // 不抛出错误，允许同步继续进行
    }
  }

  /**
   * 清空远程备份数据
   */
  public async clearRemoteBackupData(): Promise<boolean> {
    try {
      console.log('开始清空WebDAV远程备份数据');
      
      // 获取远程备份目录路径
      const remoteBackupPath = `${this.config.basePath || ''}/db/webdav`;
      
      // 检查远程备份目录是否存在
      const backupExists = await this.checkRemoteExists(remoteBackupPath);
      if (!backupExists) {
        console.log('远程备份目录不存在，无需清空');
        return true;
      }
      
      // 获取远程备份目录下的所有文件
      const files = await this.client.getDirectoryContents(remoteBackupPath);
      const backupFiles = files.filter((item: any) => 
        item.type === 'file' && item.basename.endsWith('.json')
      );
      
      console.log(`发现 ${backupFiles.length} 个远程备份文件需要删除`);
      
      let successCount = 0;
      let failedCount = 0;
      
      // 删除所有备份文件
      for (const file of backupFiles) {
        try {
          const filePath = `${remoteBackupPath}/${file.basename}`;
          await this.client.deleteFile(filePath);
          console.log(`成功删除远程备份文件: ${file.basename}`);
          successCount++;
        } catch (error) {
          console.error(`删除远程备份文件失败: ${file.basename}`, error);
          failedCount++;
        }
      }
      
      console.log(`WebDAV远程备份数据清空完成 - 成功: ${successCount}, 失败: ${failedCount}`);
      
      return failedCount === 0;
    } catch (error) {
      console.error('清空WebDAV远程备份数据失败:', error);
      return false;
    }
  }
}

// 测试连接方法
export const testWebDavConfig = async (webDavDto: WebDavDto): Promise<boolean> => {
  const client = new WebDavClient(webDavDto);
  return await client.testConnection();
}