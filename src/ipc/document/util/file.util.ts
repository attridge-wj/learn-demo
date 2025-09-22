import * as fs from 'fs-extra'
import * as path from 'path'
import { resolveFilePath } from './file-path.util'
import { getShortcutTarget, getFileIcon } from './system.util'

// 检查文件是否可读
export async function isFileReadable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

// 检查文件是否可写
export async function isFileWritable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

// 获取文件编码
export async function detectFileEncoding(buffer: Buffer): Promise<{ content: string, encoding: string }> {
  const platform = process.platform
  const defaultEncoding = platform === 'win32' ? 'gbk' : 'utf-8'

  try {
    // 首先尝试 UTF-8
    const utf8Content = buffer.toString('utf-8')
    // 检查是否包含 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
    // 检查是否为有效的 UTF-8
    if (Buffer.from(utf8Content, 'utf-8').equals(buffer)) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
  } catch {
    // UTF-8 解码失败，继续尝试其他编码
  }

  // 根据系统尝试不同的编码
  const encodings = ['utf-8', defaultEncoding]
  if (platform === 'win32') {
    encodings.push('gbk', 'gb2312', 'big5')
  } else if (platform === 'darwin') {
    encodings.push('mac-roman')
  }

  for (const encoding of encodings) {
    try {
      const iconv = require('iconv-lite')
      const content = iconv.decode(buffer, encoding)
      // 验证解码结果
      const reencoded = iconv.encode(content, encoding)
      if (reencoded.equals(buffer)) {
        return { content, encoding }
      }
    } catch {
      continue
    }
  }

  // 如果所有编码都失败，使用系统默认编码
  const iconv = require('iconv-lite')
  return {
    content: iconv.decode(buffer, defaultEncoding),
    encoding: defaultEncoding
  }
}

