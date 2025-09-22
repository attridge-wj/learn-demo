import * as path from 'path'
import * as os from 'os'
import store from '../../../utils/store'
import { toUnicode } from 'idna-uts46'
import { getDefaultStoragePath } from '../../../utils/file'
// 获取存储路径
export function getStoragePath(): string {
  const storagePath = store.get('storagePath') || getDefaultStoragePath()
  return path.join(storagePath, 'files')
}

// 处理文件路径
export function resolveFilePath(filePath: string): string {
  // 处理 user-data:// 协议
  if (filePath.startsWith('user-data://')) {
    let relativePath = filePath.replace('user-data://files/', '')
    relativePath = relativePath.replace('user-data://', '')
    // 移除开头/结尾的斜杠
    relativePath = relativePath.replace(/^\/|\/$/g, '')
    
    try {
      // 处理 IDN 编码
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      // URL 解码
      relativePath = decodeURIComponent(relativePath)
      const resolvedPath = path.normalize(path.join(getStoragePath(), relativePath))

      // 安全校验：防止目录穿越攻击
      if (!resolvedPath.startsWith(getStoragePath())) {
        throw new Error('无效的文件路径')
      }
      return resolvedPath
    } catch (error) {
      console.error('处理文件路径失败:', error)
      throw new Error('无效的文件路径')
    }
  }
  
  // 处理 app:// 协议
  if (filePath.startsWith('app://')) {
    let relativePath = filePath.replace('app://', '')
    
    try {
      // 处理 IDN 编码
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      // URL 解码
      relativePath = decodeURIComponent(relativePath)
      return path.normalize(relativePath)
    } catch (error) {
      console.error('处理文件路径失败:', error)
      throw new Error('无效的文件路径')
    }
  }
  
  // 处理普通文件路径
  return path.normalize(filePath)
} 