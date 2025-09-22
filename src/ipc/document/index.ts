import { ipcMain, IpcMainInvokeEvent } from 'electron'
import * as fs from 'fs-extra'
import { AppDataSource } from '../../database/connection'

// 导入工具函数
import { getSpecialDirectories, getSystemDrives, getSystemEncoding, cleanupShortcutCache } from './util/system.util'
import { readDirectory } from './services/document-directory.service'
import { openFile, copyFile, cutFile, deleteFile, readFile, writeFile, readFileStream } from './services/document-file.service'
import { getDocumentPages, getDocumentPage } from './services/document-page.service'

// 定期清理缓存（每天一次）
setInterval(cleanupShortcutCache, 24 * 60 * 60 * 1000)

export function setupDocumentIPC(): void {
  // 获取系统特殊目录
  ipcMain.handle('document:getSpecialDirectories', async () => {
    try {
      return await getSpecialDirectories()
    } catch (error) {
      console.error('获取特殊目录失败:', error)
      throw error
    }
  })

  // 获取系统盘符
  ipcMain.handle('document:getSystemDrives', async () => {
    try {
      return await getSystemDrives()
    } catch (error) {
      console.error('获取系统盘符失败:', error)
      throw error
    }
  })

  // 读取目录内容
  ipcMain.handle('document:readDirectory', async (_event: IpcMainInvokeEvent, dirPath: string) => {
    try {
      return await readDirectory(dirPath)
    } catch (error) {
      console.error('读取目录失败:', error)
      throw error
    }
  })

  // 打开文件
  ipcMain.handle('document:openFile', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await openFile(filePath)
    } catch (error) {
      console.error('打开文件失败:', error)
      throw error
    }
  })

  // 复制文件到剪贴板
  ipcMain.handle('document:copyFile', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await copyFile(filePath)
    } catch (error) {
      console.error('复制文件失败:', error)
      throw error
    }
  })

  // 剪切文件到剪贴板
  ipcMain.handle('document:cutFile', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await cutFile(filePath)
    } catch (error) {
      console.error('剪切文件失败:', error)
      throw error
    }
  })

  // 删除文件
  ipcMain.handle('document:deleteFile', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await deleteFile(filePath)
    } catch (error) {
      console.error('删除文件失败:', error)
      throw error
    }
  })

  // 读取文件内容
  ipcMain.handle('document:readFile', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await readFile(filePath)
    } catch (error) {
      console.error('读取文件失败:', error)
      throw error
    }
  })

  // 保存文件内容
  ipcMain.handle('document:writeFile', async (_event: IpcMainInvokeEvent, { filePath, content, encoding = getSystemEncoding() }: { filePath: string, content: string, encoding?: string }) => {
    try {
      return await writeFile(filePath, content, encoding)
    } catch (error) {
      console.error('保存文件失败:', error)
      throw error
    }
  })

  // 获取文档页面内容
  ipcMain.handle('document:getDocumentPages', async (_event: IpcMainInvokeEvent, documentId: string) => {
    try {
      return await getDocumentPages(documentId)
    } catch (error) {
      console.error('获取文档页面失败:', error)
      throw error
    }
  })

  // 获取文档页面内容
  ipcMain.handle('document:getDocumentPage', async (_event: IpcMainInvokeEvent, { documentId, pageNumber }: { documentId: string, pageNumber: number }) => {
    try {
      return await getDocumentPage(documentId, pageNumber)
    } catch (error) {
      console.error('获取文档页面失败:', error)
      throw error
    }
  })

  // 读取文件流
  ipcMain.handle('document:readFileStream', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      return await readFileStream(filePath)
    } catch (error) {
      console.error('读取文件流失败:', error)
      return ''
    }
  })
} 