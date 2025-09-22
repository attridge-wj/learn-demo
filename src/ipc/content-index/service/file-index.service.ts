import { AppDataSource } from '../../../database/connection'
import { FileIndexEntity } from '../entities/file-index.entity'
import { FileIndexWorkerService } from './file-index-worker.service'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import type { 
  FileIndexSearchRequestDto, 
  FileIndexSearchResponseDto, 
  FileIndexStatusDto,
  FileIndexItemDto 
} from '../dto/file-index.dto'

/**
 * 文件索引服务
 */
export class FileIndexService {

  /**
   * 索引系统文件（使用 Worker 进程）
   */
  static async indexSystemFiles(forceFullScan: boolean = false): Promise<void> {
    try {
      console.log(`启动后台文件索引... (${forceFullScan ? '强制全量' : '智能增量'})`)
      await FileIndexWorkerService.startIndexing(forceFullScan)
      console.log('后台文件索引已启动')
    } catch (error) {
      console.error('启动文件索引失败:', error)
      throw error
    }
  }

  /**
   * 搜索文件（实时搜索版本，类似 AnyTXT）
   */
  static async searchFiles(request: FileIndexSearchRequestDto): Promise<FileIndexSearchResponseDto> {
    try {
      const { keyword, fileType, minSize, maxSize, limit = 10, offset = 0 } = request

      // 检查是否正在索引中
      const isIndexing = FileIndexWorkerService.isIndexingInProgress()
      if (isIndexing) {
        console.log('🔍 实时搜索：索引正在进行中，搜索已索引的文件...')
      }

      let query: string
      let params: any[] = []

      // 优化搜索关键词
      const optimizedKeyword = keyword ? this.optimizeSearchKeyword(keyword) : '*'

      if (keyword) {
        // 使用 FTS5 全文搜索分词字段，支持中文搜索
        query = `
          SELECT 
            f.id,
            f.file_name as fileName,
            f.file_path as filePath,
            f.file_size as fileSize,
            f.file_type as fileType,
            f.create_time as createTime,
            f.update_time as updateTime,
            f.index_time as indexTime,
            bm25(file_index_fts) as relevance
          FROM file_index f
          JOIN file_index_fts ON f.id = file_index_fts.id
          WHERE file_index_fts.file_name_segmented MATCH ?
        `
        
        params.push(optimizedKeyword)

        // 添加其他过滤条件
        if (fileType) {
          query += ' AND f.file_type = ?'
          params.push(fileType)
        }

        if (minSize !== undefined) {
          query += ' AND f.file_size >= ?'
          params.push(minSize)
        }

        if (maxSize !== undefined) {
          query += ' AND f.file_size <= ?'
          params.push(maxSize)
        }

        // 按相关性排序，然后按文件名排序
        query += ' ORDER BY relevance DESC, f.file_name ASC'
      } else {
        // 没有关键词时，使用普通查询
        let whereCondition = 'WHERE 1=1'

        if (fileType) {
          whereCondition += ' AND file_type = ?'
          params.push(fileType)
        }

        if (minSize !== undefined) {
          whereCondition += ' AND file_size >= ?'
          params.push(minSize)
        }

        if (maxSize !== undefined) {
          whereCondition += ' AND file_size <= ?'
          params.push(maxSize)
        }

        query = `
          SELECT 
            id,
            file_name as fileName,
            file_path as filePath,
            file_size as fileSize,
            file_type as fileType,
            create_time as createTime,
            update_time as updateTime,
            index_time as indexTime,
            0 as relevance
          FROM file_index 
          ${whereCondition}
          ORDER BY file_name ASC
        `
      }

      // 获取总数 - 使用分词字段进行计数
      const countQuery = `
        SELECT COUNT(*) as count 
        FROM file_index f
        JOIN file_index_fts ON f.id = file_index_fts.id
        WHERE file_index_fts.file_name_segmented MATCH ?
        ${fileType ? 'AND f.file_type = ?' : ''}
        ${minSize !== undefined ? 'AND f.file_size >= ?' : ''}
        ${maxSize !== undefined ? 'AND f.file_size <= ?' : ''}
      `
      const countParams = [optimizedKeyword]
      if (fileType) countParams.push(fileType)
      if (minSize !== undefined) countParams.push(minSize)
      if (maxSize !== undefined) countParams.push(maxSize)
      
      const countResult = await AppDataSource.query(countQuery, countParams)
      let total = countResult[0]?.count || 0

      // 添加分页
      query += ' LIMIT ? OFFSET ?'
      params.push(limit, offset)
      
      const startTime = Date.now()
      let results: any[] = []
      
      try {
        results = await AppDataSource.query(query, params)
      } catch (ftsError) {
        console.warn('⚠️ FTS5 搜索失败，使用备用 LIKE 搜索:', (ftsError as Error).message)
        
        // 备用搜索：使用 LIKE 查询
        const fallbackQuery = `
          SELECT 
            id,
            file_name as fileName,
            file_path as filePath,
            file_size as fileSize,
            file_type as fileType,
            create_time as createTime,
            update_time as updateTime,
            index_time as indexTime,
            0 as relevance
          FROM file_index 
          WHERE file_name LIKE ? OR file_path LIKE ?
          ${fileType ? 'AND file_type = ?' : ''}
          ${minSize !== undefined ? 'AND file_size >= ?' : ''}
          ${maxSize !== undefined ? 'AND file_size <= ?' : ''}
          ORDER BY file_name ASC
          LIMIT ? OFFSET ?
        `
        
        const fallbackParams = [`%${keyword}%`, `%${keyword}%`]
        if (fileType) fallbackParams.push(fileType)
        if (minSize !== undefined) fallbackParams.push(minSize)
        if (maxSize !== undefined) fallbackParams.push(maxSize)
        fallbackParams.push(limit, offset)
        
        results = await AppDataSource.query(fallbackQuery, fallbackParams)
        
        // 重新计算总数
        const fallbackCountQuery = `
          SELECT COUNT(*) as count FROM file_index 
          WHERE file_name LIKE ? OR file_path LIKE ?
          ${fileType ? 'AND file_type = ?' : ''}
          ${minSize !== undefined ? 'AND file_size >= ?' : ''}
          ${maxSize !== undefined ? 'AND file_size <= ?' : ''}
        `
        const fallbackCountParams = [`%${keyword}%`, `%${keyword}%`]
        if (fileType) fallbackCountParams.push(fileType)
        if (minSize !== undefined) fallbackCountParams.push(minSize)
        if (maxSize !== undefined) fallbackCountParams.push(maxSize)
        
        const fallbackCountResult = await AppDataSource.query(fallbackCountQuery, fallbackCountParams)
        total = fallbackCountResult[0]?.count || 0
      }
      
      const endTime = Date.now()

      const list: FileIndexItemDto[] = results.map((row: any) => ({
        id: row.id,
        fileName: row.fileName,
        filePath: row.filePath,
        fileSize: row.fileSize,
        fileType: row.fileType,
        createTime: row.createTime,
        updateTime: row.updateTime,
        indexTime: row.indexTime
      }))

      // 搜索性能日志
      console.log(`🔍 实时搜索完成: 关键词="${keyword}", 找到 ${total} 个结果，耗时 ${endTime - startTime}ms`)
      if (isIndexing) {
        console.log('📊 注意：索引仍在进行中，结果可能不完整')
      }

      return {
        list,
        total,
        keyword: keyword || '',
        limit,
        offset
      }
    } catch (error) {
      console.error('❌ 搜索文件失败:', error)
      throw error
    }
  }

