import fse from 'fs-extra';
import path from 'path';
import { shell } from 'electron';
import { resolveProtocolPath } from '../util/protocol.util';

export async function revealInExplorer(dirPath: string) {
  try {
    let resolvedPath = dirPath;
    // 检查是否为自定义协议
    if (dirPath.startsWith('user-data://') || dirPath.startsWith('app://')) {
      const resolved = resolveProtocolPath(dirPath);
      if (!resolved) {
        return {
          success: false,
          error: `无效的协议路径: ${dirPath}`
        };
      }
      resolvedPath = resolved;
    } else {
      // 处理普通路径
      const normalizedPath = path.normalize(dirPath);
      resolvedPath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.join(process.cwd(), normalizedPath);
    }
    // 检查路径是否存在
    const exists = await fse.pathExists(resolvedPath);
    if (!exists) {
      return {
        success: false,
        error: `路径不存在: ${resolvedPath}`
      };
    }
    // 获取路径的统计信息
    const stats = await fse.stat(resolvedPath);
    // 如果是文件，获取其所在目录
    const targetPath = stats.isFile() ? path.dirname(resolvedPath) : resolvedPath;
    // 根据平台使用不同的命令打开资源管理器
    let command: string;
    let args: string[];
    switch (process.platform) {
      case 'win32':
        command = 'explorer';
        args = ['/select,', resolvedPath];
        break;
      case 'darwin':
        command = 'open';
        args = ['-R', resolvedPath];
        break;
      case 'linux':
        const fileManagers = [
          { cmd: 'xdg-open', args: [targetPath] },
          { cmd: 'nautilus', args: [targetPath] },
          { cmd: 'dolphin', args: [targetPath] },
          { cmd: 'thunar', args: [targetPath] },
          { cmd: 'pcmanfm', args: [targetPath] },
          { cmd: 'caja', args: [targetPath] }
        ];
        for (const fm of fileManagers) {
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            await execAsync(`which ${fm.cmd}`);
            await execAsync(`${fm.cmd} ${fm.args.join(' ')}`);
            return {
              success: true,
              message: `使用 ${fm.cmd} 打开目录成功`,
              path: resolvedPath
            };
          } catch (error) {
            continue;
          }
        }
        return {
          success: false,
          error: '未找到可用的文件管理器'
        };
      default:
        return {
          success: false,
          error: `不支持的操作系统: ${process.platform}`
        };
    }
    // 对于 Windows 和 macOS，使用 shell.openPath
    if (process.platform === 'win32' || process.platform === 'darwin') {
      const error = await shell.openPath(targetPath);
      if (error) {
        return {
          success: false,
          error: `打开目录失败: ${error}`
        };
      }
      return {
        success: true,
        message: '在资源管理器中打开目录成功',
        path: resolvedPath,
        isFile: stats.isFile()
      };
    }
  } catch (error: any) {
    console.error('在资源管理器中打开目录失败:', error);
    return {
      success: false,
      error: `系统错误: ${error.message}`
    };
  }
} 