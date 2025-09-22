import fs from 'fs-extra';
import * as path from 'path';
import store from '../../../utils/store';
import { FileSyncInfo, SyncStatus, FileSyncStats } from '../types/sync.types';

/**
 * 文件同步跟踪器
 * 负责跟踪文件同步状态，避免重复扫描云端
 */
export class FileSyncTracker {
  private storeKey: string;
  private failedFilesKey: string;
  private syncedFiles: Map<string, FileSyncInfo> = new Map();
  private failedFiles: Set<string> = new Set();
  
  constructor(storeKey: string) {
    this.storeKey = `${storeKey}-sync-files`;
    this.failedFilesKey = `${this.extractProviderFromStoreKey(storeKey)}-sync-fail`;
    this.loadSyncedFiles();
    this.loadFailedFiles();
  }

  /**
   * 从electron-store加载已同步的文件记录
   */
  private loadSyncedFiles(): void {
    try {
      const storedFiles = store.get(this.storeKey) as FileSyncInfo[] || [];
      this.syncedFiles.clear();
      
      for (const fileInfo of storedFiles) {
        this.syncedFiles.set(fileInfo.filePath, fileInfo);
      }
    } catch (error) {
      console.error('加载同步文件记录失败:', error);
      this.syncedFiles.clear();
    }
  }

  /**
   * 保存已同步的文件记录到electron-store
   */
  private saveSyncedFiles(): void {
    try {
      const files = Array.from(this.syncedFiles.values());
      store.set(this.storeKey, files);
    } catch (error) {
      console.error('保存同步文件记录失败:', error);
    }
  }

