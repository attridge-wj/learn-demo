import { AppDataSource } from '../../../database/connection'
import { DocumentPageContentEntity } from '../../content-index/entities/document-page-content.entity'

export async function getDocumentPages(documentId: string) {
  try {
    const pages = await AppDataSource.manager.find(DocumentPageContentEntity, {
      where: { documentId },
      order: { pageNumber: 'ASC' }
    })
    
    return pages
  } catch (error) {
    console.error('获取文档页面失败:', error)
    throw error
  }
}

export async function getDocumentPage(documentId: string, pageNumber: number) {
  try {
    const page = await AppDataSource.manager.findOne(DocumentPageContentEntity, {
      where: { documentId, pageNumber }
    })
    
    return page
  } catch (error) {
    console.error('获取文档页面失败:', error)
    throw error
  }
} 