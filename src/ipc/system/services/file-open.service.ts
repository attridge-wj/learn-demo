import fse from 'fs-extra';
import path from 'path';
import { shell } from 'electron';
import { resolveProtocolPath } from '../util/protocol.util';
import { dialog } from 'electron'

export async function openFileWithSystemApp(filePathParam: string): Promise<string> {
  let filePath = filePathParam;
  console.log('filePathParam', filePathParam);
  try {
    // 检查是否为自定义协议
    if (filePathParam.startsWith('user-data://') || filePathParam.startsWith('app://')) {
      const resolvedPath = resolveProtocolPath(filePathParam);
      if (!resolvedPath) {
        return `无效的协议路径: ${filePathParam}`;
      }
      filePath = resolvedPath;
    } else {
      // 处理普通路径
      // 路径标准化处理（自动转换平台分隔符）
      const normalizedPath = path.normalize(filePath);
      // 解析为绝对路径（兼容相对路径）
      filePath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.join(process.cwd(), normalizedPath);
    }
    // 使用fs-extra增强版文件检查
    const exists = await fse.pathExists(filePath);
    if (!exists) {
      console.log('文件不存在: ', filePath);
      return `文件不存在: ${filePath}`;
    }
    console.log('filePath', filePath);
    
    // 在macOS上处理路径问题
    if (process.platform === 'darwin' && (filePathParam.startsWith('user-data://') || filePathParam.startsWith('app://'))) {
      // 确保路径是绝对路径且格式正确
      if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(filePath);
      }
    }
    
    // 调用系统关联应用打开
    const error = await shell.openPath(filePath);
    return error || '';
  } catch (err: any) {
    console.log('err', err);
    // 捕获fs-extra和shell的异常
    return `系统错误: ${err.message}`;
  }
}

// 选择文件夹弹框
export async function selectFolder(): Promise<{ success: boolean; data?: string; message?: string }> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择文件夹',
      buttonLabel: '选择'
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return {
        success: true,
        data: result.filePaths[0]
      }
    } else {
      return {
        success: false,
        message: '用户取消了选择'
      }
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '选择文件夹失败'
    }
  }
}

// 选择文件弹框
export async function selectFile(options?: {
  title?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelections?: boolean;
}): Promise<{ success: boolean; data?: string | string[]; message?: string }> {
  try {
    const result = await dialog.showOpenDialog({
      properties: options?.multiSelections ? ['openFile', 'multiSelections'] : ['openFile'],
      title: options?.title || '选择文件',
      buttonLabel: options?.buttonLabel || '选择',
      filters: options?.filters || [
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return {
        success: true,
        data: options?.multiSelections ? result.filePaths : result.filePaths[0]
      }
    } else {
      return {
        success: false,
        message: '用户取消了选择'
      }
    }
  } catch (error) {
    console.error('选择文件失败:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '选择文件失败'
    }
  }
}

// 保存文件弹框
export async function selectSaveFile(options?: {
  title?: string;
  buttonLabel?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<{ success: boolean; data?: string; message?: string }> {
  try {
    const result = await dialog.showSaveDialog({
      title: options?.title || '保存文件',
      buttonLabel: options?.buttonLabel || '保存',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'ZIP文件', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      return {
        success: true,
        data: result.filePath
      }
    } else {
      return {
        success: false,
        message: '用户取消了保存'
      }
    }
  } catch (error) {
    console.error('保存文件失败:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '保存文件失败'
    }
  }
} 