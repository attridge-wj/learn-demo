export interface ImportProgress {
  fileName: string
  bytesCopied: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
}

export interface ImportFileWithProgressParams {
  fileName: string
  filePath: string
  operationId: string
}

export interface ImportFileWithCallbackParams {
  fileName: string
  filePath: string
  onProgress?: (progress: ImportProgress) => void
}

export interface ImportFileWithProgressResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface CancelImportFileResult {
  success: boolean
  message: string
}

export interface ImportProgressData {
  operationId: string
  progress: ImportProgress
}

export interface BackupItem {
  timestamp: string
  displayTime: string
  fileName: string
  fileNameWithTime: string
  fileSize: string
  totalSize: string
  fileCount: number
}

export interface BackupResult {
  success: boolean
  message: string
  files: string[]
}

export interface RestoreResult {
  success: boolean
  message: string
  files: string[]
}

export interface DeleteBackupResult {
  success: boolean
  message: string
  files: string[]
}

declare global {
  interface Window {
    storageApi: {
      getDefaultStoragePath: () => Promise<string>
      getStoragePath: () => Promise<string>
      setStoragePath: (path: string) => Promise<boolean>
      getFileStoragePath: () => Promise<string>
      getDatabaseBackupPath: () => Promise<string>
      setDatabaseBackupPath: (path: string) => Promise<boolean>
      importFile: (params: { fileName: string; filePath: string }) => Promise<string>
      importFileWithProgress: (params: ImportFileWithProgressParams) => Promise<ImportFileWithProgressResult>
      importFileWithCallback: (params: ImportFileWithCallbackParams) => Promise<ImportFileWithProgressResult>
      cancelImportFile: (operationId: string) => Promise<CancelImportFileResult>
      saveBase64File: (params: { fileName: string; base64Data: string }) => Promise<string>
      getStoragePathFileSize: () => Promise<string>
      backupDatabase: () => Promise<BackupResult>
      getBackupDatabaseList: () => Promise<BackupItem[]>
      restoreBackupDatabase: (params: { timestamp: string }) => Promise<RestoreResult>
      deleteBackupDatabase: (params: { timestamp: string }) => Promise<DeleteBackupResult>
      onImportProgress: (callback: (data: ImportProgressData) => void) => void
      offImportProgress: (callback: (data: ImportProgressData) => void) => void
    }
  }
}
