import { ipcRenderer, contextBridge } from 'electron';

// 创建带 spaceId 的 IPC 调用包装器
const createInvoke = (channel: string) => {
  return async (...args: any[]) => {
    const spaceInfo = await ipcRenderer.invoke('space:getSpaceInfo')
    // 如果第一个参数是对象但不是数组,则添加spaceId
    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      return ipcRenderer.invoke(channel, { spaceId: spaceInfo.spaceId, ...args[0] })
    }
    // 否则直接传入原始参数
    return ipcRenderer.invoke(channel, ...args)
  }
}

// 创建带 spaceId 的 IPC 调用包装器（用于多参数的情况）
const createInvokeWithId = (channel: string) => {
  return async (id: string, ...args: any[]) => {
    const spaceInfo = await ipcRenderer.invoke('space:getSpaceInfo')
    // 如果第二个参数是对象但不是数组,则添加spaceId
    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      let obj = args[0]
      obj.spaceId = spaceInfo.spaceId
      return ipcRenderer.invoke(channel, id, obj)
    }
    // 否则直接传入原始参数
    return ipcRenderer.invoke(channel, id, ...args)
  }
}

contextBridge.exposeInMainWorld('userApi', {
  queryAll: createInvoke('user:getAll'),
  create: createInvoke('user:create'),
  update: createInvokeWithId('user:update'),
  delete: createInvoke('user:delete'),
});

contextBridge.exposeInMainWorld('cardApi', {
  queryAll: createInvoke('card:getAll'),
  findByDate: createInvoke('card:findByDate'),
  findAllDate: createInvoke('card:findAllDate'),
  getOne: createInvoke('card:getOne'),
  batchCreate: createInvoke('card:batchCreate'),
  batchDelete: createInvoke('card:batchDelete'),
  findByIds: createInvoke('card:findByIds'),
  batchGet: createInvoke('card:batchGet'),
  batchUpdate: createInvoke('card:batchUpdate'),
  findPage: createInvoke('card:findPage'),
  statistics: createInvoke('card:statistics'),
  getAttachmentCount: createInvoke('card:getAttachmentCount'),
  findRelateCards: createInvoke('card:findRelateCards'),
  create: createInvoke('card:create'),
  update: createInvokeWithId('card:update'),
  delete: createInvokeWithId('card:delete'),
  findRecyclePage: createInvoke('card:findRecyclePage'),
  restore: createInvokeWithId('card:restore'),
  clearRecycle: createInvoke('card:clearRecycle'),
  getCardSetTree: createInvoke('card:getCardSetTree'),
  getCardSetTreeByBoxIds: createInvoke('card:getCardSetTreeByBoxIds'),
  updateBoxId: createInvoke('card:updateBoxId'),
  findByYearMonth: createInvoke('card:findByYearMonth'),
  batchGetMindMapDetails: createInvoke('card:batchGetMindMapDetails'),
  
  // 卡片关联关系相关API
  // 创建和批量创建
  createRelation: createInvoke('card:createRelation'),
  batchCreateRelations: createInvoke('card:batchCreateRelations'),
  
  // 查询相关
  getSubIdsByParentId: createInvoke('card:getSubIdsByParentId'),
  getParentIdsBySubId: createInvoke('card:getParentIdsBySubId'),
  
  // 删除相关
  deleteRelation: createInvoke('card:deleteRelation'),
  batchDeleteRelations: createInvoke('card:batchDeleteRelations'),
})

contextBridge.exposeInMainWorld('tagApi', {
  queryAll: createInvoke('tag:getAll'),
  queryById: createInvoke('tag:getOne'),
  queryByIds: createInvoke('tag:getByIds'),
  create: createInvoke('tag:create'),
  update: createInvokeWithId('tag:update'),
  delete: createInvoke('tag:delete'),
  setTop: createInvoke('tag:setTop'),
  cancelTop: createInvoke('tag:cancelTop'),
  getTree: createInvoke('tag:getTree'),
  getSubTree: createInvoke('tag:getSubTree'),
  getPath: createInvoke('tag:getPath'),
  batchCreate: createInvoke('tag:batchCreate'),
  batchUpdate: createInvoke('tag:batchUpdate'),
  batchDelete: createInvoke('tag:batchDelete'),
  updateSort: createInvoke('tag:updateSort'),
})

