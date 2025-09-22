// 自定义 promisify 实现
function promisify<T>(fn: Function): (...args: any[]) => Promise<T> {
  return (...args: any[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      fn(...args, (err: Error | null, result: T) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}

import store from '../utils/store';
import { AppDataSource } from './connection';
import { MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { getDefaultStoragePath } from '../utils/file';
import { getMainWindow } from '../window-manage';
import { isISOFormat, toISOString } from '../common/util/time.util';

const gzip = promisify<Buffer>(zlib.gzip);
const gunzip = promisify<Buffer>(zlib.gunzip);

interface TableData {
  [key: string]: any[];
}

interface SyncConflict {
  table: string;
  localData: any;
  remoteData: any;
  timestamp: string;
}

interface EncryptedData {
  iv: string;
  data: string;
  compressed: boolean;
}

const conflicts: SyncConflict[] = [];
const encryptionKey = Buffer.from(
  'rebirth-9x8k7j6h5g4f3d2s1a0z9y8x7w6v',
  'utf-8'
).slice(0, 32); // 32字节密钥

// 加密并压缩数据
export async function encrypt(data: string): Promise<EncryptedData> {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);

  // 先压缩数据
  const compressed = await gzip(Buffer.from(data));

  // 再加密压缩后的数据
  let encrypted = cipher.update(compressed, undefined, 'base64');
  encrypted += cipher.final('base64');

  return {
    iv: iv.toString('base64'),
    data: encrypted,
    compressed: true
  };
}

// 解密并解压缩数据
export async function decrypt(encryptedData: EncryptedData): Promise<string> {
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey),
    Buffer.from(encryptedData.iv, 'base64')
  );

  // 先解密
  let decrypted = decipher.update(encryptedData.data, 'base64');
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  // 如果数据是压缩的,则解压缩
  if (encryptedData.compressed) {
    const decompressed = await gunzip(decrypted);
    return decompressed.toString();
  }

  return decrypted.toString();
}

// 获取增量数据
export async function getIncrementalData(sinceTimestamp: string | null, provider?: string): Promise<{
  data: TableData;
  backupFileName: string;
  isFullBackup: boolean;
  hasData: boolean;
}> {
  const result: TableData = {};
  const entities = AppDataSource.entityMetadatas;

  // 判断是否是全量备份
  const isFullBackup = !sinceTimestamp;
  let totalRecords = 0;

  console.log(`开始获取${isFullBackup ? '全量' : '增量'}数据，时间戀: ${sinceTimestamp}`);

  for (const entity of entities) {
    // 排除FileIndexEntity，不需要同步
    if (entity.name === 'FileIndexEntity') {
      console.log(`跳过实体 ${entity.name}（不需要同步）`);
      continue;
    }
    
    const repository = AppDataSource.getRepository(entity.target);
    let rows;

    if (isFullBackup) {
      rows = await repository.find();
    } else {
      // 修复时间格式问题：确保sinceTimestamp是ISO格式
      let compareTimestamp = sinceTimestamp;
      if (sinceTimestamp) {
       
        
        if (!isISOFormat(sinceTimestamp)) {
          // 如果不是ISO格式，转换为ISO格式
          compareTimestamp = toISOString(sinceTimestamp);
          console.log(`时间格式转换: ${sinceTimestamp} -> ${compareTimestamp}`);
        }
      }
      console.log(compareTimestamp, 'compareTimestamp----------------');
      rows = await repository
        .createQueryBuilder()
        .where("update_time > :timestamp", {
          timestamp: compareTimestamp
        })
        .getMany();
    }

    if (rows.length > 0) {
      result[entity.name] = rows;
      totalRecords += rows.length;
      console.log(`实体 ${entity.name}: ${rows.length} 条记录`);
    }
  }

  console.log(`数据收集完成，总计 ${totalRecords} 条记录，涉及 ${Object.keys(result).length} 个实体`);

  // 检查是否有数据需要同步
  const hasData = totalRecords > 0;

  if (!hasData && !isFullBackup) {
    console.log('没有数据需要同步，跳过备份文件生成');
    return {
      data: result,
      backupFileName: '',
      isFullBackup,
      hasData: false
    };
  }

  const targetPATH = store.get('storagePath') || getDefaultStoragePath();
  const backupPath = path.join(targetPATH, 'db');

  try {
    // 确保db目录存在
    await fs.ensureDir(backupPath);

    // 如果指定了provider，创建对应的子文件夹
    let providerBackupPath = backupPath;
    if (provider) {
      providerBackupPath = path.join(backupPath, provider);
      await fs.ensureDir(providerBackupPath);
    }

    // 使用本地时间，确保与电脑显示时间一致
    const now = new Date();
    const localTimeString = now.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[/:]/g, '-').replace(/\s/g, '_');

    const backupFileName = `rebirth-data-${uuidv4()}-${localTimeString}.json`;
    const backupFile = path.join(providerBackupPath, backupFileName);

    // 加密并压缩数据
    const jsonData = JSON.stringify(result);
    const encryptedData = await encrypt(jsonData);

    // 写入加密压缩后的数据
    await fs.writeJson(backupFile, encryptedData, { spaces: 2 });

    // 如果指定了provider，则清理旧备份文件（最多保留20份）
    if (provider) {
      await cleanupOldBackups(providerBackupPath, provider);
    }

    return {
      data: result,
      backupFileName,
      isFullBackup,
      hasData: true
    };
  } catch (err) {
    console.error('备份失败:', err);
    throw err;
  }
}

