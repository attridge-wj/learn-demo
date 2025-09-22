import { Repository } from 'typeorm'
import { AppDataSource } from '../../../database/connection'
import { DocumentPageContentEntity } from '../entities/document-page-content.entity'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import { calculateFileMd5 } from '../../../common/util/file-hash.util'
import {
  getFileType,
  isSupportedDocument,
  extractDocumentContent,
  getProtocolType,
  resolveFilePath,
  convertToOriginalPath
} from '../../../common/util/file-content-parse'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { normalizeForIndexing } from './text-normalize.util'


export class DocumentIndexUtil {
  private pageRepository: Repository<DocumentPageContentEntity>
  
  constructor() {
    this.pageRepository = AppDataSource.getRepository(DocumentPageContentEntity)
  }

  /**
   * 索引单个文件
   */
  async indexFile(filePath: string, cardId?: string, spaceId?: string): Promise<void> {
    try {
      const resolvedPath = await resolveFilePath(filePath)
      const fileType = getFileType(resolvedPath)
      const documentId = await calculateFileMd5(resolvedPath)

      // 若已存在相同 documentId，直接返回（跳过解析和写入）
      const existed = await this.pageRepository.find({ where: { documentId }, take: 1 })
      if (existed.length > 0) {
        console.log('已存在相同文档，跳过索引:', filePath)
        return
      }

      const { content, pages } = await this.extractDocumentContent(resolvedPath, fileType)
      
      const normalized = normalizeForIndexing(content || '')
      const protocolType = getProtocolType(filePath)
      const storedPath = protocolType === 'file' ? 'app://' + filePath : filePath
      
      // 删除旧的页面内容（如果存在）
      await this.pageRepository.createQueryBuilder()
        .delete()
        .from(DocumentPageContentEntity)
        .where('filePath IN (:...paths)', { paths: [filePath, storedPath] })
        .execute()
      
      // 只有PDF文档进行分页处理
      if (fileType === 'pdf' && pages && pages.length > 0) {
        const pageEntities = pages.map(page => {
          const pageContent = normalizeForIndexing(page.content || '')
          return ({
            documentId,
            spaceId: spaceId || 'default', // 提供默认值
            cardId: cardId || '',
            isLocalFile: 1,
            fileName: path.basename(resolvedPath),
            fileType,
            filePath: storedPath,
            originPath: storedPath,
            pageNumber: page.pageNumber,
            content: pageContent,
            contentSegmented: ChineseSegmentUtil.toSearchKeywords(pageContent)
          })
        })
        
        await this.pageRepository.save(pageEntities)
      } else {
        // 非PDF文档或没有分页信息的文档，创建单条记录
        const pageEntity = {
          documentId,
          spaceId: spaceId || 'default', // 提供默认值
          cardId: cardId || '',
          isLocalFile: 1,
          fileName: path.basename(resolvedPath),
          fileType,
          filePath: storedPath,
          originPath: storedPath,
          pageNumber: 1,
          content: normalized,
          contentSegmented: ChineseSegmentUtil.toSearchKeywords(normalized)
        }
        
        await this.pageRepository.save(pageEntity as any)
      }
      
      console.log('文件索引完成:', filePath)
    } catch (error) {
      console.error('索引文件失败:', filePath, error)
      throw error
    }
  }
  
  /**
   * 提取文档内容
   */
  private async extractDocumentContent(filePath: string, fileType: string): Promise<{ content: string, pages?: Array<{ pageNumber: number, content: string, pageType: string }> }> {
    try {
      const result = await extractDocumentContent(filePath, fileType)
      return result
    } catch (error) {
      console.error('提取文档内容失败:', error)
      throw error
    }
  }
  
  /**
   * 索引文件夹
   */
  async indexDirectory(dirPath: string, spaceId?: string): Promise<{ success: number, failed: number, errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }
    
    try {
      // 解析目录路径
      const resolvedPath = resolveFilePath(dirPath)
      
      // 检查目录是否存在
      if (!await fs.pathExists(resolvedPath)) {
        throw new Error('目录不存在')
      }
      
      const stats = await fs.stat(resolvedPath)
      if (!stats.isDirectory()) {
        throw new Error('路径不是目录')
      }
      
      // 递归遍历目录
      const files = await this.getAllFiles(resolvedPath)
      const supportedFiles = files.filter(file => isSupportedDocument(file))
      
      console.log(`找到 ${supportedFiles.length} 个支持的文件需要索引`)
      
      // 处理文件
      for (const file of supportedFiles) {
        try {
          // 将绝对路径转换为原始协议路径
          const originalPath = this.convertToOriginalPath(file, dirPath)
          await this.indexFile(originalPath, undefined, spaceId)
          results.success++
        } catch (error) {
          results.failed++
          const errorMsg = error instanceof Error ? error.message : '未知错误'
          results.errors.push(`${file}: ${errorMsg}`)
          console.error(`索引文件失败: ${file}`, error)
        }
      }
      
      return results
    } catch (error) {
      console.error('索引目录失败:', error)
      throw error
    }
  }
  
  /**
   * 递归获取所有文件
   */
  private async getAllFiles(dirPath: string, maxDepth: number = 10, currentDepth: number = 0): Promise<string[]> {
    const files: string[] = []
    
    if (currentDepth >= maxDepth) {
      console.warn(`目录深度超过限制: ${dirPath}`)
      return files
    }
    
    try {
      const items = await fs.readdir(dirPath)
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        
        try {
          const stats = await fs.stat(fullPath)
          
          if (stats.isDirectory()) {
            // 递归处理子目录
            const subFiles = await this.getAllFiles(fullPath, maxDepth, currentDepth + 1)
            files.push(...subFiles)
          } else if (stats.isFile()) {
            files.push(fullPath)
          }
        } catch (error) {
          console.warn(`无法访问文件/目录: ${fullPath}`, error)
          continue
        }
      }
    } catch (error) {
      console.error('读取目录失败:', error)
    }
    
    return files
  }
  
  /**
   * 将绝对路径转换为原始协议路径
   */
  private convertToOriginalPath(absolutePath: string, originalDirPath: string): string {
    return convertToOriginalPath(absolutePath, originalDirPath)
  }
} 