contextBridge.exposeInMainWorld('collectApi', {
  queryAll: createInvoke('collect:getAll'),
  getTree: createInvoke('collect:getTree'),
  create: createInvoke('collect:create'),
  createFolder: createInvoke('collect:createFolder'),
  batchCreate: createInvoke('collect:batchCreate'),
  update: createInvokeWithId('collect:update'),
  delete: createInvoke('collect:delete'),
  deleteByCardId: createInvoke('collect:deleteByCardId'),
  checkByCardId: createInvoke('collect:checkByCardId'),
  getCardIdsByType: createInvoke('collect:getCardIdsByType'),
})

contextBridge.exposeInMainWorld('spaceApi', {
  queryAll: () => ipcRenderer.invoke('space:getAll'),
  create: createInvoke('space:create'),
  update: createInvokeWithId('space:update'),
  delete: createInvoke('space:delete'),
  getOne: createInvoke('space:getOne'),
  switchSpace: createInvoke('space:switch'),
  getSpaceInfo: () => ipcRenderer.invoke('space:getSpaceInfo'),
})

contextBridge.exposeInMainWorld('recentlyOpenApi', {
  create: createInvoke('recently-open:create'),
  queryAll: createInvoke('recently-open:getAll'),
  delete: createInvoke('recently-open:delete'),
})

contextBridge.exposeInMainWorld('cardBoxApi', {
  create: createInvoke('card-box:create'),
  queryAll: createInvoke('card-box:getAll'),
  findOne: createInvoke('card-box:getOne'),
  findByIds: createInvoke('card-box:findByIds'),
  delete: createInvoke('card-box:delete'),
  update: createInvokeWithId('card-box:update'),
})

contextBridge.exposeInMainWorld('webViewerApi', {
  create: createInvoke('web-viewer:create'),
  queryAll: createInvoke('web-viewer:getAll'),
  findOne: createInvoke('web-viewer:getOne'),
  delete: createInvoke('web-viewer:delete'),
  update: createInvokeWithId('web-viewer:update'),
  getTree: createInvoke('web-viewer:getTree'),
})

contextBridge.exposeInMainWorld('aiManageApi', {
  // AI对话历史记录相关
  chatHistory: {
    create: createInvoke('ai-chat-history:create'),
    queryAll: createInvoke('ai-chat-history:getAll'),
    findOne: createInvoke('ai-chat-history:getOne'),
    update: createInvokeWithId('ai-chat-history:update'),
    delete: createInvoke('ai-chat-history:delete'),
    deleteBatch: createInvoke('ai-chat-history:deleteBatch'),
  },
  // AI对话会话相关
  chatSession: {
    create: createInvoke('ai-chat-session:create'),
    queryAll: createInvoke('ai-chat-session:getAll'),
    findOne: createInvoke('ai-chat-session:getOne'),
    update: createInvokeWithId('ai-chat-session:update'),
    delete: createInvoke('ai-chat-session:delete'),
    deleteBatch: createInvoke('ai-chat-session:deleteBatch'),
  },
  // 提示词模板相关
  promptTemplate: {
    create: createInvoke('ai-prompt-template:create'),
    queryAll: createInvoke('ai-prompt-template:getAll'),
    findOne: createInvoke('ai-prompt-template:getOne'),
    update: createInvokeWithId('ai-prompt-template:update'),
    delete: createInvoke('ai-prompt-template:delete'),
    findByIds: createInvoke('ai-prompt-template:getByIds'),
    incrementUseCount: createInvoke('ai-prompt-template:incrementUseCount'),
    getDefault: createInvoke('ai-prompt-template:getDefault'),
  },
  
})

