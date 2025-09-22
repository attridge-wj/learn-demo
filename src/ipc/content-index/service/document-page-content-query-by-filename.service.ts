import { AppDataSource } from '../../../database/connection'
import { DocumentPageContentEntity } from '../entities/document-page-content.entity'
import { QueryByFileNameDto, QueryByFileNameResponseDto } from '../dto/index.dto'

/**
 * 通过文件名查询文档页面内容
 * @param query 查询参数
 * @returns 查询结果
 */
export async function queryDocumentPageContentByFileName(query: QueryByFileNameDto): Promise<QueryByFileNameResponseDto> {
  try {
    const repo = AppDataSource.getRepository(DocumentPageContentEntity)
    
    // 构建查询条件
    const qb = repo.createQueryBuilder('doc')
      .where('doc.fileName IN (:...fileNames)', { fileNames: query.fileNames })
    
    // 如果指定了空间ID，添加空间过滤条件
    if (query.spaceId) {
      qb.andWhere('doc.spaceId = :spaceId', { spaceId: query.spaceId })
    }
    
    // 按文件名和页码排序
    qb.orderBy('doc.fileName', 'ASC')
      .addOrderBy('doc.pageNumber', 'ASC')
    
    const results = await qb.getMany()
    
    // 转换为DTO格式
    const data = results.map(item => ({
      id: item.id.toString(),
      fileName: item.fileName,
      pageNumber: item.pageNumber,
      content: item.content,
      spaceId: item.spaceId,
      createTime: item.createTime?.toISOString(),
      updateTime: item.updateTime?.toISOString()
    }))
    
    return {
      success: true,
      data,
      message: `成功查询到 ${data.length} 条记录`
    }
  } catch (error) {
    console.error('通过文件名查询文档页面内容失败:', error)
    return {
      success: false,
      data: [],
      message: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}
