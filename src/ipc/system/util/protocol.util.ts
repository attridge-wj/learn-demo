import store from '../../../utils/store';
import path from 'path';
import { getDefaultStoragePath } from '../../../utils/file';
import { toUnicode } from 'idna-uts46';

// 通用的协议路径解析函数
export function resolveProtocolPath(protocolUrl: string): string | null {
  try {
    let relativePath = '';
    let baseDir = '';

    if (protocolUrl.startsWith('user-data://')) {
      // 处理 user-data 协议
      relativePath = protocolUrl.replace('user-data://files/', '');
      relativePath = relativePath.replace('user-data://', '');
      const storagePath = store.get('storagePath') || getDefaultStoragePath();
      baseDir = path.join(storagePath, 'files');
    } else if (protocolUrl.startsWith('app://')) {
      // 处理 app 协议
      relativePath = protocolUrl.replace('app://', '');
      baseDir = ''; // app协议使用绝对路径
    } else {
      return null; // 不支持的协议
    }

    // 移除开头/结尾的斜杠
    relativePath = relativePath.replace(/^\/|\/$/g, '');
    
    // 处理 IDN 编码
    if (relativePath.includes('xn--')) {
      relativePath = toUnicode(relativePath);
    }
    
    // URL 解码
    relativePath = decodeURIComponent(relativePath);

    let filePath: string;
    
    if (baseDir) {
      // user-data 协议：拼接基础目录
      filePath = path.normalize(path.join(baseDir, relativePath));
      
      // 安全校验：防止目录穿越攻击
      if (!filePath.startsWith(baseDir)) {
        return null;
      }
    } else {
      // app 协议：处理绝对路径
      if (process.platform === 'win32') {
        // 检查路径是否已经包含盘符（如 C:\ 或 C:/）
        const drivePattern = /^[A-Za-z]:[\\\/]/
        if (!drivePattern.test(relativePath)) {
          // 只有在没有盘符的情况下才添加
          const driveLetter = relativePath.charAt(0).toUpperCase();
          if (driveLetter && /[A-Z]/.test(driveLetter)) {
            relativePath = driveLetter + ':' + relativePath.substring(1);
          }
        }
      }
      
      // 在 Mac 上确保路径以斜杠开头
      if (process.platform === 'darwin' && !relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }
      
      filePath = path.normalize(relativePath);
    }

    return filePath;
  } catch (error) {
    console.error('解析协议路径失败:', error);
    return null;
  }
} 