contextBridge.exposeInMainWorld('storageApi', {
  getDefaultStoragePath: () => ipcRenderer.invoke('storage:getDefaultStoragePath'),
  getStoragePath: () => ipcRenderer.invoke('storage:getStoragePath'),
  setStoragePath: (path: string) => ipcRenderer.invoke('storage:setStoragePath', path),
  getFileStoragePath: () => ipcRenderer.invoke('storage:getFileStoragePath'),
  getDatabaseBackupPath: () => ipcRenderer.invoke('storage:getDatabaseBackupPath'),
  setDatabaseBackupPath: (path: string) => ipcRenderer.invoke('storage:setDatabaseBackupPath', path),
  importFile: createInvoke('storage:importFile'),
  importFileWithProgress: createInvoke('storage:importFileWithProgress'),
  cancelImportFile: createInvoke('storage:cancelImportFile'),
  saveBase64File: createInvoke('storage:saveBase64File'),
  getStoragePathFileSize: () => ipcRenderer.invoke('storage:getStoragePathFileSize'),
  backupDatabase: () => ipcRenderer.invoke('storage:backupDatabase'),
  getBackupDatabaseList: () => ipcRenderer.invoke('storage:getBackupDatabaseList'),
  restoreBackupDatabase: (timestamp: string) => ipcRenderer.invoke('storage:restoreBackupDatabase', { timestamp  }),
  deleteBackupDatabase: (timestamp: string) => ipcRenderer.invoke('storage:deleteBackupDatabase', { timestamp }),
  // 进度监听相关
  onImportProgress: (callback: (data: { operationId: string; progress: any }) => void) => {
    ipcRenderer.on('storage:importProgress', (_, data) => callback(data))
  },
  offImportProgress: (callback: (data: { operationId: string; progress: any }) => void) => {
    ipcRenderer.off('storage:importProgress', (_, data) => callback(data))
  },
  // 简化的导入函数（带进度回调）
  importFileWithCallback: async (params: {
    fileName: string
    filePath: string
    onProgress?: (progress: any) => void
  }) => {
    const operationId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 设置进度监听
    let progressCallback: ((event: any, data: { operationId: string; progress: any }) => void) | null = null
    if (params.onProgress) {
      progressCallback = (event: any, data: { operationId: string; progress: any }) => {
        if (data.operationId === operationId) {
          params.onProgress!(data.progress)
        }
      }
      ipcRenderer.on('storage:importProgress', progressCallback)
    }
    
    try {
      const result = await ipcRenderer.invoke('storage:importFileWithProgress', {
        fileName: params.fileName,
        filePath: params.filePath,
        operationId
      })
      return result
    } finally {
      // 清理进度监听
      if (progressCallback) {
        ipcRenderer.off('storage:importProgress', progressCallback)
      }
    }
  },
})

