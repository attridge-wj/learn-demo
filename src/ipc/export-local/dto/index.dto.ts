export interface ExportCanvasDto {
  id: string;
  exportFileMethod: 'none' | 'in' | 'all';
}

export interface CanvasExportResult {
  success: boolean;
  message?: string;
  filePath?: string;
}

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