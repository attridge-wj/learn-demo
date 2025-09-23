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
} from './file-content-parse-worker'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import { normalizeForIndexing } from '../utils/text-normalize.util'

export class DocumentIndexUtilWorker {
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
        return
      }

      const { content, pages } = await this.extractDocumentContent(resolvedPath, fileType)
      
      const normalized = normalizeForIndexing(content || '')
      const protocolType = getProtocolType(filePath)
      const storedPath = protocolType === 'file' ? 'app://' + filePath : filePath
      
      // 删除旧的页面内容（如果存在）
      await this.pageRepository.createQueryBuilder()
        .delete()
        .where('document_id = :documentId', { documentId })
        .execute()

      // 插入新的页面内容
      for (const page of pages) {
        const pageEntity = new DocumentPageContentEntity()
        pageEntity.documentId = documentId
        pageEntity.spaceId = spaceId || ''
        pageEntity.cardId = cardId || ''
        pageEntity.isLocalFile = 1 // 1表示本地文件
        pageEntity.fileName = path.basename(filePath)
        pageEntity.fileType = fileType
        pageEntity.filePath = storedPath
        pageEntity.originPath = filePath
        pageEntity.pageNumber = page.pageNumber || 1
        pageEntity.content = page.content || ''
        pageEntity.contentSegmented = ChineseSegmentUtil.toSearchKeywords(page.content || '')
        pageEntity.createTime = new Date()
        pageEntity.updateTime = new Date()

        await this.pageRepository.save(pageEntity)
      }
    } catch (error) {
      console.error(`索引文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 提取文档内容（Worker 版本）
   */
  private async extractDocumentContent(filePath: string, fileType: string): Promise<{ content: string, pages: any[] }> {
    try {
      // 对于文本文件，直接读取内容
      if (['txt', 'md', 'markdown', 'log', 'gitignore', 'dockerfile', 'makefile', 'cmake'].includes(fileType)) {
        const buffer = await fs.readFile(filePath)
        const { content } = await this.detectFileEncoding(buffer)
        
        return {
          content,
          pages: [{
            pageNumber: 1,
            content: content,
            wordCount: content.length
          }]
        }
      }
      
      // 对于代码文件
      if (['javascript', 'typescript', 'html', 'css', 'scss', 'less', 'java', 'python', 'cpp', 'c', 'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'sql', 'shell', 'batch', 'powershell'].includes(fileType)) {
        const buffer = await fs.readFile(filePath)
        const { content } = await this.detectFileEncoding(buffer)
        
        return {
          content,
          pages: [{
            pageNumber: 1,
            content: content,
            wordCount: content.length
          }]
        }
      }
      
      // 对于配置文件
      if (['yaml', 'json', 'xml', 'toml', 'ini', 'config'].includes(fileType)) {
        const buffer = await fs.readFile(filePath)
        const { content } = await this.detectFileEncoding(buffer)
        
        return {
          content,
          pages: [{
            pageNumber: 1,
            content: content,
            wordCount: content.length
          }]
        }
      }
      
      // 对于不支持的格式，返回空内容
      return {
        content: '',
        pages: []
      }
      
    } catch (error) {
      console.error(`提取文档内容失败: ${filePath}`, error)
      return {
        content: '',
        pages: []
      }
    }
  }

  /**
   * 检测文件编码（Worker 版本）
   */
  private async detectFileEncoding(buffer: Buffer): Promise<{ content: string, encoding: string }> {
    const platform = process.platform
    const defaultEncoding = this.getSystemEncoding()

    try {
      // 首先尝试 UTF-8
      const utf8Content = buffer.toString('utf-8')
      // 检查是否包含 BOM
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return { content: utf8Content, encoding: 'utf-8' }
      }
      
      // 检查是否包含无效字符（替换字符）
      if (!utf8Content.includes('\uFFFD')) {
        return { content: utf8Content, encoding: 'utf-8' }
      }
    } catch (error) {
      // UTF-8 解码失败，继续尝试其他编码
    }

    // 尝试系统默认编码
    try {
      const content = buffer.toString(defaultEncoding as BufferEncoding)
      if (!content.includes('\uFFFD')) {
        return { content, encoding: defaultEncoding }
      }
    } catch (error) {
      // 系统默认编码失败
    }

    // 最后尝试 Latin-1
    try {
      const content = buffer.toString('latin1')
      return { content, encoding: 'latin1' }
    } catch (error) {
      return { content: buffer.toString('utf-8'), encoding: 'utf-8' }
    }
  }

  /**
   * 获取系统编码
   */
  private getSystemEncoding(): string {
    const platform = process.platform
    if (platform === 'win32') {
      return 'gbk'
    } else if (platform === 'darwin') {
      return 'utf-8'
    } else {
      return 'utf-8'
    }
  }
}
