export interface FileIndexSearchRequestDto {
  keyword: string
  fileType?: string
  minSize?: number
  maxSize?: number
  limit?: number
  offset?: number
}

export interface FileIndexSearchResponseDto {
  list: FileIndexItemDto[]
  total: number
  keyword: string
  limit: number
  offset: number
}

export interface FileIndexItemDto {
  id: number
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  createTime: string
  updateTime: string
  indexTime: string
}

export interface FileIndexStatusDto {
  totalFiles: number
  indexedFiles: number
  lastIndexTime: string
  isHealthy: boolean
  isIndexing: boolean
  progress?: number
}

export interface FileIndexProgressDto {
  current: number
  total: number
  currentFile: string
  isComplete: boolean
  percentage?: number
  currentDirectory?: string
}

// Worker 相关 DTO
export interface WorkerStartRequestDto {
  type: 'start-scan'
}

export interface WorkerStopRequestDto {
  type: 'stop-scan'
}

export interface WorkerStatusRequestDto {
  type: 'get-status'
}

export interface WorkerProgressDto {
  isScanning: boolean
  currentDirectory: string
  currentFile: string
  processedFiles: number
  totalFiles: number
  percentage: number
}

export interface WorkerFilesBatchDto {
  files: Array<{
    fileName: string
    filePath: string
    fileSize: number
    fileType: string
    createTime: Date
    updateTime: Date
  }>
  directory: string
}
