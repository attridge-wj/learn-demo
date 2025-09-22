import COS from 'cos-nodejs-sdk-v5';
import { SyncFile } from '../dto/index';
import fs from 'fs-extra';
import * as path from 'path';
import { mergeIncrementalData } from '../../../database/sync-data';

interface TencentCOSConfig {
  SecretId: string;
  SecretKey: string;
  Bucket: string;
  Region: string;
}

export class TencentCOSClient {
  private client!: COS;
  private config: TencentCOSConfig;

  constructor(config: TencentCOSConfig) {
    this.config = config;
    this.initClient();
  }

  private initClient() {
    this.client = new COS({
      SecretId: this.config.SecretId,
      SecretKey: this.config.SecretKey
    });
  }

  // 测试连接
  public async testConnection(): Promise<boolean> {
    try {
      await new Promise((resolve, reject) => {
        this.client.getBucket({
          Bucket: this.config.Bucket,
          Region: this.config.Region,
          MaxKeys: 1
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      return true;
    } catch (error) {
      console.error('腾讯云COS连接测试失败:', error);
      return false;
    }
  }

  // 删除远程db文件夹下的所有文件
  public async deleteRemoteDbDirectory(remotePath: string) {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        this.client.getBucket({
          Bucket: this.config.Bucket,
          Region: this.config.Region,
          Prefix: remotePath + '/db/'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      if (result.Contents) {
        for (const object of result.Contents) {
          await new Promise((resolve, reject) => {
            this.client.deleteObject({
              Bucket: this.config.Bucket,
              Region: this.config.Region,
              Key: object.Key
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
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
    await new Promise((resolve, reject) => {
      this.client.putObject({
        Bucket: this.config.Bucket,
        Region: this.config.Region,
        Key: remotePath,
        Body: fs.createReadStream(localPath)
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    console.log(`文件已上传: ${remotePath}`);
  }

  // 获取远程文件列表
  private async getRemoteFiles(remotePath: string): Promise<SyncFile[]> {
    try {
      const files: SyncFile[] = [];
      
      const listObjects = async (prefix: string) => {
        const result = await new Promise<any>((resolve, reject) => {
          this.client.getBucket({
            Bucket: this.config.Bucket,
            Region: this.config.Region,
            Prefix: prefix
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        if (result.Contents) {
          for (const object of result.Contents) {
            const file: SyncFile = {
              path: object.Key,
              lastModified: new Date(object.LastModified).getTime(),
              size: object.Size,
              isDirectory: object.Key.endsWith('/')
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
              const result = await new Promise<any>((resolve, reject) => {
                this.client.getObject({
                  Bucket: this.config.Bucket,
                  Region: this.config.Region,
                  Key: remoteFile.path
                }, (err, data) => {
                  if (err) reject(err);
                  else resolve(data);
                });
              });
              
              const fileContent = result.Body.toString();
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
export const testTencentCOSConfig = async (config: TencentCOSConfig): Promise<boolean> => {
  const client = new TencentCOSClient(config);
  return await client.testConnection();
}
