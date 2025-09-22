import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type {
  SearchRequestDto,
  AdvancedSearchRequestDto,
  SearchResponseDto,
  QueryByFileNameDto,
  QueryByFileNameResponseDto
} from './dto/index.dto'
import { searchContent } from './service/content-search.service'
import { advancedSearchContent } from './service/content-advanced-search.service'
import { getSearchCount } from './service/content-search-count.service'
import { rebuildContentIndex } from './service/content-index-rebuild.service'
import { getContentIndexStatus } from './service/content-index-status.service'
import { optimizeContentIndex } from './service/content-index-optimize.service'
import {
  searchDocumentContent,
  advancedSearchDocumentContent,
  searchFiles,
  getDocumentContentSearchCount,
  getDocumentContentIndexStatus,
  rebuildDocumentContentIndex,
  optimizeDocumentContentIndex
} from './service/document-page-content-search.service'
import { FileIndexService } from './service/file-index.service'
import { FileIndexWorkerService } from './service/file-index-worker.service'
import {
  indexFile,
  indexFileAsync,
  indexDirectory,
  getContentIndexStatus as getDocumentIndexStatus,
  stopContentIndex
} from './service/document-index-ipc.service'
import {
  parseDocumentText,
  parseMultipleDocumentTexts,
  getParsedDocumentContent
} from './service/document-text-parse.service'
import { queryDocumentPageContentByFileName } from './service/document-page-content-query-by-filename.service'
import { ChineseSegmentUtil } from '../../common/util/chinese-segment.util'