  /**
   * 优化搜索关键词，支持 FTS5 搜索语法和中文分词
   */
  private static optimizeSearchKeyword(keyword: string): string {
    // 移除多余的空格
    let optimized = keyword.trim().replace(/\s+/g, ' ')
    
    // 如果关键词为空，返回匹配所有的查询
    if (!optimized) {
      return '*'
    }
    
    // 使用中文分词工具处理关键词
    const keywords = ChineseSegmentUtil.extractKeywords(optimized)
    
    if (keywords.length === 0) {
      return '*'
    }
    
    // 对每个分词结果使用前缀匹配
    return keywords.map(term => {
      // 转义特殊字符
      const escaped = term.replace(/["']/g, '""')
      return `"${escaped}"*`
    }).join(' ')
  }

  /**
   * 快速搜索（类似 Everything 的即时搜索）
   */
  static async quickSearch(keyword: string, limit: number = 20): Promise<FileIndexItemDto[]> {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return []
      }

      const optimizedKeyword = this.optimizeSearchKeyword(keyword.trim())
      
      // 使用 FTS5 对分词字段进行快速搜索，按相关性排序
      const query = `
        SELECT 
          f.id,
          f.file_name as fileName,
          f.file_path as filePath,
          f.file_size as fileSize,
          f.file_type as fileType,
          f.create_time as createTime,
          f.update_time as updateTime,
          f.index_time as indexTime,
          bm25(file_index_fts) as relevance
        FROM file_index f
        JOIN file_index_fts ON f.id = file_index_fts.id
        WHERE file_index_fts.file_name_segmented MATCH ?
        ORDER BY relevance DESC, f.file_name ASC
        LIMIT ?
      `
      
      const results = await AppDataSource.query(query, [optimizedKeyword, limit])
      
      return results.map((row: any) => ({
        id: row.id,
        fileName: row.fileName,
        filePath: row.filePath,
        fileSize: row.fileSize,
        fileType: row.fileType,
        createTime: row.createTime,
        updateTime: row.updateTime,
        indexTime: row.indexTime
      }))
    } catch (error) {
      console.error('快速搜索失败:', error)
      return []
    }
  }

