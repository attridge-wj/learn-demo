// S3同步客户端 - 优化版本
import { S3Client as AWSS3Client, PutObjectCommand, S3ClientConfig, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SyncFile } from '../dto/index';
import fs from 'fs-extra';
import * as path from 'path';
import { mergeIncrementalData } from '../../../database/sync-data';
import { SyncStateManager } from './sync-state-manager';
import { SyncStatus, SyncDirection, SyncType, FileSyncInfo } from '../types/sync.types';
import { GlobalSyncManager } from './global-sync-manager';

interface S3Config {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  provider?: 'aws' | 'tencent' | 'aliyun';
  basePath?: string;
}

export class S3Client {
  private client!: AWSS3Client;
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    this.initClient();
  }

  private initClient() {
    const endpoint = this.getEndpoint();
    const config: S3ClientConfig = {
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId || '',
        secretAccessKey: this.config.secretAccessKey || ''
      }
    };
    
    if (endpoint) {
      config.endpoint = endpoint;
    }
    
    this.client = new AWSS3Client(config);
  }

  private getEndpoint(): string | undefined {
    switch (this.config.provider) {
      case 'aws':
        return undefined; // 使用AWS默认endpoint
      case 'tencent':
        return `https://cos.${this.config.region}.myqcloud.com`;
      case 'aliyun':
        return `https://oss-${this.config.region}.aliyuncs.com`;
      default:
        return undefined;
    }
  }

  // 测试连接
  public async testConnection(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3连接测试失败:', error);
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      // 确保本地必要文件夹存在
      await this.ensureRequiredFolders(localPath);

      // 获取上传进度管理器
      const uploadManager = GlobalSyncManager.getManager(this.config.provider, SyncDirection.UPLOAD, SyncType.FILES);
      
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
      console.error('S3上传失败:', error);
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      // 确保本地必要文件夹存在
      await this.ensureRequiredFolders(localPath);

      // 获取下载进度管理器
      const downloadManager = GlobalSyncManager.getManager(this.config.provider, SyncDirection.DOWNLOAD, SyncType.FILES);
      
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
      console.error('S3下载失败:', error);
      return false;
    }
  }

  /**
   * 获取需要上传的文件列表
   */
  private async getFilesToUpload(localPath: string, lastSyncTime?: string): Promise<FileSyncInfo[]> {
    if (!this.config.provider) {
      return [];
    }

    console.log(`[S3] 扫描本地文件，路径: ${localPath}，上次同步时间: ${lastSyncTime}`);

    const uploadManager = GlobalSyncManager.getManager(this.config.provider, SyncDirection.UPLOAD, SyncType.FILES);
    const allFiles = await uploadManager.getFilesToSync(localPath);
    
    console.log(`[S3] 发现本地文件总数: ${allFiles.length}`);
    if (allFiles.length > 0) {
      console.log('[S3] 本地文件列表:', allFiles.map(f => f.filePath));
    }
    
    if (!lastSyncTime) {
      // 第一次同步，返回所有文件
      console.log('[S3] 第一次同步，返回所有文件');
      return allFiles;
    }
    
    // 根据修改时间过滤需要同步的文件
    const lastSyncDate = new Date(lastSyncTime);
    const filteredFiles = allFiles.filter(file => new Date(file.lastModified) > lastSyncDate);
    
    console.log(`[S3] 根据修改时间过滤后，需要上传的文件数: ${filteredFiles.length}`);
    if (filteredFiles.length > 0) {
      console.log('[S3] 需要上传的文件:', filteredFiles.map(f => f.filePath));
    }
    
    return filteredFiles;
  }

  /**
   * 获取需要下载的文件列表
   */
  private async getFilesToDownload(localPath: string, remotePath: string): Promise<FileSyncInfo[]> {
    const filesToDownload: FileSyncInfo[] = [];
    
    try {
      const remoteFilesPrefix = `${remotePath}/files/`;
      
      await this.scanRemoteDirectory(remoteFilesPrefix, localPath, filesToDownload);
    } catch (error) {
      console.error('扫描远程文件失败:', error);
    }

    return filesToDownload;
  }

  /**
   * 扫描远程目录
   */
  private async scanRemoteDirectory(remotePrefix: string, localPath: string, filesToDownload: FileSyncInfo[]): Promise<void> {
    const command = new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: remotePrefix,
      Delimiter: '/'
    });
    
    const response = await this.client.send(command);
    
    // 扫描文件
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key && object.Key !== remotePrefix) {
          const relativePath = object.Key.replace(remotePrefix, '');
          const localFilePath = path.join(localPath, 'files', relativePath);
          
          const needsDownload = await this.shouldDownloadFile(object.Key, localFilePath, object.Size || 0);
          if (needsDownload) {
            const fileInfo: FileSyncInfo = {
              filePath: `files/${relativePath}`,
              fileName: path.basename(relativePath),
              fileSize: object.Size || 0,
              lastModified: object.LastModified?.getTime() || Date.now(),
              status: SyncStatus.PENDING,
              provider: this.config.provider || 'aws'
            };
            filesToDownload.push(fileInfo);
          }
        }
      }
    }
    
    // 递归扫描子目录
    if (response.CommonPrefixes) {
      for (const prefixInfo of response.CommonPrefixes) {
        if (prefixInfo.Prefix && prefixInfo.Prefix !== remotePrefix) {
          await this.scanRemoteDirectory(prefixInfo.Prefix, localPath, filesToDownload);
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
      console.log(`[S3] 开始同步files文件夹，共 ${filesToUpload.length} 个文件`);
      
      if (filesToUpload.length === 0) {
        console.log('[S3] 没有files文件需要上传');
        return true;
      }

      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const fileInfo of filesToUpload) {
        uploadManager.setCurrentFile(fileInfo.filePath);
        
        const localFilePath = path.join(localPath, fileInfo.filePath);
        const remoteKey = `${remotePath}/${fileInfo.filePath}`;
        
        console.log(`[S3] 处理文件: ${fileInfo.filePath}`);
        
        try {
          // 检查本地文件是否存在
          if (!(await fs.pathExists(localFilePath))) {
            console.error(`[S3] 本地文件不存在: ${localFilePath}`);
            uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.FAILED, '本地文件不存在');
            failedCount++;
            continue;
          }

          // 检查远程文件是否存在，如果存在且不同则覆盖（以本地为准）
          const needsUpload = await this.shouldUploadFile(localFilePath, remoteKey, fileInfo.fileSize);
          if (needsUpload) {
            console.log(`[S3] 文件需要上传: ${fileInfo.filePath}`);
            await this.uploadFile(localFilePath, remoteKey);
            uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SUCCESS);
            successCount++;
            console.log(`[S3] 文件上传成功: ${fileInfo.filePath}`);
          } else {
            console.log(`[S3] 文件内容相同，跳过: ${fileInfo.filePath}`);
            uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.SKIPPED);
            skippedCount++;
          }
        } catch (error) {
          console.error(`[S3] 文件上传失败: ${fileInfo.filePath}`, error);
          uploadManager.updateFileStatus(fileInfo.filePath, SyncStatus.FAILED, String(error));
          failedCount++;
        }
      }

      console.log(`[S3] files文件夹同步完成 - 成功: ${successCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);
      
      // 如果有文件上传失败，返回false
      if (failedCount > 0) {
        console.error(`[S3] 有 ${failedCount} 个文件上传失败`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[S3] 同步files到云端失败:', error);
      return false;
    }
  }

  /**
   * 同步db文件夹到云端
   */
  private async syncDbToRemote(localPath: string, remotePath: string): Promise<boolean> {
    try {
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      const localDbPath = path.join(localPath, 'db', this.config.provider);

      if (!(await fs.pathExists(localDbPath))) {
        console.log(`本地db/${this.config.provider}文件夹不存在，跳过同步`);
        return true;
      }

      console.log(`开始同步db文件夹: ${localDbPath} -> ${remotePath}/db/${this.config.provider}`);

      // 获取数据库同步管理器
      const dbSyncManager = GlobalSyncManager.getManager(this.config.provider, SyncDirection.UPLOAD, SyncType.DATABASE);
      
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
          const remoteKey = `${remotePath}/db/${this.config.provider}/${file}`;
          const dbFilePath = `db/${this.config.provider}/${file}`;
          
          // 检查本地文件是否存在
          if (!(await fs.pathExists(localFilePath))) {
            console.log(`本地数据库文件不存在，跳过: ${file}`);
            continue;
          }
          
          console.log(`上传数据库备份文件: ${file}`);
          await this.uploadFile(localFilePath, remoteKey);
          console.log(`成功上传: ${file}`);
          
          // 更新数据库文件同步状态为成功
          dbFileTracker.updateFileStatus(dbFilePath, SyncStatus.SUCCESS);
          successCount++;
        } catch (fileError) {
          console.error(`上传数据库备份文件失败: ${file}`, fileError);
          
          // 将失败的文件添加到失败列表
          const dbFilePath = `db/${this.config.provider}/${file}`;
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
        const remoteKey = `${remotePath}/${fileInfo.filePath}`;
        
        try {
          // 确保本地目录存在
          await fs.ensureDir(path.dirname(localFilePath));
          
          // 如果本地文件存在且已被修改，先删除
          if (await fs.pathExists(localFilePath)) {
            await fs.remove(localFilePath);
          }
          
          const getCommand = new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: remoteKey
          });
          
          const response = await this.client.send(getCommand);
          if (response.Body) {
            const fileContent = await response.Body.transformToByteArray();
            await fs.writeFile(localFilePath, Buffer.from(fileContent));
          }
          
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      // 获取云端备份文件列表
      const remoteBackupFiles = await this.getBackupFiles(remotePath);
      if (remoteBackupFiles.length === 0) {
        return true;
      }

      // 确保本地db目录存在
      const localDbPath = path.join(localPath, 'db', this.config.provider);
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
  private async shouldUploadFile(localPath: string, remoteKey: string, localSize: number): Promise<boolean> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey
      });
      
      const response = await this.client.send(headCommand);
      const remoteSize = response.ContentLength || 0;
      
      // 比较文件大小
      return localSize !== remoteSize;
    } catch (error) {
      // 远程文件不存在，需要上传
      return true;
    }
  }

  /**
   * 判断是否需要下载文件
   */
  private async shouldDownloadFile(remoteKey: string, localPath: string, remoteSize: number): Promise<boolean> {
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
  private async uploadFile(localPath: string, remoteKey: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(localPath);
      
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey,
        Body: fileContent
      });
      
      await this.client.send(command);
    } catch (error) {
      console.error(`上传文件失败: ${remoteKey}`, error);
      throw error;
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      const backupPrefix = `${remotePath}/db/${this.config.provider}/`;
      
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: backupPrefix,
        Delimiter: '/'
      });
      
      const response = await this.client.send(command);
      const files: Array<{
        fileName: string;
        timestamp: string;
        size: number;
      }> = [];
      
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key.endsWith('.json')) {
            const fileName = object.Key.split('/').pop() || object.Key;
            
            files.push({
              fileName: fileName,
              timestamp: object.LastModified?.toISOString() || '',
              size: object.Size || 0
            });
          }
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      const fileKey = `${remotePath}/db/${this.config.provider}/${fileName}`;
      
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: fileKey
      });
      
      const response = await this.client.send(command);
      if (response.Body) {
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
      }
      return null;
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
      if (!this.config.provider) {
        console.error('Provider配置缺失，无法创建初始备份');
        return;
      }
      
      const { getIncrementalData } = await import('../../../database/sync-data');
      const backupResult = await getIncrementalData(null, this.config.provider);
      
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
      if (!this.config.provider) {
        throw new Error('Provider配置缺失');
      }

      console.log(`开始清空${this.config.provider}远程备份数据`);
      
      // 获取远程备份目录前缀
      const backupPrefix = `db/${this.config.provider}/`;
      
      // 列出所有备份文件
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: backupPrefix
      });
      
      const response = await this.client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        console.log('远程备份目录不存在或为空，无需清空');
        return true;
      }
      
      // 过滤出.json备份文件
      const backupFiles = response.Contents.filter(object => 
        object.Key && object.Key.endsWith('.json')
      );
      
      console.log(`发现 ${backupFiles.length} 个远程备份文件需要删除`);
      
      let successCount = 0;
      let failedCount = 0;
      
      // 删除所有备份文件
      for (const file of backupFiles) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: file.Key
          });
          
          await this.client.send(deleteCommand);
          console.log(`成功删除远程备份文件: ${file.Key}`);
          successCount++;
        } catch (error) {
          console.error(`删除远程备份文件失败: ${file.Key}`, error);
          failedCount++;
        }
      }
      
      console.log(`${this.config.provider}远程备份数据清空完成 - 成功: ${successCount}, 失败: ${failedCount}`);
      
      return failedCount === 0;
    } catch (error) {
      console.error(`清空${this.config.provider}远程备份数据失败:`, error);
      return false;
    }
  }
}

// 测试连接方法
export const testS3Config = async (config: S3Config): Promise<boolean> => {
  const client = new S3Client(config);
  return await client.testConnection();
}