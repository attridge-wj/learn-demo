import * as fs from 'fs-extra'
import * as path from 'path'
import { getDirectoryContents } from '../util/file.util'

// 读取目录内容
export async function readDirectory(dirPath: string) {
  try {
    // 处理 Windows 盘符路径
    if (process.platform === 'win32' && /^[A-Za-z]:$/.test(dirPath)) {
      dirPath = `${dirPath}\\`
    }

    if (!await fs.pathExists(dirPath)) {
      throw new Error('目录不存在')
    }

    // 添加错误处理，跳过无法访问的文件
    try {
      return await getDirectoryContents(dirPath)
    } catch (error) {
      console.error('读取目录内容失败:', error)
      // 如果无法读取目录内容，返回空数组而不是抛出错误
      return []
    }
  } catch (error) {
    console.error('读取目录失败:', error)
    throw error
  }
} 