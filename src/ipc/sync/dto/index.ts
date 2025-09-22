export interface WebDavDto {
  url: string;
  username: string;
  password: string;
  basePath?: string;
}

export interface S3Dto {
  url?: string,
  region?: string,
  bucket?: string,
  accessKeyId?: string;
  secretAccessKey?: string;
  basePath?: string,
  provider?: string
}

export interface SyncFile {
  path: string;
  lastModified: number;
  size: number;
  isDirectory: boolean;
}
