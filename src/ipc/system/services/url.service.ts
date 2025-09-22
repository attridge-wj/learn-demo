import { shell } from 'electron';
import { resolveProtocolPath } from '../util/protocol.util';

export async function openUrl(url: string): Promise<boolean> {
  console.log(url, 'url');
  
  try {
    // 检查是否为自定义协议
    if (url.startsWith('user-data://') || url.startsWith('app://')) {
      // 解析自定义协议路径
      const resolvedPath = resolveProtocolPath(url);
      if (!resolvedPath) {
        console.error('无效的协议路径:', url);
        return false;
      }
      console.log(resolvedPath, 'resolvedPath');
      
      // 使用系统关联应用打开文件
      const error = await shell.openPath(resolvedPath);
      if (error) {
        console.error('打开文件失败:', error);
        return false;
      }
      return true;
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      // 处理标准 URL（http/https 等）
      await shell.openExternal(url);
      return true;
    } else {
      // 处理普通文件路径
      const error = await shell.openPath(url);
      if (error) {
        console.error('打开文件失败:', error);
        return false;
      }
      return true;
    }
  } catch (error) {
    console.error('打开URL失败:', error);
    return false;
  }
} 