import { DataSource } from 'typeorm'
import path, { join } from 'path'
import { app } from 'electron'
import { UserEntity } from '../ipc/user/entities/user.entities'
import { RecentlyOpenEntity } from '../ipc/recent-open/entities/sys_recently_open.entity'
import { SpaceEntity } from '../ipc/space/entities/sys_space.entity'
import { UserSpaceEntity } from '../ipc/space/entities/sys_space_user.entity'
import { TagEntity } from '../ipc/tag/entities/sys_tag.entity'
import { CardBoxEntity } from '../ipc/card-box/entities/sys_card_box.entity'
import { SysCardBaseEntity } from '../ipc/card/entities/sys-card-base.entity'
import { SysCardDrawboardEntity } from '../ipc/card/entities/sys-card-drawboard.entity'
import { SysCardFileEntity } from '../ipc/card/entities/sys-card-file.entity'
import { SysCardMarkEntity } from '../ipc/card/entities/sys-card-mark.entity'
import { SysCardMermaidEntity } from '../ipc/card/entities/sys-card-mermaid.entity'
import { SysCardRichTextEntity } from '../ipc/card/entities/sys-card-rich-text.entity'
import { SysCardMultiTableEntity } from '../ipc/card/entities/sys-card-multi-table.entity'
import { SysCardMindMapEntity } from '../ipc/card/entities/sys-card-mind-map.entity'
import { SysRelateIdEntity } from '../ipc/card/entities/sys-relate-id.entity'
import { SysCardRelationEntity } from '../ipc/card/entities/sys-card-relation.entity'
import { CollectEntity } from '../ipc/collect/entities/sys_collect.entity'
import { DocumentPageContentEntity } from '../ipc/content-index/entities/document-page-content.entity'
import { FileIndexEntity } from '../ipc/content-index/entities/file-index.entity'
import { AiChatHistoryEntity } from '../ipc/ai-manage/entities/sys_ai_chat_history.entity'
import { AiChatSessionEntity } from '../ipc/ai-manage/entities/sys_ai_chat_session.entity'
import { AiPromptTemplateEntity } from '../ipc/ai-manage/entities/sys_ai_prompt_template.entity'
import { CardDerivedTextEntity } from '../ipc/content-index/entities/card-derived-text.entity'
import { WebBookmarkEntity } from '../ipc/web-viewer/entities/sys_web_bookmark.entity'

import { initFTSDatabase } from './init-fts'

const dbPath = path.join(app.getPath('userData'), 'rebirth_database', 'rebirth.db')

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development'
console.log('isDev', process.env.NODE_ENV)
// 数据库配置
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [
    SpaceEntity,
    UserSpaceEntity,
    TagEntity,
    UserEntity,
    CardBoxEntity,
    RecentlyOpenEntity,
    SysCardBaseEntity,
    SysCardDrawboardEntity,
    SysCardFileEntity,
    SysCardMarkEntity,
    SysCardMermaidEntity,
    SysCardRichTextEntity,
    SysCardMultiTableEntity,
    SysCardMindMapEntity,
    SysRelateIdEntity,
    SysCardRelationEntity,
    CollectEntity,
    DocumentPageContentEntity,
    FileIndexEntity,
    AiChatHistoryEntity,
    AiChatSessionEntity,
    AiPromptTemplateEntity,
    CardDerivedTextEntity,
    WebBookmarkEntity
  ],
  synchronize: true, // 重新启用自动同步，确保表结构被创建
  driver: require('better-sqlite3'),
  verbose: isDev ? console.log : undefined
})


// main.js 中添加
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// 初始化数据库
export async function initDatabase() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
      console.log('数据库连接成功')
      
      // 等待一下确保表结构同步完成
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 初始化FTS全文索引
      await initFTSDatabase(AppDataSource)
      console.log('卡片FTS全文索引初始化完成')
    }
  } catch (error) {
    console.error('数据库连接失败:', error)
    throw error
  }
}

// 关闭数据库连接
export async function closeDatabase() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}
