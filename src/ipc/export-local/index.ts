import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { exportCanvas } from './service/canvas-export.service'
import { importCanvas } from './service/canvas-import.service'
import type { ExportCanvasDto, ImportCanvasDto } from './dto/index.dto'

export function setupExportLocalIPC(): void {
  // 导出画布到本地副本
  ipcMain.handle('export-local:canvas', async (_event: IpcMainInvokeEvent, exportDto: ExportCanvasDto) => {
    try {
      console.log('开始导出画布:', exportDto)
      const result = await exportCanvas(exportDto)
      console.log('导出画布结果:', result)
      return result
    } catch (error) {
      console.error('导出画布失败:', error)
      throw error
    }
  })

  // 导入画布副本
  ipcMain.handle('export-local:import', async (_event: IpcMainInvokeEvent, importDto: ImportCanvasDto) => {
    try {
      console.log('开始导入画布:', importDto)
      const result = await importCanvas(importDto)
      console.log('导入画布结果:', result)
      return result
    } catch (error) {
      console.error('导入画布失败:', error)
      throw error
    }
  })
}
