import { SyncStateManager } from './sync-state-manager';
import { SyncDirection, SyncType, SyncProgress } from '../types/sync.types';

/**
 * 全局同步状态管理器
 * 管理所有同步操作的状态（上传/下载，文件/数据库）
 */
export class GlobalSyncManager {
  private static managers: Map<string, SyncStateManager> = new Map();

  /**
   * 获取或创建同步状态管理器
   */
  static getManager(
    provider: string, 
    direction: SyncDirection = SyncDirection.UPLOAD, 
    type: SyncType = SyncType.FILES
  ): SyncStateManager {
    const key = `${provider}-${direction}-${type}`;
    
    if (!this.managers.has(key)) {
      this.managers.set(key, new SyncStateManager(provider, direction, type));
    }
    
    return this.managers.get(key)!;
  }

  /**
   * 获取当前进度
   */
  static getCurrentProgress(
    provider: string, 
    direction?: SyncDirection, 
    type?: SyncType
  ): SyncProgress | null {
    // 如果指定了方向和类型，返回具体的进度
    if (direction && type) {
      const manager = this.getManager(provider, direction, type);
      return manager.getCurrentProgress();
    }

    // 如果没有指定，返回当前正在运行的进度
    const runningManager = this.getRunningManager(provider);
    return runningManager ? runningManager.getCurrentProgress() : null;
  }

  /**
   * 检查是否有正在运行的同步
   */
  static isSyncRunning(provider: string): boolean {
    const runningManager = this.getRunningManager(provider);
    return runningManager ? runningManager.isSyncRunning() : false;
  }

  /**
   * 获取正在运行的管理器
   */
  private static getRunningManager(provider: string): SyncStateManager | null {
    for (const [key, manager] of this.managers.entries()) {
      if (key.startsWith(provider) && manager.isSyncRunning()) {
        return manager;
      }
    }
    return null;
  }

  /**
   * 停止所有同步
   */
  static stopAllSync(provider: string): void {
    for (const [key, manager] of this.managers.entries()) {
      if (key.startsWith(provider) && manager.isSyncRunning()) {
        manager.stopSync();
      }
    }
  }

  /**
   * 清除同步记录
   */
  static clearRecords(provider: string, direction?: SyncDirection, type?: SyncType): void {
    if (direction && type) {
      // 清除特定的记录
      const manager = this.getManager(provider, direction, type);
      manager.clearSyncRecords();
    } else {
      // 清除所有记录
      for (const [key, manager] of this.managers.entries()) {
        if (key.startsWith(provider)) {
          manager.clearSyncRecords();
        }
      }
    }
  }

  /**
   * 获取所有进度状态
   */
  static getAllProgress(provider: string): Array<{
    direction: SyncDirection;
    type: SyncType;
    progress: SyncProgress;
  }> {
    const results: Array<{
      direction: SyncDirection;
      type: SyncType;
      progress: SyncProgress;
    }> = [];

    for (const [key, manager] of this.managers.entries()) {
      if (key.startsWith(provider)) {
        const progress = manager.getCurrentProgress();
        results.push({
          direction: progress.direction,
          type: progress.type,
          progress
        });
      }
    }

    return results;
  }
}
