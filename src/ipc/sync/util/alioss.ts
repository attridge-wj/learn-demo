import OSS from 'ali-oss';
import { SyncFile } from '../dto/index';
import fs from 'fs-extra';
import * as path from 'path';
import { mergeIncrementalData } from '../../../database/sync-data';

interface AliOSSConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}

export class AliOSSClient {
  private client!: OSS;
  private config: AliOSSConfig;

  constructor(config: AliOSSConfig) {
    this.config = config;
    this.initClient();
  }

  private initClient() {
    this.client = new OSS({
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      bucket: this.config.bucket
    });
  }

  // 测试连接
  public async testConnection(): Promise<boolean> {
    try {
      await this.client.list({
        'max-keys': 1
      });
      return true;
    } catch (error) {
      console.error('阿里云OSS连接测试失败:', error);
      return false;
    }
  }

  // 删除远程db文件夹下的所有文件
  public async deleteRemoteDbDirectory(remotePath: string) {
    try {
      const result = await this.client.list({
        prefix: remotePath + '/db/'
      });

      if (result.objects) {
        for (const object of result.objects) {
          await this.client.delete(object.name);
        }
      }
    } catch (error) {
      console.error('删除远程文件失败:', error);
      throw error;
    }
  }

  public async upload(localPath: string, remotePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(localPath);
      const isDBFile = path.extname(localPath).toLowerCase() === '.db';

      if (stats.isDirectory()) {
        await this.handleDirectory(localPath, remotePath);
      } else {
        await this.handleFile(localPath, remotePath, isDBFile);
      }
      return true;
    } catch (error) {
      console.error('上传失败:', error);
      return false;
    }
  }

  private async handleDirectory(localPath: string, remotePath: string) {
    const files = await fs.readdir(localPath);
    for (const file of files) {
      const localFilePath = path.join(localPath, file);
      const remoteFilePath = path.join(remotePath, file).replace(/\\/g, '/');
      await this.upload(localFilePath, remoteFilePath);
    }
  }

  private async handleFile(localPath: string, remotePath: string, forceUpdate: boolean) {
    await this.client.put(remotePath, localPath);
    console.log(`文件已上传: ${remotePath}`);
  }

  // 获取远程文件列表
  private async getRemoteFiles(remotePath: string): Promise<SyncFile[]> {
    try {
      const files: SyncFile[] = [];
      
      const listObjects = async (prefix: string) => {
        const result = await this.client.list({
          prefix: prefix
        });
        
        if (result.objects) {
          for (const object of result.objects) {
            const file: SyncFile = {
              path: object.name,
              lastModified: object.lastModified?.getTime() || 0,
              size: object.size || 0,
              isDirectory: object.name.endsWith('/')
            };
            files.push(file);
          }
        }
      };
      
      await listObjects(remotePath);
      return files;
    } catch (error) {
      console.error('获取远程文件列表失败:', error);
      return [];
    }
  }

  // 获取本地文件列表
  private getLocalFiles(localPath: string): SyncFile[] {
    const files: SyncFile[] = [];
    
    const readDir = (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);
        
        files.push({
          path: fullPath,
          lastModified: stats.mtime.getTime(),
          size: stats.size,
          isDirectory: stats.isDirectory()
        });
        
        if (stats.isDirectory()) {
          readDir(fullPath);
        }
      }
    };
    
    readDir(localPath);
    return files;
  }

  // 同步远程文件到本地
  public async syncToLocal(localPath: string, remotePath: string): Promise<boolean> {
    try {
      const remoteFiles = await this.getRemoteFiles(remotePath);
      const localFiles = this.getLocalFiles(localPath);
      const localFileMap = new Map(
        localFiles.map(file => [path.relative(localPath, file.path), file])
      );

      for (const remoteFile of remoteFiles) {
        const relativePath = path.relative(remotePath, remoteFile.path);
        const localFilePath = path.join(localPath, relativePath);
        const isDBFile = remoteFile.path.toLowerCase().includes('/db/') 
                && remoteFile.path.toLowerCase().includes('rebirth-data')
                && path.extname(remoteFile.path).toLowerCase() === '.json';
        const localFile = localFileMap.get(relativePath);

        if (isDBFile || !localFile || localFile.lastModified < remoteFile.lastModified) {
          if (remoteFile.isDirectory) {
            await fs.ensureDir(localFilePath);
          } else {
            if (isDBFile) {
              const result = await this.client.get(remoteFile.path);
              const fileContent = result.content.toString();
              const encryptedData = JSON.parse(fileContent);
              await mergeIncrementalData(encryptedData);
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.error('同步失败:', error);
      return false;
    }
  }
}

// 测试连接方法
export const testAliOSSConfig = async (config: AliOSSConfig): Promise<boolean> => {
  const client = new AliOSSClient(config);
  return await client.testConnection();
}
