import fse from 'fs-extra';
import path from 'path';
import { clipboard } from 'electron';
import { resolveProtocolPath } from '../util/protocol.util';

export async function getDirectoryStructure(
  dirPath: string,
  options: {
    indentSize?: number;
    indentChar?: string;
    maxDepth?: number;
    includeHidden?: boolean;
    includeFiles?: boolean;
    includeDirectories?: boolean;
    excludePatterns?: string[];
  } = {}
) {
  try {
    const {
      indentSize = 2,
      indentChar = '-',
      maxDepth = 6,
      includeHidden = false,
      includeFiles = true,
      includeDirectories = true,
      excludePatterns = []
    } = options;
    let resolvedPath = dirPath;
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
      const normalizedPath = path.normalize(dirPath);
      resolvedPath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.join(process.cwd(), normalizedPath);
    }
    const exists = await fse.pathExists(resolvedPath);
    if (!exists) {
      return {
        success: false,
        error: `路径不存在: ${resolvedPath}`
      };
    }
    const stats = await fse.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: `指定路径不是目录: ${resolvedPath}`
      };
    }
    const getDirectoryStructureRecursive = async (
      currentPath: string,
      currentDepth: number = 0,
      parentIndent: string = ''
    ): Promise<string[]> => {
      if (currentDepth > maxDepth) {
        return [];
      }
      const lines: string[] = [];
      try {
        const items = await fse.readdir(currentPath);
        const filteredItems = items.filter(item => {
          if (!includeHidden && item.startsWith('.')) {
            return false;
          }
          for (const pattern of excludePatterns) {
            if (item.match(new RegExp(pattern))) {
              return false;
            }
          }
          return true;
        });
        const directories: string[] = [];
        const files: string[] = [];
        for (const item of filteredItems) {
          const itemPath = path.join(currentPath, item);
          try {
            const itemStats = await fse.stat(itemPath);
            if (itemStats.isDirectory()) {
              directories.push(item);
            } else if (itemStats.isFile()) {
              files.push(item);
            }
          } catch (error) {
            continue;
          }
        }
        directories.sort();
        files.sort();
        if (includeDirectories) {
          for (const dir of directories) {
            const indent = parentIndent + indentChar.repeat(indentSize);
            lines.push(`${indent}${dir}`);
            const subDirPath = path.join(currentPath, dir);
            const subLines = await getDirectoryStructureRecursive(
              subDirPath,
              currentDepth + 1,
              indent
            );
            lines.push(...subLines);
          }
        }
        if (includeFiles) {
          for (const file of files) {
            const indent = parentIndent + indentChar.repeat(indentSize);
            lines.push(`${indent}${file}`);
          }
        }
      } catch (error: any) {
        const errorLine = parentIndent + indentChar.repeat(indentSize) + `[错误: ${error.message}]`;
        lines.push(errorLine);
      }
      return lines;
    };
    const structureLines = await getDirectoryStructureRecursive(resolvedPath);
    const rootName = path.basename(resolvedPath);
    const structure = [rootName, ...structureLines].join('\n');
    clipboard.writeText(structure);
    return {
      success: true,
      data: structure,
      path: resolvedPath,
      totalLines: structureLines.length + 1,
      options: {
        indentSize,
        indentChar,
        maxDepth,
        includeHidden,
        includeFiles,
        includeDirectories,
        excludePatterns
      }
    };
  } catch (error: any) {
    console.error('获取目录结构失败:', error);
    return {
      success: false,
      error: `系统错误: ${error.message}`
    };
  }
} 