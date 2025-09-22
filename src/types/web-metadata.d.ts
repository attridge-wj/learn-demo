/**
 * 网页元数据类型定义
 */

export interface WebMetadata {
  /** 网页标题 */
  title: string
  /** 网页描述/概要 */
  description: string
  /** 网页图标URL */
  icon: string
  /** 网页URL */
  url: string
  /** 是否成功获取 */
  success: boolean
  /** 错误信息（如果有） */
  error?: string
}

/**
 * 全局Window接口扩展
 */
declare global {
  interface Window {
    systemApi: {
      // ... 其他系统API
      getWebMetadata: (url: string) => Promise<WebMetadata>
    }
  }
}
