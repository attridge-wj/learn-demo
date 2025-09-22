import * as path from 'path'
import * as fs from 'fs-extra'
import { toUnicode } from 'idna-uts46'

// 获取系统编码
function getSystemEncoding(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return 'gbk'
  } else if (platform === 'darwin') {
    return 'utf-8'
  } else {
    return 'utf-8'
  }
}

// 检测文件编码
export async function detectFileEncoding(buffer: Buffer): Promise<{ content: string, encoding: string }> {
  const platform = process.platform
  const defaultEncoding = getSystemEncoding()

  try {
    // 首先尝试 UTF-8
    const utf8Content = buffer.toString('utf-8')
    // 检查是否包含 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
    
    // 检查是否包含无效字符（替换字符）
    if (!utf8Content.includes('\uFFFD')) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
  } catch (error) {
    // UTF-8 解码失败，继续尝试其他编码
  }

  // 尝试系统默认编码
  try {
    const content = buffer.toString(defaultEncoding as BufferEncoding)
    if (!content.includes('\uFFFD')) {
      return { content, encoding: defaultEncoding }
    }
  } catch (error) {
    // 系统默认编码失败
  }

  // 最后尝试 Latin-1
  try {
    const content = buffer.toString('latin1')
    return { content, encoding: 'latin1' }
  } catch (error) {
    return { content: buffer.toString('utf-8'), encoding: 'utf-8' }
  }
}

// 获取文件类型
export function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  
  const typeMap: { [key: string]: string } = {
    // 文档格式
    '.pdf': 'pdf',
    '.doc': 'doc',
    '.docx': 'docx',
    '.txt': 'txt',
    '.md': 'markdown',
    '.rtf': 'rtf',
    
    // 代码文件
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.java': 'java',
    '.py': 'python',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bat': 'batch',
    '.ps1': 'powershell',
    
    // 配置文件
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'config',
    '.conf': 'config',
    
    // 其他文本格式
    '.log': 'log',
    '.gitignore': 'gitignore',
    '.dockerfile': 'dockerfile',
    '.makefile': 'makefile',
    '.cmake': 'cmake'
  }
  
  return typeMap[ext] || 'unknown'
}

// 检查是否支持文档内容提取
export function isSupportedDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  
  const supportedExtensions = [
    // 文档格式
    '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
    // 代码文件
    '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.scss', '.less',
    '.java', '.py', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go',
    '.rs', '.swift', '.kt', '.scala', '.sql', '.sh', '.bat', '.ps1',
    // 配置文件
    '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.cfg', '.conf',
    // 其他文本格式
    '.log', '.gitignore', '.dockerfile', '.makefile', '.cmake'
  ]
  
  return supportedExtensions.includes(ext)
}

// 提取文档内容（简化版本，不依赖外部库）
export async function extractDocumentContent(filePath: string, fileType: string): Promise<{ content: string, pages: any[] }> {
  try {
    // 对于文本文件，直接读取内容
    if (['txt', 'md', 'markdown', 'log', 'gitignore', 'dockerfile', 'makefile', 'cmake'].includes(fileType)) {
      const buffer = await fs.readFile(filePath)
      const { content } = await detectFileEncoding(buffer)
      
      return {
        content,
        pages: [{
          pageNumber: 1,
          content: content,
          wordCount: content.length
        }]
      }
    }
    
    // 对于代码文件
    if (['javascript', 'typescript', 'html', 'css', 'scss', 'less', 'java', 'python', 'cpp', 'c', 'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'sql', 'shell', 'batch', 'powershell'].includes(fileType)) {
      const buffer = await fs.readFile(filePath)
      const { content } = await detectFileEncoding(buffer)
      
      return {
        content,
        pages: [{
          pageNumber: 1,
          content: content,
          wordCount: content.length
        }]
      }
    }
    
    // 对于配置文件
    if (['yaml', 'json', 'xml', 'toml', 'ini', 'config'].includes(fileType)) {
      const buffer = await fs.readFile(filePath)
      const { content } = await detectFileEncoding(buffer)
      
      return {
        content,
        pages: [{
          pageNumber: 1,
          content: content,
          wordCount: content.length
        }]
      }
    }
    
    // 对于不支持的格式，返回空内容
    return {
      content: '',
      pages: []
    }
    
  } catch (error) {
    console.error(`提取文档内容失败: ${filePath}`, error)
    return {
      content: '',
      pages: []
    }
  }
}

// 获取协议类型（简化版本）
export function getProtocolType(filePath: string): string {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return 'http'
  } else if (filePath.startsWith('file://')) {
    return 'file'
  } else {
    return 'file'
  }
}

// 解析文件路径（简化版本）
export async function resolveFilePath(filePath: string): Promise<string> {
  // 如果是协议路径，直接返回
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
    return filePath
  }
  
  // 如果是绝对路径，直接返回
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  
  // 相对路径，转换为绝对路径
  return path.resolve(filePath)
}

// 转换为原始路径（简化版本）
export function convertToOriginalPath(filePath: string): string {
  // 移除 file:// 协议前缀
  if (filePath.startsWith('file://')) {
    return filePath.substring(7)
  }
  
  return filePath
}
