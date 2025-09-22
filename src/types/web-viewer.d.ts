/**
 * Web Viewer模块类型定义
 */

export interface WebBookmark {
  /** 书签ID */
  id: string
  /** 书签名称 */
  name: string
  /** 书签URL */
  url?: string
  /** 描述 */
  description?: string
  /** 父级ID */
  parentId?: string
  /** 类别：directory-文件夹，bookmark-书签 */
  category: string
  /** 空间ID */
  spaceId: string
  /** 创建时间 */
  createTime: string
  /** 更新时间 */
  updateTime: string
  /** 删除标志 */
  delFlag: number
}

export interface WebBookmarkTreeItem extends WebBookmark {
  /** 子书签 */
  children?: WebBookmarkTreeItem[]
}

export interface CreateWebBookmarkDto {
  id: string
  name: string
  url?: string
  description?: string
  parentId?: string
  category: string
  spaceId: string
}

export interface UpdateWebBookmarkDto {
  id?: string
  name?: string
  url?: string
  description?: string
  parentId?: string
  category?: string
  spaceId?: string
}

export interface QueryWebBookmarkDto {
  name?: string
  parentId?: string
  category?: string
  spaceId?: string
}

/**
 * Web Viewer API接口
 */
export interface WebViewerApi {
  /** 创建文件夹及书签 */
  create: (dto: CreateWebBookmarkDto) => Promise<WebBookmark>
  
  /** 查询书签列表 */
  queryAll: (query: QueryWebBookmarkDto) => Promise<WebBookmark[]>
  
  /** 查询单个书签 */
  findOne: (id: string) => Promise<WebBookmark>
  
  /** 修改文件夹及书签 */
  update: (id: string, dto: UpdateWebBookmarkDto) => Promise<WebBookmark>
  
  /** 删除文件夹及书签 */
  delete: (id: string) => Promise<{ success: boolean; message: string }>
  
  /** 获取树形列表 */
  getTree: (spaceId: string) => Promise<WebBookmarkTreeItem[]>
}

/**
 * 全局Window接口扩展
 */
declare global {
  interface Window {
    webViewerApi: WebViewerApi
  }
}
