import fse from 'fs-extra';
import path from 'path';
import { resolveProtocolPath } from '../util/protocol.util';

// 获取user-data://或app://开头的图片地址对应的base64数据
export async function getImageBase64(imageUrl: string): Promise<string | null> {
  try {
    // 检查是否为支持的协议
    if (!imageUrl.startsWith('user-data://') && !imageUrl.startsWith('app://')) {
      return null;
    }

    // 解析协议路径
    const filePath = resolveProtocolPath(imageUrl);
    if (!filePath) {
      return null;
    }

    // 检查文件是否存在
    const exists = await fse.pathExists(filePath);
    if (!exists) {
      return null;
    }

    // 检查文件扩展名是否为图片格式
    const ext = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    if (!imageExtensions.includes(ext)) {
      return null;
    }

    // 读取文件并转换为base64
    const fileBuffer = await fse.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    
    // 根据文件扩展名确定MIME类型
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return dataUrl;

  } catch (error: any) {
    console.error('获取图片base64失败:', error);
    return null;
  }
} 