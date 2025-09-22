export interface SearchRequestDto {
  keyword: string
  spaceId?: string
  cardType?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

export interface AdvancedSearchRequestDto {
  keyword: string
  spaceId?: string
  fields?: string[]
  limit?: number
  offset?: number
}

export interface SearchResultDto {
  id: string
  name: string
  
  text: string
  cardType?: string
  rank?: number
}

export interface SearchResponseDto {
  list: SearchResultDto[]
  total: number
  keyword: string
  limit: number
  offset: number
}

export interface IndexStatusDto {
  totalRecords: number
  indexedRecords: number
  lastUpdate: string
  isHealthy: boolean
}

export interface QueryByFileNameDto {
  fileNames: string[]
  spaceId?: string
}

export interface DocumentPageContentDto {
  id: string
  fileName: string
  pageNumber: number
  content: string
  spaceId?: string
  createTime?: string
  updateTime?: string
}

export interface QueryByFileNameResponseDto {
  success: boolean
  data: DocumentPageContentDto[]
  message?: string
} 