export function setupContentIndexIPC(): void {
  // 基础搜索
  ipcMain.handle('content-index:search', async (_event: IpcMainInvokeEvent, request: SearchRequestDto): Promise<SearchResponseDto> => {
    try {
      const results = await searchContent(request)
      const total = await getSearchCount(request.keyword, request.spaceId)

      return {
        list: results,
        total,
        keyword: request.keyword,
        limit: request.limit || 10,
        offset: request.offset || 0
      }
    } catch (error) {
      console.error('搜索失败:', error)
      throw error
    }
  })

  // 高级搜索
  ipcMain.handle('content-index:advanced-search', async (_event: IpcMainInvokeEvent, request: AdvancedSearchRequestDto): Promise<SearchResponseDto> => {
    try {
      const results = await advancedSearchContent(request)
      const total = await getSearchCount(request.keyword, request.spaceId)

      return {
        list: results,
        total,
        keyword: request.keyword,
        limit: request.limit || 10,
        offset: request.offset || 0
      }
    } catch (error) {
      console.error('高级搜索失败:', error)
      throw error
    }
  })

  // 搜索统计
  ipcMain.handle('content-index:search-count', async (_event: IpcMainInvokeEvent, request: { keyword: string, spaceId?: string }): Promise<number> => {
    try {
      return await getSearchCount(request.keyword, request.spaceId)
    } catch (error) {
      console.error('搜索统计失败:', error)
      throw error
    }
  })

  // 重建索引
  ipcMain.handle('content-index:rebuild-index', async (_event: IpcMainInvokeEvent, request: { spaceId?: string }): Promise<void> => {
    try {
      await rebuildContentIndex(request.spaceId)
    } catch (error) {
      console.error('重建索引失败:', error)
      throw error
    }
  })

  // 获取索引状态
  ipcMain.handle('content-index:get-index-status', async (_event: IpcMainInvokeEvent, request: { spaceId?: string }) => {
    try {
      return await getContentIndexStatus(request.spaceId)
    } catch (error) {
      console.error('获取索引状态失败:', error)
      throw error
    }
  })

  // 优化索引
  ipcMain.handle('content-index:optimize-index', async (_event: IpcMainInvokeEvent): Promise<void> => {
    try {
      await optimizeContentIndex()
    } catch (error) {
      console.error('优化索引失败:', error)
      throw error
    }
  })

  // 文档页面内容搜索
  ipcMain.handle('content-index:search-document-content', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    cardId?: string
    spaceId?: string
    limit?: number
    offset?: number
  }) => {
    try {
      const results = await searchDocumentContent(request)
      const total = await getDocumentContentSearchCount(request.keyword, request.cardId, request.spaceId)

      return {
        list: results,
        total,
        keyword: request.keyword,
        limit: request.limit || 10,
        offset: request.offset || 0
      }
    } catch (error) {
      console.error('文档页面内容搜索失败:', error)
      throw error
    }
  })

  // 文档页面内容高级搜索
  ipcMain.handle('content-index:advanced-search-document-content', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    cardId?: string
    spaceId?: string
    fileType?: string
    fileName?: string
    limit?: number
    offset?: number
  }) => {
    try {
      const results = await advancedSearchDocumentContent(request)
      const total = await getDocumentContentSearchCount(request.keyword, request.cardId, request.spaceId)

      return {
        list: results,
        total,
        keyword: request.keyword,
        limit: request.limit || 10,
        offset: request.offset || 0
      }
    } catch (error) {
      console.error('文档页面内容高级搜索失败:', error)
      throw error
    }
  })

  // 文件搜索
  ipcMain.handle('content-index:search-files', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    spaceId?: string
    filePath?: string
    fileType?: string
    fileName?: string
    limit?: number
    offset?: number
  }) => {
    try {
      const results = await searchFiles(request)
      const total = await getDocumentContentSearchCount(request.keyword, undefined, request.spaceId)

      return {
        list: results,
        total,
        keyword: request.keyword,
        limit: request.limit || 10,
        offset: request.offset || 0
      }
    } catch (error) {
      console.error('文件搜索失败:', error)
      throw error
    }
  })


  // 获取文档页面内容索引状态
  ipcMain.handle('content-index:get-document-content-index-status', async (_event: IpcMainInvokeEvent) => {
    try {
      return await getDocumentContentIndexStatus()
    } catch (error) {
      console.error('获取文档页面内容索引状态失败:', error)
      throw error
    }
  })

  // 获取文档页面内容搜索统计
  ipcMain.handle('content-index:get-document-content-search-count', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    cardId?: string
    spaceId?: string
  }): Promise<number> => {
    try {
      return await getDocumentContentSearchCount(request.keyword, request.cardId, request.spaceId)
    } catch (error) {
      console.error('获取文档页面内容搜索统计失败:', error)
      throw error
    }
  })

  // 重建文档页面内容索引
  ipcMain.handle('content-index:rebuild-document-content-index', async (_event: IpcMainInvokeEvent) => {
    try {
      return await rebuildDocumentContentIndex()
    } catch (error) {
      console.error('重建文档页面内容索引失败:', error)
      throw error
    }
  })

  // 优化文档页面内容索引
  ipcMain.handle('content-index:optimize-document-content-index', async (_event: IpcMainInvokeEvent): Promise<void> => {
    try {
      await optimizeDocumentContentIndex()
    } catch (error) {
      console.error('优化文档页面内容索引失败:', error)
      throw error
    }
  })


  // 索引单个文件
  ipcMain.handle('content-index:index-file', async (_event: IpcMainInvokeEvent, request: {
    filePath: string
    cardId?: string
    spaceId?: string
  }): Promise<{ success: boolean }> => {
    try {
      await indexFile(request.filePath, request.cardId, request.spaceId)
      return { success: true }
    } catch (error) {
      console.error('索引文件失败:', error)
      return { success: false }
    }
  })

  // 异步索引单个文件
  ipcMain.handle('content-index:index-file-async', async (_event: IpcMainInvokeEvent, request: {
    filePath: string
    cardId?: string
    spaceId?: string
    priority?: number
  }): Promise<void> => {
    try {
      await indexFileAsync(request.filePath, request.cardId, request.spaceId, request.priority || 0)
    } catch (error) {
      console.error('异步索引文件失败:', error)
      throw error
    }
  })

  // ==================== 文件夹内容索引 Worker 相关接口 ====================

  // 索引文件夹（使用 Worker 进程）
  ipcMain.handle('content-index:index-folder', async (_event: IpcMainInvokeEvent, request: {
    dirPath: string
    spaceId?: string
  }): Promise<{ success: boolean; message: string }> => {
    try {
      return await indexDirectory(request.dirPath, request.spaceId)
    } catch (error) {
      console.error('索引文件夹失败:', error)
      throw error
    }
  })

  // 获取文件夹内容索引状态
  ipcMain.handle('content-index:get-folder-index-status', async (_event: IpcMainInvokeEvent) => {
    try {
      return await getDocumentIndexStatus()
    } catch (error) {
      console.error('获取文件夹内容索引状态失败:', error)
      throw error
    }
  })

  // 停止文件夹内容索引
  ipcMain.handle('content-index:stop-folder-index', async (_event: IpcMainInvokeEvent): Promise<{ success: boolean; message: string }> => {
    try {
      return await stopContentIndex()
    } catch (error) {
      console.error('停止文件夹内容索引失败:', error)
      throw error
    }
  })

  // 更新文档分词
  ipcMain.handle('content-index:update-document-segmentation', async (_event: IpcMainInvokeEvent, documentId: string) => {
    try {
      await ChineseSegmentUtil.updateDocumentSegmentation(documentId)
      return { success: true }
    } catch (error) {
      console.error('更新文档分词失败:', error)
      throw error
    }
  })

  // 批量更新所有文档分词
  ipcMain.handle('content-index:update-all-document-segmentation', async (_event: IpcMainInvokeEvent) => {
    try {
      await ChineseSegmentUtil.updateAllDocumentSegmentation()
      return { success: true }
    } catch (error) {
      console.error('批量更新文档分词失败:', error)
      throw error
    }
  })

  // 解析文档文本内容
  ipcMain.handle('content-index:parse-document-text', async (_event: IpcMainInvokeEvent, request: {
    filePath: string
    cardId?: string
    spaceId?: string
  }) => {
    try {
      return await parseDocumentText(request.filePath, request.cardId, request.spaceId)
    } catch (error) {
      console.error('解析文档文本失败:', error)
      throw error
    }
  })

  // 批量解析文档文本内容
  ipcMain.handle('content-index:parse-multiple-document-texts', async (_event: IpcMainInvokeEvent, request: {
    filePaths: string[]
    spaceId?: string
  }) => {
    try {
      return await parseMultipleDocumentTexts(request.filePaths, request.spaceId)
    } catch (error) {
      console.error('批量解析文档文本失败:', error)
      throw error
    }
  })

  // 获取已解析的文档内容
  ipcMain.handle('content-index:get-parsed-document-content', async (_event: IpcMainInvokeEvent, request: {
    filePath: string
  }) => {
    try {
      return await getParsedDocumentContent(request.filePath)
    } catch (error) {
      console.error('获取已解析文档内容失败:', error)
      throw error
    }
  })

  // ==================== 文件索引相关接口 ====================

  // 搜索文件
  ipcMain.handle('file-index:search', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    fileType?: string
    minSize?: number
    maxSize?: number
    limit?: number
    offset?: number
  }) => {
    try {
      return await FileIndexService.searchFiles(request)
    } catch (error) {
      console.error('文件搜索失败:', error)
      throw error
    }
  })

  // 快速搜索（类似 Everything 的即时搜索）
  ipcMain.handle('file-index:quick-search', async (_event: IpcMainInvokeEvent, request: {
    keyword: string
    limit?: number
  }) => {
    try {
      return await FileIndexService.quickSearch(request.keyword, request.limit || 20)
    } catch (error) {
      console.error('快速搜索失败:', error)
      throw error
    }
  })

  // 获取搜索建议（自动完成）
  ipcMain.handle('file-index:get-suggestions', async (_event: IpcMainInvokeEvent, request: {
    partialKeyword: string
    limit?: number
  }) => {
    try {
      return await FileIndexService.getSearchSuggestions(request.partialKeyword, request.limit || 10)
    } catch (error) {
      console.error('获取搜索建议失败:', error)
      throw error
    }
  })

  // 获取文件索引状态
  ipcMain.handle('file-index:get-status', async (_event: IpcMainInvokeEvent) => {
    try {
      return await FileIndexService.getFileIndexStatus()
    } catch (error) {
      console.error('获取文件索引状态失败:', error)
      throw error
    }
  })

  // 重建文件索引
  ipcMain.handle('file-index:rebuild', async (_event: IpcMainInvokeEvent) => {
    try {
      await FileIndexService.rebuildFileIndex()
      return { success: true }
    } catch (error) {
      console.error('重建文件索引失败:', error)
      throw error
    }
  })

  // 获取索引进度
  ipcMain.handle('file-index:get-progress', async (_event: IpcMainInvokeEvent) => {
    try {
      return FileIndexService.getIndexProgress()
    } catch (error) {
      console.error('获取索引进度失败:', error)
      throw error
    }
  })

  // 异步索引系统文件（使用 Worker 进程）
  ipcMain.handle('file-index:index-system-files', async (_event: IpcMainInvokeEvent, options?: { forceFullScan?: boolean }) => {
    try {
      const forceFullScan = options?.forceFullScan || false
      await FileIndexService.indexSystemFiles(forceFullScan)
      return { 
        success: true, 
        message: forceFullScan ? '后台全量文件索引已启动' : '后台增量文件索引已启动，请查看进度' 
      }
    } catch (error) {
      console.error('启动文件索引失败:', error)
      throw error
    }
  })

  // 停止文件索引
  ipcMain.handle('file-index:stop-indexing', async (_event: IpcMainInvokeEvent) => {
    try {
      await FileIndexWorkerService.stopIndexing()
      return { success: true, message: '文件索引已停止' }
    } catch (error) {
      console.error('停止文件索引失败:', error)
      throw error
    }
  })

  // 通过文件名查询文档页面内容
  ipcMain.handle('content-index:query-by-filename', async (_event: IpcMainInvokeEvent, request: QueryByFileNameDto): Promise<QueryByFileNameResponseDto> => {
    try {
      return await queryDocumentPageContentByFileName(request)
    } catch (error) {
      console.error('通过文件名查询文档页面内容失败:', error)
      return {
        success: false,
        data: [],
        message: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  })

}