// 获取文件信息
export async function getFileInfo(filePath: string) {
  const stats = await fs.stat(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const isExecutable = ['.exe', '.lnk', '.msi', '.bat', '.cmd'].includes(extension)
  
  let icon = null
  if (isExecutable) {
    try {
      let targetPath = filePath
      // 如果是快捷方式，获取其目标路径
      if (extension === '.lnk') {
        targetPath = await getShortcutTarget(filePath)
        if (!targetPath) {
          throw new Error('无法获取快捷方式目标')
        }
      }
      
      // 获取应用程序图标
      icon = await getFileIcon(targetPath)
    } catch (error) {
      console.warn('获取图标失败:', error)
    }
  }

  return {
    name: path.basename(filePath),
    path: filePath,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    createTime: stats.birthtime,
    modifyTime: stats.mtime,
    accessTime: stats.atime,
    extension,
    isExecutable,
    icon
  }
}

// Windows系统特殊目录，这些目录通常不需要显示或访问受限
const WINDOWS_SPECIAL_DIRS = new Set([
  'Config.Msi',
  'Documents and Settings',
  'System Volume Information',
  '$Recycle.Bin',
  '$WinREAgent',
  'Recovery',
  'PerfLogs'
])

// 获取目录内容
export async function getDirectoryContents(dirPath: string) {
  try {
    const items = await fs.readdir(dirPath)
    const contents = await Promise.all(
      items
        .filter(item => {
          // 过滤Windows系统特殊目录
          if (process.platform === 'win32' && WINDOWS_SPECIAL_DIRS.has(item)) {
            return false
          }
          return true
        })
        .map(async item => {
          try {
            const fullPath = path.join(dirPath, item)
            const stats = await fs.lstat(fullPath) // 使用lstat代替stat来处理符号链接
            
            // 如果是符号链接，尝试获取真实路径
            let realPath = fullPath
            let isSymlink = false
            if (stats.isSymbolicLink()) {
              try {
                realPath = await fs.realpath(fullPath)
                isSymlink = true
              } catch (error) {
                console.warn(`无法解析符号链接: ${item}`, error)
                return null
              }
            }

            // 如果是符号链接且目标存在，或者是普通文件/目录
            if (isSymlink || await fs.pathExists(fullPath)) {
              const fileInfo = await getFileInfo(realPath)
              return {
                ...fileInfo,
                name: path.basename(fullPath), // 保持原始名称
                path: fullPath, // 保持原始路径
                isSymlink,
                realPath: isSymlink ? realPath : undefined
              }
            }
            return null
          } catch (error) {
            // 只记录详细错误，但不显示在界面上
            const err = error as { code?: string }
            if (err.code !== 'EPERM' && err.code !== 'ENOENT') {
              console.warn(`无法访问文件: ${item}`, error)
            }
            return null
          }
        })
    )
    
    // 过滤掉无法访问的文件（null 值）
    return contents
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        // 文件夹优先，然后按名称排序
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  } catch (error) {
    console.error('读取目录失败:', error)
    throw error
  }
}

// 读取文件内容
export async function readFileContent(filePath: string) {
  try {
    // 解析文件路径
    const resolvedPath = resolveFilePath(filePath)
    console.log('读取文件路径:', resolvedPath)

    if (!await fs.pathExists(resolvedPath)) {
      throw new Error('文件不存在')
    }

    const stats = await fs.stat(resolvedPath)
    if (stats.isDirectory()) {
      throw new Error('不能读取目录')
    }

    // 检查文件权限
    if (!await isFileReadable(resolvedPath)) {
      throw new Error('没有读取权限')
    }

    // 检查文件大小，如果超过 20MB 则拒绝读取
    if (stats.size > 20 * 1024 * 1024) {
      throw new Error('文件太大，无法读取')
    }

    // 读取文件内容
    const buffer = await fs.readFile(resolvedPath)
    const { content, encoding } = await detectFileEncoding(buffer)

    return {
      content,
      encoding,
      size: stats.size,
      lastModified: stats.mtime
    }
  } catch (error) {
    console.error('读取文件失败:', error)
    throw error
  }
}

// 保存文件内容
export async function writeFileContent(filePath: string, content: string, encoding: string) {
  try {
    // 解析文件路径
    const resolvedPath = resolveFilePath(filePath)
    console.log('保存文件路径:', resolvedPath)

    // 检查目标目录是否存在
    const dirPath = path.dirname(resolvedPath)
    if (!await fs.pathExists(dirPath)) {
      await fs.mkdirp(dirPath)
    }

    // 检查文件权限
    if (await fs.pathExists(resolvedPath)) {
      const stats = await fs.stat(resolvedPath)
      if (!stats.isFile()) {
        throw new Error('目标路径不是文件')
      }
      if (!await isFileWritable(resolvedPath)) {
        throw new Error('没有写入权限')
      }
    }

    // 根据编码保存文件
    let buffer: Buffer
    if (encoding.toLowerCase() === 'utf-8') {
      // 添加 UTF-8 BOM
      buffer = Buffer.concat([
        Buffer.from([0xEF, 0xBB, 0xBF]),
        Buffer.from(content, 'utf-8')
      ])
    } else {
      const iconv = require('iconv-lite')
      buffer = iconv.encode(content, encoding)
    }

    await fs.writeFile(resolvedPath, buffer)
    
    return {
      success: true,
      size: buffer.length,
      lastModified: new Date()
    }
  } catch (error) {
    console.error('保存文件失败:', error)
    throw error
  }
}

// 读取文件流
export async function readFileStream(filePath: string) {
  try {
    console.log('读取文件流:', filePath)
    
    // 解析文件路径
    const resolvedPath = resolveFilePath(filePath)
    
    if (!await fs.pathExists(resolvedPath)) {
      throw new Error('文件不存在')
    }

    const stats = await fs.stat(resolvedPath)
    if (stats.isDirectory()) {
      throw new Error('不能读取目录')
    }

    // 检查文件权限
    if (!await isFileReadable(resolvedPath)) {
      throw new Error('没有读取权限')
    }

    // 直接读取文件为Buffer
    const buffer = await fs.readFile(resolvedPath)
    
    return buffer;
  } catch (error) {
    console.error('读取文件流失败:', error)
    return ''
  }
} 