// 增加一个系统窗口关闭，最大化，最小化的调用，类似 ipcRenderer.send('window-minimize')
contextBridge.exposeInMainWorld('systemApi', {
  close: () => ipcRenderer.send('window-close'),
  closeChildWindow: () => ipcRenderer.send('child-window-close'),
  openChildWindow: (params?: Record<string, any>) => ipcRenderer.send('child-window-open', params),
  maximize: () => ipcRenderer.send('window-maximize'),
  minimize: () => ipcRenderer.send('window-minimize'),
  selectFolder: () => ipcRenderer.invoke('system:selectFolder'),
  selectFile: (options?: any) => ipcRenderer.invoke('system:selectFile', options),
  selectSaveFile: (options?: any) => ipcRenderer.invoke('system:selectSaveFile', options),
  configSave: (config: any) => ipcRenderer.invoke('system:configSave', config),
  configGet: () => ipcRenderer.invoke('system:configGet'),
  openFile: (filePath: string) => ipcRenderer.invoke('system:openFile', filePath),
  // 此处的modelName 是 大模型id
  setLargeModelConfig: (modelName: string, config: any) => ipcRenderer.invoke('storage:setLargeModelConfig', { modelName, config }),
  getLargeModelConfig: (modelName: string) => ipcRenderer.invoke('storage:getLargeModelConfig', { modelName }),
  getLargeModelConfigList: () => ipcRenderer.invoke('storage:getLargeModelConfigList'),
  deleteLargeModelConfig: (modelName: string) => ipcRenderer.invoke('storage:deleteLargeModelConfig', { modelName }),
  getDeviceInfo: () => ipcRenderer.invoke('system:getDeviceInfo'),
  openUrl: (url: string) => ipcRenderer.invoke('system:openUrl', url),
  getImageBase64: (imageUrl: string) => ipcRenderer.invoke('system:getImageBase64', imageUrl),
  revealInExplorer: (filePath: string) => ipcRenderer.invoke('system:revealInExplorer', filePath),
  getDirectoryStructure: (dirPath: string, options: { indentSize?: number; indentChar?: string }) => ipcRenderer.invoke('system:getDirectoryStructure', dirPath, options),
  getLocalStorage: (key: string) => ipcRenderer.invoke('get-local-storage', key),
  
  // 网页元数据相关API
  getWebMetadata: (url: string) => ipcRenderer.invoke('system:getWebMetadata', url),
})

// 数据同步
contextBridge.exposeInMainWorld('syncApi', {
  webdavSave: createInvoke('sync:webdavSave'),
  webdavGet: createInvoke('sync:webdavGet'),
  webdavUpload: createInvoke('sync:webdavUpload'),
  webdavDownload: createInvoke('sync:webdavDownload'),
  webdavTest: createInvoke('sync:webdavTest'),
  s3Save: createInvoke('sync:s3Save'),
  s3Get: createInvoke('sync:s3Get'),
  s3Test: createInvoke('sync:s3Test'),
  s3Upload: createInvoke('sync:s3Upload'),
  s3Download: createInvoke('sync:s3Download'),
  s3Type: createInvoke('sync:s3Type'),
  getUploadTime: createInvoke('sync:getUploadTime'),
  getSyncTime: createInvoke('sync:getSyncTime'),
  
  // 新增：获取同步状态
  getStatus: (type: string) => ipcRenderer.invoke('sync:getStatus', type),
  
  // 新增：获取同步进度
  getProgress: (type: string, direction?: string, syncType?: string) => ipcRenderer.invoke('sync:getProgress', type, direction, syncType),
  
  // 新增：清除同步记录
  clearRecords: (type: string, direction?: string, syncType?: string) => ipcRenderer.invoke('sync:clearRecords', type, direction, syncType),
  
  // 新增：检查同步状态
  checkStatus: (type: string, direction?: string, syncType?: string) => ipcRenderer.invoke('sync:checkStatus', type, direction, syncType),
  
  // 新增：监听同步进度更新
  onProgressUpdate: (callback: (progressInfo: any) => void) => {
    ipcRenderer.on('sync:progress-update', (_event, progressInfo) => callback(progressInfo));
    return () => ipcRenderer.removeAllListeners('sync:progress-update');
  },
  
  // 新增：清空备份数据（本地和远程）
  clearBackupData: (type: string) => ipcRenderer.invoke('sync:clearBackupData', type),
})

