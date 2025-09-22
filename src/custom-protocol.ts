import { protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { getDefaultStoragePath } from './utils/file';
import Store from 'electron-store';
import { toUnicode } from 'idna-uts46';
import { appStartParamsManager } from './app-start-params';
import { BrowserWindow } from 'electron';

const store = new Store() as unknown as {
  get: (key: string) => string | undefined
  set: (key: string, value: any) => void
}

// 获取文件的 MIME 类型
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 处理 Range 请求
async function handleRangeRequest(filePath: string, rangeHeader: string): Promise<{ start: number; end: number; status: number; headers: any }> {
  const stat = await fs.stat(filePath);
  const fileSize = stat.size;
  
  if (!rangeHeader) {
    return {
      start: 0,
      end: fileSize - 1,
      status: 200,
      headers: {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes'
      }
    };
  }

  const range = rangeHeader.replace('bytes=', '');
  const parts = range.split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return {
      start: 0,
      end: 0,
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Length': 0
      }
    };
  }

  return {
    start,
    end,
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes'
    }
  };
}

// 创建文件流响应
async function createFileResponse(filePath: string, rangeHeader?: string): Promise<Response> {
  try {
    // 检查文件是否存在
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return new Response('File not found', { status: 404 });
    }

    // 获取文件信息
    const stat = await fs.stat(filePath);
    const mimeType = getMimeType(filePath);
    const rangeInfo = await handleRangeRequest(filePath, rangeHeader || '');
    
    const headers: any = {
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      ...rangeInfo.headers
    };

    // 创建文件读取流
    const fileStream = fs.createReadStream(filePath, {
      start: rangeInfo.start,
      end: rangeInfo.end,
      highWaterMark: 64 * 1024 // 64KB 缓冲区，提高性能
    });

    // 将 Node.js 流转换为 Web Stream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (error) => {
          console.error('文件流读取错误:', error);
          controller.error(error);
        });
      },
      cancel() {
        fileStream.destroy();
      }
    });

    return new Response(webStream, {
      status: rangeInfo.status,
      headers
    });
  } catch (error) {
    console.error('创建文件响应失败:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// 注册协议
export function registerProtocol() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'user-data',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      corsEnabled: true,
      stream: true
    }
  }])
}

// 处理协议请求
export function handleProtocol() {
  const storagePath = store.get('storagePath') || getDefaultStoragePath();
  // 修复：默认使用 <userData>/files 作为基础目录，与文件存储保持一致
  const baseDir = path.join(storagePath, 'files')

  protocol.handle('user-data', async (request) => {
    let relativePath = request.url.replace('user-data://files/', '')
    relativePath = relativePath.replace('user-data://', '')
    // 移除开头/结尾的斜杠
    relativePath = relativePath.replace(/^\/|\/$/g, '')
    
    try {
      // 处理 IDN 编码（在 decode 之前尝试）
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      // URL 解码
      relativePath = decodeURIComponent(relativePath)
      const filePath = path.normalize(path.join(baseDir, relativePath))
      console.log(filePath, 'filePath')
      console.log(baseDir, 'baseDir')
      // 安全校验：防止目录穿越攻击（使用 path.relative 更稳健）
      const safeBase = path.resolve(baseDir)
      const safeTarget = path.resolve(filePath)
      const rel = path.relative(safeBase, safeTarget)
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return new Response('Forbidden', { status: 403 })
      }
      
      // 获取 Range 请求头
      const rangeHeader = request.headers.get('range') || undefined;
      
      // 使用新的文件流处理方式
      return await createFileResponse(safeTarget, rangeHeader);
    } catch (error) {
      console.error('处理文件路径失败:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

// 注册协议
export function registerProtocolApp() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        corsEnabled: true,
        stream: true
      }
    },
    {
      scheme: 'rebirth',
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function handleProtocolApp() {
  // 处理 app 协议
  protocol.handle('app', async (request) => {
    console.log(request.url, 'request');
    
    let relativePath = request.url.replace('app://', '')
    console.log(relativePath, 'relativePath ');
    
    try {
      // 处理 IDN 编码
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      // URL 解码
      relativePath = decodeURIComponent(relativePath)
      
      // 在 Windows 上处理盘符
      if (process.platform === 'win32') {
        // 检查路径是否已经包含盘符（如 C:\ 或 C:/）
        const drivePattern = /^[A-Za-z]:[\\\/]/
        if (!drivePattern.test(relativePath)) {
          // 只有在没有盘符的情况下才添加
          const driveLetter = relativePath.charAt(0).toUpperCase()
          if (driveLetter && /[A-Z]/.test(driveLetter)) {
            relativePath = driveLetter + ':' + relativePath.substring(1)
          }
        }
      }
      
      // 在 Mac 上确保路径以斜杠开头
      if (process.platform === 'darwin' && !relativePath.startsWith('/')) {
        relativePath = '/' + relativePath
      }
      
      const filePath = path.normalize(relativePath)
      console.log('filePath', filePath)
      
      // 获取 Range 请求头
      const rangeHeader = request.headers.get('range') || undefined;
      
      // 使用新的文件流处理方式
      return await createFileResponse(filePath, rangeHeader);
    } catch (error) {
      console.error('处理文件路径失败:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })

  // 处理 rebirth 协议
  protocol.handle('rebirth', async (request) => {
    console.log('处理 rebirth 协议:', request.url);
    
    try {
      // 直接处理参数，不需要检查应用状态
      // 协议处理器只负责解析和传递参数，不控制窗口创建
      appStartParamsManager.handleRuntimeParams(request.url);
      
      // 返回成功响应
      return new Response('OK', { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    } catch (error) {
      console.error('处理 rebirth 协议失败:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  })
}