// 清理旧备份文件，最多保留20份
async function cleanupOldBackups(backupPath: string, provider: string): Promise<void> {
  try {
    // 获取所有备份文件
    const files = await fs.readdir(backupPath);
    const backupFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupPath, file);
        return { name: file, path: filePath };
      });

    // 如果备份文件数量超过20份，删除最旧的
    if (backupFiles.length > 20) {
      // 按文件名中的时间戳排序（文件名包含本地时间）
      backupFiles.sort((a, b) => {
        const timeA = a.name.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);
        const timeB = b.name.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);

        if (timeA && timeB) {
          // 将本地时间字符串转换为Date对象进行比较
          const dateA = new Date(timeA[0].replace(/_/g, ' ').replace(/-/g, ':'));
          const dateB = new Date(timeB[0].replace(/_/g, ' ').replace(/-/g, ':'));

          return dateA.getTime() - dateB.getTime();
        }
        return 0;
      });

      // 删除最旧的文件，保留最新的20份
      const filesToDelete = backupFiles.slice(0, backupFiles.length - 20);

      for (const file of filesToDelete) {
        await fs.remove(file.path);
        console.log(`删除旧备份文件: ${file.name}`);
      }

      console.log(`清理完成，删除了 ${filesToDelete.length} 个旧备份文件，保留了最新的 20 份备份`);
    }
  } catch (error) {
    console.error('清理旧备份文件失败:', error);
  }
}

// 批量处理数据的辅助函数，优化UI响应性
async function processBatchWithUIOptimization<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>,
  entityName: string,
  operation: string
): Promise<void> {
  console.log(`开始${operation} ${items.length} 条记录到 ${entityName}`);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);

    // 每批操作后让出主线程控制权，避免UI卡顿
    if (i + batchSize < items.length) {
      await new Promise(resolve => setImmediate(resolve));

      // 显示进度并通知渲染进程
      const progress = Math.round(((i + batchSize) / items.length) * 100);
      console.log(`${entityName} ${operation}进度: ${progress}% (${i + batchSize}/${items.length})`);

      // 通知渲染进程更新进度条
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:progress-update', {
          entityName,
          operation,
          progress,
          processed: i + batchSize,
          total: items.length
        });
      }
    }
  }

  console.log(`${entityName} ${operation}完成`);
}