  /**
   * 获取搜索建议（自动完成）
   */
  static async getSearchSuggestions(partialKeyword: string, limit: number = 10): Promise<string[]> {
    try {
      if (!partialKeyword || partialKeyword.trim().length === 0) {
        return []
      }

      const keyword = partialKeyword.trim()
      
      // 搜索分词字段中包含关键词的文件
      const optimizedKeyword = this.optimizeSearchKeyword(keyword)
      const query = `
        SELECT DISTINCT file_name
        FROM file_index_fts
        WHERE file_name_segmented MATCH ?
        ORDER BY length(file_name) ASC
        LIMIT ?
      `
      
      const results = await AppDataSource.query(query, [optimizedKeyword, limit])
      
      return results.map((row: any) => row.file_name)
    } catch (error) {
      console.error('获取搜索建议失败:', error)
      return []
    }
  }

  /**
   * 获取文件索引状态
   */
  static async getFileIndexStatus(): Promise<FileIndexStatusDto> {
    try {
      // 获取总文件数
      const totalResult = await AppDataSource.query('SELECT COUNT(*) as count FROM file_index')
      const totalFiles = totalResult[0]?.count || 0

      // 获取最后索引时间
      const lastIndexResult = await AppDataSource.query(`
        SELECT MAX(index_time) as last_index_time FROM file_index
      `)
      const lastIndexTime = lastIndexResult[0]?.last_index_time || ''

      // 判断索引是否健康（有数据且最近有更新）
      const isHealthy = totalFiles > 0 && lastIndexTime !== ''

      // 从 FileIndexWorkerService 获取正确的索引状态
      const isIndexing = FileIndexWorkerService.isIndexingInProgress()

      return {
        totalFiles,
        indexedFiles: totalFiles,
        lastIndexTime,
        isHealthy,
        isIndexing
      }
    } catch (error) {
      console.error('获取文件索引状态失败:', error)
      throw error
    }
  }

  /**
   * 重建文件索引
   */
  static async rebuildFileIndex(): Promise<void> {
    try {
      console.log('开始重建文件索引...')
      await this.indexSystemFiles()
      console.log('文件索引重建完成')
    } catch (error) {
      console.error('重建文件索引失败:', error)
      throw error
    }
  }

  /**
   * 清空索引
   */
  private static async clearIndex(): Promise<void> {
    try {
      await AppDataSource.query('DELETE FROM file_index')
      console.log('已清空文件索引')
    } catch (error) {
      console.error('清空索引失败:', error)
      throw error
    }
  }

  /**
   * 获取索引进度
   */
  static getIndexProgress() {
    return FileIndexWorkerService.getProgress()
  }


}
