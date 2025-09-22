import * as fs from 'fs-extra'
import { shell } from 'electron'
import { readFileContent, writeFileContent, readFileStream as readFileStreamUtil } from '../util/file.util'
import { getSystemEncoding } from '../util/system.util'

// 打开文件
export async function openFile(filePath: string) {
  try {
    if (!await fs.pathExists(filePath)) {
      throw new Error('文件不存在')
    }
    await shell.openPath(filePath)
    return { success: true }
  } catch (error) {
    console.error('打开文件失败:', error)
    throw error
  }
}

// 复制文件到剪贴板
export async function copyFile(filePath: string) {
  try {
    if (!await fs.pathExists(filePath)) {
      throw new Error('文件不存在')
    }
    // 这里需要实现文件复制到剪贴板的功能
    // 由于 Electron 的限制，可能需要使用其他方式实现
    return { success: true }
  } catch (error) {
    console.error('复制文件失败:', error)
    throw error
  }
}

// 剪切文件到剪贴板
export async function cutFile(filePath: string) {
  try {
    if (!await fs.pathExists(filePath)) {
      throw new Error('文件不存在')
    }
    // 这里需要实现文件剪切到剪贴板的功能
    // 由于 Electron 的限制，可能需要使用其他方式实现
    return { success: true }
  } catch (error) {
    console.error('剪切文件失败:', error)
    throw error
  }
}

// 删除文件
export async function deleteFile(filePath: string) {
  try {
    if (!await fs.pathExists(filePath)) {
      throw new Error('文件不存在')
    }
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      await fs.remove(filePath)
    } else {
      await fs.unlink(filePath)
    }
    return { success: true }
  } catch (error) {
    console.error('删除文件失败:', error)
    throw error
  }
}

// 读取文件内容
export async function readFile(filePath: string) {
  try {
    console.log(filePath, 'filePath');
    
    return await readFileContent(filePath)
  } catch (error) {
    console.error('读取文件失败:', error)
    throw error
  }
}

// 保存文件内容
export async function writeFile(filePath: string, content: string, encoding?: string) {
  try {
    const defaultEncoding = encoding || getSystemEncoding()
    return await writeFileContent(filePath, content, defaultEncoding)
  } catch (error) {
    console.error('保存文件失败:', error)
    throw error
  }
}

// 读取文件流
export async function readFileStream(filePath: string) {
  try {
    console.log('读取文件流:', filePath)
    return await readFileStreamUtil(filePath)
  } catch (error) {
    console.error('读取文件流失败:', error)
    return ''
  }
} 