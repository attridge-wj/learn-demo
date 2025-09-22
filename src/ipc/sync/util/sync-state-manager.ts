import { BrowserWindow } from 'electron';
import { FileSyncInfo, SyncStatus, SyncProgress, SyncDirection, SyncType } from '../types/sync.types';
import { FileSyncTracker } from './file-sync-tracker';

export class SyncStateManager {
  private provider: string;
  private direction: SyncDirection;
  private type: SyncType;
  private fileTracker: FileSyncTracker;
  private currentProgress: SyncProgress;
  private isRunning: boolean = false;

  constructor(provider: string, direction: SyncDirection = SyncDirection.UPLOAD, type: SyncType = SyncType.FILES) {
    this.provider = provider;
    this.direction = direction;
    this.type = type;
    // 为不同方向和类型创建独立的跟踪器
    const trackerKey = `${provider}-${direction}-${type}`;
    this.fileTracker = new FileSyncTracker(trackerKey);
    this.currentProgress = this.createInitialProgress();
  }

  /**
   * 创建初始进度对象
   */
  private createInitialProgress(): SyncProgress {
    return {
      provider: this.provider,
      direction: this.direction,
      type: this.type,
      totalFiles: 0,
      processedFiles: 0,
      successFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      currentFile: undefined,
      percentage: 0,
      isCompleted: false,
      completedFiles: [],
      failedFilesList: []
    };
  }

  /**
   * 开始同步
   */
  startSync(totalFiles: number): void {
    this.isRunning = true;
    this.currentProgress = {
      ...this.createInitialProgress(),
      totalFiles,
      processedFiles: 0
    };
    this.notifyProgress();
  }

  /**
   * 更新文件同步状态
   */
  updateFileStatus(filePath: string, status: SyncStatus, error?: string): void {
    // 更新文件跟踪器中的状态
    this.fileTracker.updateFileStatus(filePath, status, error);
    
    // 获取更新后的文件信息
    const syncedFiles = this.fileTracker.getSyncedFiles();
    const currentFile = syncedFiles.find(f => f.filePath === filePath);
    
    // 更新进度
    this.currentProgress.processedFiles++;
    
    switch (status) {
      case SyncStatus.SUCCESS:
        this.currentProgress.successFiles++;
        if (currentFile) {
          this.currentProgress.completedFiles.push(currentFile);
        }
        break;
      case SyncStatus.FAILED:
        this.currentProgress.failedFiles++;
        if (currentFile) {
          this.currentProgress.failedFilesList.push(currentFile);
        }
        break;
      case SyncStatus.SKIPPED:
        this.currentProgress.skippedFiles++;
        if (currentFile) {
          this.currentProgress.completedFiles.push(currentFile);
        }
        break;
    }
    
    // 计算百分比
    this.currentProgress.percentage = Math.round(
      (this.currentProgress.processedFiles / this.currentProgress.totalFiles) * 100
    );
    
    // 检查是否完成
    if (this.currentProgress.processedFiles >= this.currentProgress.totalFiles) {
      this.currentProgress.isCompleted = true;
      this.isRunning = false;
    }
    
    this.notifyProgress();
  }

  /**
   * 设置当前正在同步的文件
   */
  setCurrentFile(filePath: string): void {
    this.currentProgress.currentFile = filePath;
    this.notifyProgress();
  }

     /**
    * 获取当前进度
    */
   getCurrentProgress(): SyncProgress {
     // 确保返回的completedFiles只包含成功同步的文件，不包含跳过的
     const successFiles = this.fileTracker.getSuccessFiles();
     const failedFiles = this.fileTracker.getFailedFiles();
     
     return {
       ...this.currentProgress,
       completedFiles: successFiles, // 只包含成功同步的文件
       failedFilesList: failedFiles
     };
   }

   /**
    * 检查是否正在运行
    */
   isSyncRunning(): boolean {
     return this.isRunning;
   }

  /**
   * 停止同步
   */
  stopSync(): void {
    this.isRunning = false;
    this.currentProgress.isCompleted = true;
    this.notifyProgress();
  }

  /**
   * 通知渲染进程进度更新
   */
  private notifyProgress(): void {
    const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:progress-update', this.getCurrentProgress());
    }
  }

  /**
   * 获取需要同步的文件列表
   */
  async getFilesToSync(storagePath: string): Promise<FileSyncInfo[]> {
    const allFiles = await this.fileTracker.scanFiles(storagePath);
    return this.fileTracker.getFilesToSync(allFiles);
  }

  /**
   * 清除同步记录
   */
  clearSyncRecords(): void {
    this.fileTracker.clearSyncRecords();
  }

  /**
   * 获取文件跟踪器
   */
  get tracker(): FileSyncTracker {
    return this.fileTracker;
  }
}
