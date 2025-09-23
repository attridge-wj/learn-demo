import Store from 'electron-store'
import { cleanUnknownTypeDocuments } from './document-page-content-search.service'

const store = new Store({
  name: 'app-settings',
  defaults: {
    hasCleanedUnknownDocuments: false
  }
})

/**
 * 自动清理未知类型的文档索引
 * 只在首次启动时执行一次
 */
export async function autoCleanupUnknownDocuments(): Promise<void> {
  try {
    // 检查是否已经执行过清理
    const hasCleaned = store.get('hasCleanedUnknownDocuments', false) as boolean
    
    if (hasCleaned) {
      console.log('未知类型文档索引已清理过，跳过自动清理')
      return
    }

    console.log('首次启动，开始自动清理未知类型文档索引...')
    
    // 执行清理
    const result = await cleanUnknownTypeDocuments()
    
    if (result.deletedCount > 0) {
      console.log(`自动清理完成，共删除 ${result.deletedCount} 个未知类型的文档索引`)
    } else {
      console.log('没有找到需要清理的未知类型文档')
    }
    
    // 标记为已清理
    store.set('hasCleanedUnknownDocuments', true)
    console.log('已标记为已清理，下次启动将跳过')
    
  } catch (error) {
    console.error('自动清理未知类型文档索引失败:', error)
    // 即使清理失败，也标记为已尝试，避免重复执行
    store.set('hasCleanedUnknownDocuments', true)
  }
}

/**
 * 重置清理状态（用于测试或强制重新清理）
 */
export function resetCleanupStatus(): void {
  store.set('hasCleanedUnknownDocuments', false)
  console.log('已重置清理状态，下次启动将重新执行清理')
}

/**
 * 获取清理状态
 */
export function getCleanupStatus(): boolean {
  return store.get('hasCleanedUnknownDocuments', false) as boolean
}