  /**
   * 扫描本地文件
   */
  async scanFiles(storagePath: string): Promise<FileSyncInfo[]> {
    const allFiles: FileSyncInfo[] = [];
    
    console.log(`开始扫描本地文件，存储路径: ${storagePath}`);
    
    // 扫描files文件夹
    const filesPath = path.join(storagePath, 'files');
    console.log(`检查files文件夹: ${filesPath}`);
    
    if (await fs.pathExists(filesPath)) {
      console.log('files文件夹存在，开始扫描');
      await this.scanDirectory(filesPath, storagePath, allFiles);
      console.log(`扫描完成，发现 ${allFiles.length} 个文件`);
    } else {
      console.log('files文件夹不存在');
    }
    
    return allFiles;
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(dirPath: string, basePath: string, allFiles: FileSyncInfo[]): Promise<void> {
    try {
      const items = await fs.readdir(dirPath);
      console.log(`扫描目录 ${dirPath}，找到 ${items.length} 个项目`);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            console.log(`进入子目录: ${item}`);
            await this.scanDirectory(itemPath, basePath, allFiles);
          } else {
            const relativePath = path.relative(basePath, itemPath).replace(/\\/g, '/');
            const fileInfo: FileSyncInfo = {
              filePath: relativePath,
              fileName: item,
              fileSize: stats.size,
              lastModified: stats.mtime.getTime(),
              status: SyncStatus.PENDING,
              provider: this.extractProviderFromKey()
            };
            
            console.log(`添加文件: ${relativePath} (${stats.size} bytes)`);
            allFiles.push(fileInfo);
          }
        } catch (statError) {
          console.error(`获取文件状态失败: ${itemPath}`, statError);
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${dirPath}`, error);
    }
  }

  /**
   * 从storeKey中提取provider信息
   */
  private extractProviderFromKey(): string {
    return this.storeKey.split('-')[0];
  }

  /**
   * 从storeKey中提取provider信息（用于构造器）
   */
  private extractProviderFromStoreKey(storeKey: string): string {
    return storeKey.split('-')[0];
  }

  /**
   * 从electron-store加载失败文件列表
   */
  private loadFailedFiles(): void {
    try {
      const failedFilesList = store.get(this.failedFilesKey) as string[] || [];
      this.failedFiles.clear();
      
      for (const filePath of failedFilesList) {
        this.failedFiles.add(filePath);
      }
      
      console.log(`加载失败文件列表: ${failedFilesList.length} 个文件`);
    } catch (error) {
      console.error('加载失败文件列表失败:', error);
      this.failedFiles.clear();
    }
  }

  /**
   * 保存失败文件列表到electron-store
   */
  private saveFailedFiles(): void {
    try {
      const failedFilesList = Array.from(this.failedFiles);
      store.set(this.failedFilesKey, failedFilesList);
      console.log(`保存失败文件列表: ${failedFilesList.length} 个文件`);
    } catch (error) {
      console.error('保存失败文件列表失败:', error);
    }
  }

  /**
   * 添加失败文件
   */
  addFailedFile(filePath: string): void {
    this.failedFiles.add(filePath);
    this.saveFailedFiles();
  }

  /**
   * 移除失败文件（同步成功后调用）
   */
  removeFailedFile(filePath: string): void {
    this.failedFiles.delete(filePath);
    this.saveFailedFiles();
  }

  /**
   * 获取失败文件列表
   */
  getFailedFilesList(): string[] {
    return Array.from(this.failedFiles);
  }

  /**
   * 获取需要同步的文件列表
   * 包括：1. 新文件 2. 已修改文件 3. 之前同步失败的文件
   */
  getFilesToSync(allFiles: FileSyncInfo[]): FileSyncInfo[] {
    const filesToSync: FileSyncInfo[] = [];
    const filePathMap = new Map(allFiles.map(f => [f.filePath, f]));
    
    // 1. 按修改时间过滤的文件
    for (const file of allFiles) {
      const existingFile = this.syncedFiles.get(file.filePath);
      
      if (!existingFile) {
        // 新文件，需要同步
        filesToSync.push(file);
      } else if (file.lastModified > (existingFile.syncTime || 0)) {
        // 文件已修改，需要重新同步
        filesToSync.push(file);
      }
    }
    
    // 2. 添加之前同步失败的文件
    for (const failedFilePath of this.failedFiles) {
      const failedFile = filePathMap.get(failedFilePath);
      if (failedFile && !filesToSync.some(f => f.filePath === failedFilePath)) {
        console.log(`添加失败重试文件: ${failedFilePath}`);
        filesToSync.push(failedFile);
      }
    }
    
    console.log(`总共需要同步的文件: ${filesToSync.length} 个，其中失败重试: ${this.failedFiles.size} 个`);
    
    return filesToSync;
  }

  /**
   * 更新文件同步状态
   */
  updateFileStatus(filePath: string, status: SyncStatus, error?: string): void {
    const existingFile = this.syncedFiles.get(filePath);
    const fileInfo: FileSyncInfo = {
      filePath,
      fileName: path.basename(filePath),
      fileSize: existingFile?.fileSize || 0,
      lastModified: existingFile?.lastModified || Date.now(),
      syncTime: Date.now(),
      status,
      error,
      provider: this.extractProviderFromKey()
    };
    
    this.syncedFiles.set(filePath, fileInfo);
    this.saveSyncedFiles();
    
    // 根据同步状态管理失败文件列表
    if (status === SyncStatus.FAILED) {
      this.addFailedFile(filePath);
    } else if (status === SyncStatus.SUCCESS) {
      this.removeFailedFile(filePath);
    }
  }

  /**
   * 获取已同步的文件列表
   */
  getSyncedFiles(): FileSyncInfo[] {
    return Array.from(this.syncedFiles.values());
  }

  /**
   * 获取同步统计信息
   */
  getStats(): FileSyncStats {
    const files = Array.from(this.syncedFiles.values());
    
    return {
      totalFiles: files.length,
      pendingFiles: files.filter(f => f.status === SyncStatus.PENDING).length,
      successFiles: files.filter(f => f.status === SyncStatus.SUCCESS).length,
      failedFiles: files.filter(f => f.status === SyncStatus.FAILED).length,
      skippedFiles: files.filter(f => f.status === SyncStatus.SKIPPED).length
    };
  }

  /**
   * 清除同步记录
   */
  clearSyncRecords(): void {
    this.syncedFiles.clear();
    this.failedFiles.clear();
    store.delete(this.storeKey);
    store.delete(this.failedFilesKey);
  }

  /**
   * 获取成功同步的文件（不包含跳过的）
   */
  getSuccessFiles(): FileSyncInfo[] {
    return Array.from(this.syncedFiles.values())
      .filter(file => file.status === SyncStatus.SUCCESS);
  }

  /**
   * 获取失败的文件
   */
  getFailedFiles(): FileSyncInfo[] {
    return Array.from(this.syncedFiles.values())
      .filter(file => file.status === SyncStatus.FAILED);
  }

  /**
   * 获取已完成的文件（成功+跳过）
   */
  getCompletedFiles(): FileSyncInfo[] {
    return Array.from(this.syncedFiles.values())
      .filter(file => file.status === SyncStatus.SUCCESS || file.status === SyncStatus.SKIPPED);
  }
}