contextBridge.exposeInMainWorld('documentApi', {
  getSpecialDirectories: () => ipcRenderer.invoke('document:getSpecialDirectories'),
  getSystemDrives: () => ipcRenderer.invoke('document:getSystemDrives'),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('document:readDirectory', dirPath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('document:getFileInfo', filePath),
  copyFile: (filePath: string) => ipcRenderer.invoke('document:copyFile', filePath),
  cutFile: (filePath: string) => ipcRenderer.invoke('document:cutFile', filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('document:readFile', filePath),
  readFileStream: (filePath: string) => ipcRenderer.invoke('document:readFileStream', filePath),
  writeFile: (filePath: string, content: string, encoding: string) => ipcRenderer.invoke('document:writeFile', { filePath, content, encoding }),
})

contextBridge.exposeInMainWorld('contentIndexApi', {
  // 基础搜索相关
  search: createInvoke('content-index:search'),
  advancedSearch: createInvoke('content-index:advanced-search'),
  searchCount: createInvoke('content-index:search-count'),
  rebuildIndex: createInvoke('content-index:rebuild-index'),
  getIndexStatus: createInvoke('content-index:get-index-status'),
  optimizeIndex: () => ipcRenderer.invoke('content-index:optimize-index'),
  
  // 文档内容搜索相关
  searchDocumentContent: createInvoke('content-index:search-document-content'),
  advancedSearchDocumentContent: createInvoke('content-index:advanced-search-document-content'),
  searchFiles: createInvoke('content-index:search-files'),
  // 文档文本解析相关
  parseDocumentText: createInvoke('content-index:parse-document-text'),
  parseMultipleDocumentTexts: createInvoke('content-index:parse-multiple-document-texts'),
  
  // 通过文件名查询文档页面内容
  queryByFileName: createInvoke('content-index:query-by-filename'),

  // 文件索引相关
  indexFile: createInvoke('content-index:index-file'),
  indexFileAsync: createInvoke('content-index:index-file-async'),
  indexFolder: createInvoke('content-index:index-folder'),
  
  // 文件夹内容索引 Worker 相关
  getFolderIndexStatus: () => ipcRenderer.invoke('content-index:get-folder-index-status'),
  stopFolderIndex: () => ipcRenderer.invoke('content-index:stop-folder-index'),
  
  // 清理相关
  cleanUnknownTypeDocuments: () => ipcRenderer.invoke('content-index:clean-unknown-type-documents'),
  resetCleanupStatus: () => ipcRenderer.invoke('content-index:reset-cleanup-status'),
  getCleanupStatus: () => ipcRenderer.invoke('content-index:get-cleanup-status'),
})

// 文件索引 API
contextBridge.exposeInMainWorld('fileIndexApi', {
  // 搜索文件
  search: (request: {
    keyword: string
    fileType?: string
    minSize?: number
    maxSize?: number
    limit?: number
    offset?: number
  }) => ipcRenderer.invoke('file-index:search', request),
  
  // 快速搜索（类似 Everything 的即时搜索）
  quickSearch: (request: {
    keyword: string
    limit?: number
  }) => ipcRenderer.invoke('file-index:quick-search', request),
  
  // 获取搜索建议（自动完成）
  getSuggestions: (request: {
    partialKeyword: string
    limit?: number
  }) => ipcRenderer.invoke('file-index:get-suggestions', request),
  
  // 获取文件索引状态
  getStatus: () => ipcRenderer.invoke('file-index:get-status'),
  
  // 重建文件索引
  rebuild: () => ipcRenderer.invoke('file-index:rebuild'),
  
  // 获取索引进度
  getProgress: () => ipcRenderer.invoke('file-index:get-progress'),
  
  // 异步索引系统文件
  indexSystemFiles: (options?: { forceFullScan?: boolean }) => ipcRenderer.invoke('file-index:index-system-files', options),

  // 停止文件索引
  stopIndexing: () => ipcRenderer.invoke('file-index:stop-indexing'),
})

// 新增：暴露卡片事件订阅接口
contextBridge.exposeInMainWorld('cardEvents', {
  onListRefresh: (cb: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => cb(payload)
    ipcRenderer.on('card:list:refresh', handler)
    return () => ipcRenderer.off('card:list:refresh', handler)
  },
  onCardGroupRefresh: (cb: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => cb(payload)
    ipcRenderer.on('cardGroup:list:refresh', handler)
    return () => ipcRenderer.off('cardGroup:list:refresh', handler)
  },
  onTagRefresh: (cb: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => cb(payload)
    ipcRenderer.on('tag:list:refresh', handler)
    return () => ipcRenderer.off('tag:list:refresh', handler)
  },
  onCollectRefresh: (cb: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => cb(payload)
    ipcRenderer.on('collect:list:refresh', handler)
    return () => ipcRenderer.off('collect:list:refresh', handler)
  },
  // 监听卡片数量限制事件
  onLimitReached: (callback: (data: { currentCount: number; limit: number; message: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('card:limitReached', handler)
    return () => ipcRenderer.off('card:limitReached', handler)
  }
})

// 新增：通用事件广播接口，渲染进程可请求主进程广播到所有窗口
contextBridge.exposeInMainWorld('events', {
  broadcast: (channel: string, payload?: any) => ipcRenderer.invoke('system:broadcast', channel, payload),
})



// 嵌入式Web查看器API
contextBridge.exposeInMainWorld('embeddedWebViewerApi', {
  // 创建嵌入式web查看器
  create: (options: {
    url: string
    title?: string
    userAgent?: string
    enableDevTools?: boolean
    bounds: {
      x: number
      y: number
      width: number
      height: number
    }
    enableAnimations?: boolean
    fallbackUrls?: string[]
    customHeaders?: Record<string, string>
  }) => ipcRenderer.invoke('embedded-web-viewer:create', options),
  
  // 更新查看器位置和尺寸
  updateBounds: (viewerId: string, bounds: { x: number; y: number; width: number; height: number }, enableAnimation?: boolean) => 
    ipcRenderer.invoke('embedded-web-viewer:update-bounds', viewerId, bounds, enableAnimation),
  
  // 隐藏查看器
  hide: (viewerId: string) => ipcRenderer.invoke('embedded-web-viewer:hide', viewerId),
  
  // 显示查看器
  show: (viewerId: string) => ipcRenderer.invoke('embedded-web-viewer:show', viewerId),
  
  // 关闭查看器
  close: (viewerId: string) => ipcRenderer.invoke('embedded-web-viewer:close', viewerId),
  
  // 关闭所有查看器
  closeAll: () => ipcRenderer.invoke('embedded-web-viewer:close-all'),
  
  // 获取所有查看器信息
  getAll: () => ipcRenderer.invoke('embedded-web-viewer:get-all'),
})

// 新增：设置嵌入式Web查看器事件监听器
contextBridge.exposeInMainWorld('embeddedWebViewerEvents', {
  // 监听加载失败事件
  onLoadFailed: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('embedded-viewer:load-failed', handler)
    return () => ipcRenderer.off('embedded-viewer:load-failed', handler)
  },
  
  // 监听标题更新事件
  onTitleUpdated: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('embedded-viewer:title-updated', handler)
    return () => ipcRenderer.off('embedded-viewer:title-updated', handler)
  },
  
  // 监听加载完成事件
  onLoaded: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('embedded-viewer:loaded', handler)
    return () => ipcRenderer.off('embedded-viewer:loaded', handler)
  }
})

// 应用启动参数API
contextBridge.exposeInMainWorld('appParamsApi', {
  // 获取当前参数
  get: () => ipcRenderer.invoke('app-params:get'),
  
  // 清空当前参数
  clear: () => ipcRenderer.invoke('app-params:clear'),
  
  // 监听参数变化
  onChange: (callback: (params: any) => void) => {
    const handler = (_event: any, params: any) => callback(params);
    ipcRenderer.on('app-params:changed', handler);
    return () => ipcRenderer.off('app-params:changed', handler);
  }
})

// 本地导出API
contextBridge.exposeInMainWorld('exportLocalApi', {
  // 导出画布到本地副本
  exportCanvas: createInvoke('export-local:canvas'),
  // 导入画布副本
  importCanvas: createInvoke('export-local:import'),
})
