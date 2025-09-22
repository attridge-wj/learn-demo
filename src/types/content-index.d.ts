export interface SearchRequestDto {
  keyword: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

export interface AdvancedSearchRequestDto {
  keyword: string
  limit?: number
  offset?: number
}

export interface SearchResultDto {
  id: string | number
  name: string
  text: string
  cardType?: string
  description: string
  extra_data: string
  mark_text: string
  rich_text: string
  file_content: string
  drawboard_content: string
  mind_map_content: string
  highlight: string
  rank: number
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

declare global {
  interface Window {
    contentIndexApi: {
      search: (request: SearchRequestDto) => Promise<SearchResponseDto>
      advancedSearch: (request: AdvancedSearchRequestDto) => Promise<SearchResponseDto>
      searchCount: (request: { keyword: string }) => Promise<number>
      rebuildIndex: (request?: { spaceId?: string }) => Promise<void>
      getIndexStatus: (request?: { spaceId?: string }) => Promise<IndexStatusDto>
      optimizeIndex: () => Promise<void>
      queryByFileName: (request: QueryByFileNameDto) => Promise<QueryByFileNameResponseDto>
    }
  }
} 