// 同步状态枚举
export enum SyncStatus {
  PENDING = 'pending',      // 等待同步
  SYNCING = 'syncing',      // 正在同步
  SUCCESS = 'success',      // 同步成功
  FAILED = 'failed',        // 同步失败
  SKIPPED = 'skipped'       // 跳过同步（文件相同）
}

// 文件同步信息
export interface FileSyncInfo {
  filePath: string;         // 文件路径（相对路径）
  fileName: string;         // 文件名
  fileSize: number;         // 文件大小（字节）
  lastModified: number;     // 最后修改时间（时间戳）
  syncTime?: number;        // 同步时间（时间戳）
  status: SyncStatus;       // 同步状态
  error?: string;           // 错误信息（如果失败）
  provider: string;         // 云存储提供商（webdav, aws, tencent, aliyun）
}

// 同步方向枚举
export enum SyncDirection {
  UPLOAD = 'upload',     // 上传到云端
  DOWNLOAD = 'download'  // 从云端下载
}

// 同步类型枚举
export enum SyncType {
  FILES = 'files',       // 文件同步
  DATABASE = 'database'  // 数据库同步
}

// 同步进度信息
export interface SyncProgress {
  provider: string;         // 云存储提供商
  direction: SyncDirection; // 同步方向
  type: SyncType;          // 同步类型
  totalFiles: number;       // 总文件数
  processedFiles: number;   // 已处理文件数
  successFiles: number;     // 成功文件数
  failedFiles: number;      // 失败文件数
  skippedFiles: number;     // 跳过文件数
  currentFile?: string;     // 当前正在同步的文件
  percentage: number;       // 进度百分比
  isCompleted: boolean;     // 是否完成
  error?: string;           // 总体错误信息
  completedFiles: FileSyncInfo[];  // 已完成的文件列表（成功+跳过）
  failedFilesList: FileSyncInfo[];  // 失败的文件列表
}

// 同步配置
export interface SyncConfig {
  provider: string;         // 云存储提供商
  basePath: string;         // 基础路径
  lastSyncTime?: number;    // 最后同步时间
  syncCount: number;        // 同步次数
}

// 文件同步统计
export interface FileSyncStats {
  totalFiles: number;       // 总文件数
  pendingFiles: number;     // 等待同步文件数
  successFiles: number;     // 成功文件数
  failedFiles: number;      // 失败文件数
  skippedFiles: number;     // 跳过文件数
}
