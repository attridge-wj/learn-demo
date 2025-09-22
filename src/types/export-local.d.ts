// 导出本地相关类型定义

export interface ExportCanvasDto {
  id: string;
  exportFileMethod: 'none' | 'in' | 'all';
}

export interface CanvasExportResult {
  success: boolean;
  message?: string;
  filePath?: string;
}

// 导入画布副本的接口定义
export interface ImportCanvasDto {
  importMode: 'skip' | 'overwrite';
}

export interface CanvasImportResult {
  success: boolean;
  message?: string;
  data?: {
    baseCardId: string;
    importedCount: number;
    skippedCount: number;
    overwrittenCount: number;
  };
}

// 扩展 Window 接口以包含 exportLocalApi 和 systemApi
declare global {
  interface Window {
    exportLocalApi: {
      // 导出画布到本地副本
      exportCanvas: (exportDto: ExportCanvasDto) => Promise<CanvasExportResult>;
      // 导入画布副本
      importCanvas: (importDto: ImportCanvasDto) => Promise<CanvasImportResult>;
    };
    systemApi: {
      // 选择保存文件
      selectSaveFile: (options?: {
        title?: string;
        buttonLabel?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{ success: boolean; data?: string; message?: string }>;
    };
  }
}

export {};