// 合并增量数据
export async function mergeIncrementalData(backupFiles: Array<{
  fileName: string;
  encryptedData: EncryptedData;
  timestamp: string;
}>): Promise<{
  success: boolean;
  conflicts: SyncConflict[];
  processedFiles: string[];
}> {
  conflicts.length = 0;
  const processedFiles: string[] = [];

  try {
    // 按时间戳排序，从早到晚处理
    const sortedFiles = backupFiles.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 在事务外设置SQLite优化参数
    try {
      await AppDataSource.query('PRAGMA synchronous = NORMAL');
      await AppDataSource.query('PRAGMA journal_mode = WAL');
      await AppDataSource.query('PRAGMA temp_store = MEMORY');
      console.log('SQLite性能优化参数设置完成');
    } catch (error) {
      console.warn('设置SQLite优化参数失败，继续使用默认设置:', error);
    }

    // 启用事务进行批量操作
    await AppDataSource.transaction(async (manager) => {

      for (const backupFile of sortedFiles) {
        console.log(`开始处理备份文件: ${backupFile.fileName}`);
        const startTime = Date.now();

        try {
          // 解密并解压缩数据
          const decryptedData = await decrypt(backupFile.encryptedData);
          const data: TableData = JSON.parse(decryptedData);
          console.log(`文件解密完成，包含 ${Object.keys(data).length} 个实体`);


          // 定义实体写入顺序，确保父表优先于子表
          const entityOrder = [
            'SysCardBaseEntity',  // 主表，必须最先写入
            'SysCardRichTextEntity',
            'SysCardDrawboardEntity',
            'SysCardMindMapEntity',
            'SysCardFileEntity',
            'SysCardMultiTableEntity',
            'SysCardMermaidEntity',
            'SysCardMarkEntity'
          ];

          // 按照指定顺序处理实体（批量优化版本）
          for (const entityName of entityOrder) {
            if (data[entityName]) {
              const rows = data[entityName];
              const entity = AppDataSource.entityMetadatas.find(e => e.name === entityName);
              if (!entity) continue;

              const repository = manager.getRepository(entity.target);
              console.log(`处理实体: ${entityName}, 记录数: ${rows.length}`);

              try {
                // 批量查询现有记录
                const ids = rows.map(row => row.id);
                const existingRecords = await repository.findByIds(ids);
                const existingMap = new Map(existingRecords.map(record => [record.id, record]));

                // 分类待处理的记录
                const toInsert: any[] = [];
                const toUpdate: any[] = [];
                let processedCount = 0;

                for (const row of rows) {
                  const existingRow = existingMap.get(row.id);

                  if (!existingRow) {
                    toInsert.push(row);
                    processedCount++;
                  } else {
                    const rowTime = new Date(row.updateTime).getTime();
                    const existingTime = new Date(existingRow.updateTime).getTime();

                    if (rowTime > existingTime) {
                      toUpdate.push(row);
                      processedCount++;
                    } else if (rowTime < existingTime) {
                      conflicts.push({
                        table: entityName,
                        localData: existingRow,
                        remoteData: row,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }
                }

                // 批量插入新记录（UI优化版本）
                if (toInsert.length > 0) {
                  await processBatchWithUIOptimization(
                    toInsert,
                    50, // 减小批次大小，提高UI响应性
                    async (batch) => { await repository.insert(batch); },
                    entityName,
                    '插入'
                  );
                }

                // 批量更新记录（UI优化版本）
                if (toUpdate.length > 0) {
                  await processBatchWithUIOptimization(
                    toUpdate,
                    50, // 减小批次大小，提高UI响应性
                    async (batch) => { await repository.save(batch); },
                    entityName,
                    '更新'
                  );
                }

                console.log(`${entityName} 处理完成: 插入 ${toInsert.length} 条, 更新 ${toUpdate.length} 条, 冲突 ${conflicts.filter(c => c.table === entityName).length} 条`);

              } catch (error) {
                console.error(`批量处理实体失败: ${entityName}`, error);
                throw error; // 重要：如果批量操作失败，需要抛出错误以回滚事务
              }
            }
          }

          // 处理其他未在顺序列表中的实体（批量优化版本）
          for (const [entityName, rows] of Object.entries(data)) {
            if (!entityOrder.includes(entityName)) {
              const entity = AppDataSource.entityMetadatas.find(e => e.name === entityName);
              if (!entity) continue;

              const repository = manager.getRepository(entity.target);
              console.log(`处理其他实体: ${entityName}, 记录数: ${rows.length}`);

              try {
                // 批量查询现有记录
                const ids = rows.map(row => row.id);
                const existingRecords = await repository.findByIds(ids);
                const existingMap = new Map(existingRecords.map(record => [record.id, record]));

                // 分类待处理的记录
                const toInsert: any[] = [];
                const toUpdate: any[] = [];

                for (const row of rows) {
                  const existingRow = existingMap.get(row.id);

                  if (!existingRow) {
                    toInsert.push(row);
                  } else {
                    const rowTime = new Date(row.updateTime).getTime();
                    const existingTime = new Date(existingRow.updateTime).getTime();

                    if (rowTime > existingTime) {
                      toUpdate.push(row);
                    } else if (rowTime < existingTime) {
                      conflicts.push({
                        table: entityName,
                        localData: existingRow,
                        remoteData: row,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }
                }

                // 批量插入新记录（UI优化版本）
                if (toInsert.length > 0) {
                  await processBatchWithUIOptimization(
                    toInsert,
                    50, // 减小批次大小，提高UI响应性
                    async (batch) => { await repository.insert(batch); },
                    entityName,
                    '插入'
                  );
                }

                // 批量更新记录（UI优化版本）
                if (toUpdate.length > 0) {
                  await processBatchWithUIOptimization(
                    toUpdate,
                    50, // 减小批次大小，提高UI响应性
                    async (batch) => { await repository.save(batch); },
                    entityName,
                    '更新'
                  );
                }

                console.log(`${entityName} 处理完成: 插入 ${toInsert.length} 条, 更新 ${toUpdate.length} 条, 冲突 ${conflicts.filter(c => c.table === entityName).length} 条`);

              } catch (error) {
                console.error(`批量处理实体失败: ${entityName}`, error);
                throw error;
              }
            }
          }

          processedFiles.push(backupFile.fileName);

          const endTime = Date.now();
          const processingTime = endTime - startTime;
          console.log(`备份文件 ${backupFile.fileName} 处理完成，耗时: ${processingTime}ms`);

        } catch (error) {
          console.error(`处理备份文件 ${backupFile.fileName} 失败:`, error);
          // 继续处理其他文件，不中断整个流程
        }
      }
    });

    // 在事务外恢复SQLite默认设置
    try {
      await AppDataSource.query('PRAGMA synchronous = FULL');
      console.log('SQLite设置已恢复为默认值');
    } catch (error) {
      console.warn('恢复SQLite默认设置失败:', error);
    }

    return {
      success: true,
      conflicts: conflicts,
      processedFiles: processedFiles
    };
  } catch (error) {
    console.error('合并数据失败:', error);
    return {
      success: false,
      conflicts: conflicts,
      processedFiles: processedFiles
    };
  }
}

// 处理冲突数据
export async function resolveConflict(conflict: SyncConflict, useLocal: boolean): Promise<boolean> {
  try {
    const entity = AppDataSource.entityMetadatas.find(e => e.name === conflict.table);
    if (!entity) return false;

    const repository = AppDataSource.getRepository(entity.target);

    if (useLocal) {
      return true;
    } else {
      await repository.save(conflict.remoteData);
      return true;
    }
  } catch (error) {
    console.error('处理冲突失败:', error);
    return false;
  }
}