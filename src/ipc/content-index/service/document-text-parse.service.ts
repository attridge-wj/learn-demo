import { AppDataSource } from '../../../database/connection'
import { DocumentPageContentEntity } from '../entities/document-page-content.entity'
import { extractDocumentContent, resolveFilePath, getFileType, getProtocolType } from '../../../common/util/file-content-parse'
import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'
import path from 'path'
import { calculateFileMd5 } from '../../../common/util/file-hash.util'

export interface DocumentTextParseResult {
  success: boolean
  content?: string
  error?: string
  fileInfo?: {
    fileName: string
    fileType: string
    filePath: string
    originPath: string
    pageCount: number
  }
  // 只有PDF文档才有分页信息
  pages?: Array<{
    pageNumber: number
    content: string
    pageType: string
  }>
}

/**
 * 解析文档文本内容
 * @param filePath 文档路径
 * @param cardId 卡片ID（可选）
 * @param spaceId 空间ID（可选）
 * @returns 解析结果
 */
export async function parseDocumentText(
  filePath: string,
  cardId?: string,
  spaceId?: string
): Promise<DocumentTextParseResult> {
  try {
    console.log('开始解析文档文本:', filePath)

    // 解析文件路径
    const resolvedPath = resolveFilePath(filePath)
    const fileType = getFileType(resolvedPath)
    // 先计算 MD5 并检查是否已存在相同的 documentId，存在则直接返回
    const documentId = await calculateFileMd5(resolvedPath)
    const existedDocs = await AppDataSource.manager.find(DocumentPageContentEntity, {
      where: { documentId },
      order: { pageNumber: 'ASC' }
    })
    if (existedDocs.length > 0) {
      console.log('已存在相同文档，跳过解析:', filePath)
      if (existedDocs.length > 1) {
        const pages = existedDocs.map(doc => ({
          pageNumber: doc.pageNumber,
          content: doc.content,
          pageType: 'text'
        }))
        const totalContent = existedDocs.map(doc => doc.content).join('\n')
        return {
          success: true,
          content: totalContent,
          pages,
          fileInfo: {
            fileName: existedDocs[0].fileName,
            fileType: existedDocs[0].fileType,
            filePath: existedDocs[0].filePath,
            originPath: existedDocs[0].originPath,
            pageCount: existedDocs.length
          }
        }
      } else {
        const doc = existedDocs[0]
        return {
          success: true,
          content: doc.content,
          fileInfo: {
            fileName: doc.fileName,
            fileType: doc.fileType,
            filePath: doc.filePath,
            originPath: doc.originPath,
            pageCount: 1
          }
        }
      }
    }
    
    // 未存在则继续解析文件内容
    const parseResult = await extractDocumentContent(resolvedPath, fileType)
    
    const { content, encoding, pages, totalPages } = parseResult

    // 对内容进行分词处理
    const segmentedContent = ChineseSegmentUtil.toSearchKeywords(content)

    // 获取文件名和路径信息
    const fileName = path.basename(resolvedPath)
    const originPath = filePath
    const protocolType = getProtocolType(filePath)
    const storedPath = protocolType === 'file' ? 'app://' + filePath : filePath

    // 只有PDF文档进行分页处理
    if (fileType === 'pdf' && pages && pages.length > 0) {
      // PDF文档：保存每个页面为单独记录
      const pageEntities = pages.map(page => ({
        documentId,
        spaceId: spaceId || 'default',
        cardId: cardId || '',
        isLocalFile: 1,
        fileName,
        fileType,
        filePath: storedPath,
        originPath: storedPath,
        pageNumber: page.pageNumber,
        content: page.content,
        contentSegmented: ChineseSegmentUtil.toSearchKeywords(page.content)
      }))
      
      await AppDataSource.manager.save(DocumentPageContentEntity, pageEntities)
      
      console.log('PDF文档文本解析完成:', {
        fileName,
        fileType,
        pageCount: pages.length,
        totalContentLength: content.length
      })

      return {
        success: true,
        content, // 返回完整内容
        pages, // 返回分页信息
        fileInfo: {
          fileName,
          fileType,
          filePath: storedPath,
          originPath: storedPath,
          pageCount: pages.length
        }
      }
    } else {
      // 非PDF文档：保存为单条记录
      const documentContent = new DocumentPageContentEntity()
      documentContent.documentId = documentId
      documentContent.spaceId = spaceId || 'default'
      documentContent.cardId = cardId || ''
      documentContent.isLocalFile = 1
      documentContent.fileName = fileName
      documentContent.fileType = fileType
      documentContent.filePath = storedPath
      documentContent.originPath = storedPath
      documentContent.pageNumber = 1 // 单页文档
      documentContent.content = content
      documentContent.contentSegmented = segmentedContent

      await AppDataSource.manager.save(documentContent)

      console.log('文档文本解析完成:', {
        fileName,
        fileType,
        contentLength: content.length,
        segmentedLength: segmentedContent.length
      })

      return {
        success: true,
        content,
        fileInfo: {
          fileName,
          fileType,
          filePath: storedPath,
          originPath: storedPath,
          pageCount: 1
        }
      }
    }

  } catch (error) {
    console.error('解析文档文本失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 批量解析文档文本内容
 * @param filePaths 文档路径数组
 * @param spaceId 空间ID（可选）
 * @returns 批量解析结果
 */
export async function parseMultipleDocumentTexts(
  filePaths: string[],
  spaceId?: string
): Promise<{
  success: number
  failed: number
  results: Array<{
    filePath: string
    success: boolean
    content?: string
    error?: string
  }>
}> {
  const results = []
  let success = 0
  let failed = 0

  for (const filePath of filePaths) {
    try {
      const result = await parseDocumentText(filePath, undefined, spaceId)
      
      if (result.success) {
        success++
      } else {
        failed++
      }

      results.push({
        filePath,
        success: result.success,
        content: result.content,
        error: result.error
      })

    } catch (error) {
      failed++
      results.push({
        filePath,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  return {
    success,
    failed,
    results
  }
}

/**
 * 获取已解析的文档内容
 * @param filePath 文档路径
 * @returns 文档内容
 */
export async function getParsedDocumentContent(filePath: string): Promise<DocumentTextParseResult> {
  try {
    const documents = await AppDataSource.manager.find(DocumentPageContentEntity, {
      where: { filePath },
      order: { pageNumber: 'ASC' }
    })

    if (documents.length === 0) {
      return {
        success: false,
        error: '文档未找到'
      }
    }

    // 如果是PDF文档（多条记录），返回分页信息
    if (documents.length > 1) {
      const pages = documents.map(doc => ({
        pageNumber: doc.pageNumber,
        content: doc.content,
        pageType: 'text'
      }))
      
      const totalContent = documents.map(doc => doc.content).join('\n')
      
      return {
        success: true,
        content: totalContent,
        pages,
        fileInfo: {
          fileName: documents[0].fileName,
          fileType: documents[0].fileType,
          filePath: documents[0].filePath,
          originPath: documents[0].originPath,
          pageCount: documents.length
        }
      }
    } else {
      // 非PDF文档（单条记录）
      const document = documents[0]
      return {
        success: true,
        content: document.content,
        fileInfo: {
          fileName: document.fileName,
          fileType: document.fileType,
          filePath: document.filePath,
          originPath: document.originPath,
          pageCount: 1
        }
      }
    }

  } catch (error) {
    console.error('获取已解析文档内容失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
} 