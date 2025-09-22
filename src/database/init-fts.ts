// 初始化虚拟表信息
import { DataSource } from 'typeorm'

export async function initFTSDatabase(dataSource: DataSource) {
  try {
    // 获取sqlite版本
    const versionResult = await dataSource.query(`SELECT sqlite_version() as version`)
    console.log('SQLite版本:', versionResult[0]?.version)

    // 检查基础表是否存在，如果不存在则跳过FTS初始化
    const baseTablesExist = await dataSource.query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name IN ('card_derived_text', 'document_page_content', 'file_index')
    `)
    
    if (Number(baseTablesExist?.[0]?.count ?? 0) === 0) {
      console.log('基础表不存在，跳过FTS初始化，等待数据库同步完成')
      return
    }

    // 确保元数据表存在
    await ensureFtsMetaTable(dataSource)

    // 确保三个 FTS 存在或按版本升级 + 触发器存在 + 必要回填
    await ensureCardDerivedTextFTS(dataSource)
    await ensureDocumentPageContentFTS(dataSource)
    await ensureFileIndexFTS(dataSource)

    console.log('FTS全文索引初始化完成')
  } catch (error) {
    console.error('FTS初始化失败:', error)
  }
}

// -------------------------
// 元数据：记录 FTS schema 版本
// -------------------------
async function ensureFtsMetaTable(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS fts_meta (
      fts_name TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

async function getFtsSchemaVersion(ds: DataSource, ftsName: string): Promise<number | null> {
  const rows = await ds.query(`SELECT schema_version FROM fts_meta WHERE fts_name = ?`, [ftsName])
  const v = rows?.[0]?.schema_version
  return typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : null)
}

async function upsertFtsSchemaVersion(ds: DataSource, ftsName: string, version: number) {
  const now = new Date().toISOString()
  await ds.query(
    `INSERT INTO fts_meta(fts_name, schema_version, updated_at) VALUES(?, ?, ?)
     ON CONFLICT(fts_name) DO UPDATE SET schema_version = excluded.schema_version, updated_at = excluded.updated_at`,
    [ftsName, version, now]
  )
}

async function deleteFtsSchemaVersion(ds: DataSource, ftsName: string) {
  await ds.query(`DELETE FROM fts_meta WHERE fts_name = ?`, [ftsName])
}

// -------------------------
// 卡片派生文本 FTS（card_derived_text_fts）
// -------------------------
async function ensureCardDerivedTextFTS(dataSource: DataSource) {
  try {
    console.log('检查卡片派生文本存储表...')
    // 基础表（作为派生文本存储）
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS card_derived_text (
        card_id TEXT PRIMARY KEY,
        card_type TEXT,
        name TEXT,
        space_id TEXT,
        text TEXT,
        origin_text TEXT
      )
    `)
    // 兼容老版本：补充缺失列
    const info = await dataSource.query(`PRAGMA table_info(card_derived_text)`)
    const cols = new Set(info.map((r: any) => r.name))
    if (!cols.has('origin_text')) {
      await dataSource.query(`ALTER TABLE card_derived_text ADD COLUMN origin_text TEXT`)
    }

    // 版本目标（如需调整 tokenizer/prefix/UNINDEXED 等，提升版本号）
    const TARGET_VERSION = 2
    const FTS_NAME = 'card_derived_text_fts'

    // FTS 是否存在
    const ftsExists = await dataSource.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='${FTS_NAME}'
    `)
    const currentVersion = await getFtsSchemaVersion(dataSource, FTS_NAME)

    if (ftsExists.length === 0) {
      // 不存在：创建并回填，记录版本
      await createCardDerivedTextFTS(dataSource)
      await backfillCardDerivedTextFTS(dataSource)
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已创建并回填`)
    } else if (!currentVersion || currentVersion < TARGET_VERSION) {
      // 需要升级：删触发器 -> 删虚拟表 -> 重建 -> 回填 -> 写版本
      await dataSource.transaction(async manager => {
        await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_insert`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_update`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_delete`)
        await manager.query(`DROP TABLE IF EXISTS ${FTS_NAME}`)
        await createCardDerivedTextFTS(manager as unknown as DataSource)
        await backfillCardDerivedTextFTS(manager as unknown as DataSource)
      })
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已升级并回填 -> 版本: ${TARGET_VERSION}`)
    } else {
      // 自检 + 必要回填（fts 行数小于基表时回填）
      const baseCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM card_derived_text`)
      const ftsCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM ${FTS_NAME}`)
      const baseCount = Number(baseCountRows?.[0]?.c ?? 0)
      const ftsCount = Number(ftsCountRows?.[0]?.c ?? 0)

      // 确保触发器存在
      await createCardDerivedTextTriggers(dataSource)

      if (ftsCount < baseCount) {
        await dataSource.transaction(async manager => {
          await manager.query(`DELETE FROM ${FTS_NAME}`)
          await backfillCardDerivedTextFTS(manager as unknown as DataSource)
        })
        console.log(`${FTS_NAME} 快速回填: ${ftsCount} -> ${baseCount}`)
      }
    }

    console.log('卡片派生文本FTS初始化完成')
  } catch (error) {
    console.error('卡片派生文本FTS初始化失败:', error)
    throw error
  }
}

async function createCardDerivedTextFTS(ds: DataSource) {
  await ds.query(`
    CREATE VIRTUAL TABLE IF NOT EXISTS card_derived_text_fts USING fts5(
      card_id UNINDEXED,
      card_type UNINDEXED,
      name,
      space_id UNINDEXED,
      text,
      origin_text UNINDEXED,
      tokenize='porter unicode61',
      prefix='2 3 4 5 6 7 8 9 10'
    )
  `)
  await createCardDerivedTextTriggers(ds)
}

async function createCardDerivedTextTriggers(ds: DataSource) {
  await ds.transaction(async manager => {
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_card_derived_text_after_insert
      AFTER INSERT ON card_derived_text
      BEGIN
        INSERT INTO card_derived_text_fts(card_id, card_type, name, space_id, text, origin_text)
        VALUES (NEW.card_id, COALESCE(NEW.card_type, ''), COALESCE(NEW.name, ''), COALESCE(NEW.space_id, ''), COALESCE(NEW.text, ''), COALESCE(NEW.origin_text, ''));
      END;
    `)

    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_card_derived_text_after_update
      AFTER UPDATE ON card_derived_text
      BEGIN
        UPDATE card_derived_text_fts
        SET card_type = COALESCE(NEW.card_type, ''), name = COALESCE(NEW.name, ''), space_id = COALESCE(NEW.space_id, ''), text = COALESCE(NEW.text, ''), origin_text = COALESCE(NEW.origin_text, '')
        WHERE card_id = NEW.card_id;
      END;
    `)

    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_card_derived_text_after_delete
      AFTER DELETE ON card_derived_text
      BEGIN
        DELETE FROM card_derived_text_fts WHERE card_id = OLD.card_id;
      END;
    `)
  })
}

async function backfillCardDerivedTextFTS(ds: DataSource) {
  await ds.query(`
    INSERT INTO card_derived_text_fts(card_id, card_type, name, space_id, text, origin_text)
    SELECT card_id,
           COALESCE(card_type, ''),
           COALESCE(name, ''),
           COALESCE(space_id, ''),
           COALESCE(text, ''),
           COALESCE(origin_text, '')
    FROM card_derived_text
  `)
}

// -------------------------
// 文档页面内容 FTS（document_page_content_fts）
// -------------------------
async function ensureDocumentPageContentFTS(dataSource: DataSource) {
  try {
    console.log('检查文档页面内容FTS虚拟表...')

    const TARGET_VERSION = 2
    const FTS_NAME = 'document_page_content_fts'

    // FTS 是否存在
    const ftsExists = await dataSource.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='${FTS_NAME}'
    `)
    const currentVersion = await getFtsSchemaVersion(dataSource, FTS_NAME)

    if (ftsExists.length === 0) {
      await createDocumentPageContentFTS(dataSource)
      await backfillDocumentPageContentFTS(dataSource)
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已创建并回填`)
    } else if (!currentVersion || currentVersion < TARGET_VERSION) {
      await dataSource.transaction(async manager => {
        await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_insert`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_update`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_delete`)
        await manager.query(`DROP TABLE IF EXISTS ${FTS_NAME}`)
        await createDocumentPageContentFTS(manager as unknown as DataSource)
        await backfillDocumentPageContentFTS(manager as unknown as DataSource)
      })
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已升级并回填 -> 版本: ${TARGET_VERSION}`)
    } else {
      // 自检 + 必要回填
      const baseCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM document_page_content`)
      const ftsCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM ${FTS_NAME}`)
      const baseCount = Number(baseCountRows?.[0]?.c ?? 0)
      const ftsCount = Number(ftsCountRows?.[0]?.c ?? 0)

      await createDocumentPageContentTriggers(dataSource)

      if (ftsCount < baseCount) {
        await dataSource.transaction(async manager => {
          await manager.query(`DELETE FROM ${FTS_NAME}`)
          await backfillDocumentPageContentFTS(manager as unknown as DataSource)
        })
        console.log(`${FTS_NAME} 快速回填: ${ftsCount} -> ${baseCount}`)
      }
    }
  } catch (error) {
    console.error('文档页面内容FTS初始化失败:', error)
    throw error
  }
}

async function createDocumentPageContentFTS(ds: DataSource) {
  await ds.query(`
    CREATE VIRTUAL TABLE IF NOT EXISTS document_page_content_fts USING fts5(
      document_id UNINDEXED,
      space_id UNINDEXED,
      card_id UNINDEXED,
      file_name,
      file_type UNINDEXED,
      file_path UNINDEXED,
      origin_path UNINDEXED,
      page_number UNINDEXED,
      content,
      content_segmented,
      tokenize='porter unicode61',
      prefix='2 3 4 5 6 7 8 9 10'
    )
  `)
  await createDocumentPageContentTriggers(ds)
}

async function createDocumentPageContentTriggers(ds: DataSource) {
  await ds.transaction(async manager => {
    // INSERT: 直接插入
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_doc_page_content_after_insert
      AFTER INSERT ON document_page_content
      BEGIN
        INSERT INTO document_page_content_fts(
          document_id, space_id, card_id, file_name, file_type, file_path, origin_path, page_number, content, content_segmented
        )
        VALUES (
          NEW.document_id, COALESCE(NEW.space_id, ''), COALESCE(NEW.card_id, ''), COALESCE(NEW.file_name, ''), COALESCE(NEW.file_type, ''),
          COALESCE(NEW.file_path, ''), COALESCE(NEW.origin_path, ''), COALESCE(NEW.page_number, 0), COALESCE(NEW.content, ''), COALESCE(NEW.content_segmented, '')
        );
      END;
    `)

    // UPDATE: 用 OLD 键删除再插入 NEW 值，避免键变更导致匹配不到
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_doc_page_content_after_update
      AFTER UPDATE ON document_page_content
      BEGIN
        DELETE FROM document_page_content_fts
        WHERE document_id = OLD.document_id AND page_number = OLD.page_number AND COALESCE(card_id, '') = COALESCE(OLD.card_id, '');

        INSERT INTO document_page_content_fts(
          document_id, space_id, card_id, file_name, file_type, file_path, origin_path, page_number, content, content_segmented
        )
        VALUES (
          NEW.document_id, COALESCE(NEW.space_id, ''), COALESCE(NEW.card_id, ''), COALESCE(NEW.file_name, ''), COALESCE(NEW.file_type, ''),
          COALESCE(NEW.file_path, ''), COALESCE(NEW.origin_path, ''), COALESCE(NEW.page_number, 0), COALESCE(NEW.content, ''), COALESCE(NEW.content_segmented, '')
        );
      END;
    `)

    // DELETE: 通过 OLD 键删除
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_doc_page_content_after_delete
      AFTER DELETE ON document_page_content
      BEGIN
        DELETE FROM document_page_content_fts
        WHERE document_id = OLD.document_id AND page_number = OLD.page_number AND COALESCE(card_id, '') = COALESCE(OLD.card_id, '');
      END;
    `)
  })
}

async function backfillDocumentPageContentFTS(ds: DataSource) {
  await ds.query(`
    INSERT INTO document_page_content_fts(
      document_id, space_id, card_id, file_name, file_type, file_path, origin_path, page_number, content, content_segmented
    )
    SELECT 
      document_id,
      COALESCE(space_id, ''),
      COALESCE(card_id, ''),
      COALESCE(file_name, ''),
      COALESCE(file_type, ''),
      COALESCE(file_path, ''),
      COALESCE(origin_path, ''),
      COALESCE(page_number, 0),
      COALESCE(content, ''),
      COALESCE(content_segmented, '')
    FROM document_page_content
  `)
}

// -------------------------
// 文件索引 FTS（file_index_fts）
// -------------------------
async function ensureFileIndexFTS(dataSource: DataSource) {
  try {
    console.log('检查文件索引FTS虚拟表...')

    const TARGET_VERSION = 2 // 升级版本以触发重建
    const FTS_NAME = 'file_index_fts'

    // FTS 是否存在
    const ftsExists = await dataSource.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='${FTS_NAME}'
    `)
    const currentVersion = await getFtsSchemaVersion(dataSource, FTS_NAME)

    if (ftsExists.length === 0) {
      await createFileIndexFTS(dataSource)
      await backfillFileIndexFTS(dataSource)
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已创建并回填`)
    } else if (!currentVersion || currentVersion < TARGET_VERSION) {
      await dataSource.transaction(async manager => {
        await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_insert`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_update`)
        await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_delete`)
        await manager.query(`DROP TABLE IF EXISTS ${FTS_NAME}`)
        await createFileIndexFTS(manager as unknown as DataSource)
        await backfillFileIndexFTS(manager as unknown as DataSource)
      })
      await upsertFtsSchemaVersion(dataSource, FTS_NAME, TARGET_VERSION)
      console.log(`${FTS_NAME} 已升级并回填 -> 版本: ${TARGET_VERSION}`)
    } else {
      // 自检 + 必要回填
      const baseCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM file_index`)
      const ftsCountRows = await dataSource.query(`SELECT COUNT(*) AS c FROM ${FTS_NAME}`)
      const baseCount = Number(baseCountRows?.[0]?.c ?? 0)
      const ftsCount = Number(ftsCountRows?.[0]?.c ?? 0)

      await createFileIndexTriggers(dataSource)

      if (ftsCount < baseCount) {
        await dataSource.transaction(async manager => {
          await manager.query(`DELETE FROM ${FTS_NAME}`)
          await backfillFileIndexFTS(manager as unknown as DataSource)
        })
        console.log(`${FTS_NAME} 快速回填: ${ftsCount} -> ${baseCount}`)
      }
    }
  } catch (error) {
    console.error('文件索引FTS初始化失败:', error)
    throw error
  }
}

async function createFileIndexFTS(ds: DataSource) {
  await ds.query(`
    CREATE VIRTUAL TABLE IF NOT EXISTS file_index_fts USING fts5(
      id UNINDEXED,
      file_name,
      file_name_segmented,
      file_path UNINDEXED,
      file_size UNINDEXED,
      file_type UNINDEXED,
      create_time UNINDEXED,
      update_time UNINDEXED,
      index_time UNINDEXED,
      tokenize='porter unicode61',
      prefix='2 3 4 5 6 7 8 9 10'
    )
  `)
  await createFileIndexTriggers(ds)
}

async function createFileIndexTriggers(ds: DataSource) {
  await ds.transaction(async manager => {
    // INSERT: 直接插入
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_file_index_after_insert
      AFTER INSERT ON file_index
      BEGIN
        INSERT INTO file_index_fts(
          id, file_name, file_name_segmented, file_path, file_size, file_type, create_time, update_time, index_time
        )
        VALUES (
          NEW.id, COALESCE(NEW.file_name, ''), COALESCE(NEW.file_name_segmented, ''), COALESCE(NEW.file_path, ''), COALESCE(NEW.file_size, 0), 
          COALESCE(NEW.file_type, ''), COALESCE(NEW.create_time, ''), COALESCE(NEW.update_time, ''), COALESCE(NEW.index_time, '')
        );
      END;
    `)

    // UPDATE: 用 OLD 键删除再插入 NEW 值
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_file_index_after_update
      AFTER UPDATE ON file_index
      BEGIN
        DELETE FROM file_index_fts WHERE id = OLD.id;
        
        INSERT INTO file_index_fts(
          id, file_name, file_name_segmented, file_path, file_size, file_type, create_time, update_time, index_time
        )
        VALUES (
          NEW.id, COALESCE(NEW.file_name, ''), COALESCE(NEW.file_name_segmented, ''), COALESCE(NEW.file_path, ''), COALESCE(NEW.file_size, 0), 
          COALESCE(NEW.file_type, ''), COALESCE(NEW.create_time, ''), COALESCE(NEW.update_time, ''), COALESCE(NEW.index_time, '')
        );
      END;
    `)

    // DELETE: 通过 OLD 键删除
    await manager.query(`
      CREATE TRIGGER IF NOT EXISTS tr_file_index_after_delete
      AFTER DELETE ON file_index
      BEGIN
        DELETE FROM file_index_fts WHERE id = OLD.id;
      END;
    `)
  })
}

async function backfillFileIndexFTS(ds: DataSource) {
  await ds.query(`
    INSERT INTO file_index_fts(
      id, file_name, file_name_segmented, file_path, file_size, file_type, create_time, update_time, index_time
    )
    SELECT 
      id,
      COALESCE(file_name, ''),
      COALESCE(file_name_segmented, ''),
      COALESCE(file_path, ''),
      COALESCE(file_size, 0),
      COALESCE(file_type, ''),
      COALESCE(create_time, ''),
      COALESCE(update_time, ''),
      COALESCE(index_time, '')
    FROM file_index
  `)
}

// -------------------------
// 工具方法
// -------------------------
/**
 * 全量同步回填 FTS（删除现有 FTS 内容后重建）
 */
export async function syncAllFts(dataSource: DataSource) {
  try {
    await ensureFtsMetaTable(dataSource)
    await ensureCardDerivedTextFTS(dataSource)
    await ensureDocumentPageContentFTS(dataSource)
    await ensureFileIndexFTS(dataSource)

    await dataSource.transaction(async manager => {
      await manager.query(`DELETE FROM card_derived_text_fts`)
      await backfillCardDerivedTextFTS(manager as unknown as DataSource)

      await manager.query(`DELETE FROM document_page_content_fts`)
      await backfillDocumentPageContentFTS(manager as unknown as DataSource)

      await manager.query(`DELETE FROM file_index_fts`)
      await backfillFileIndexFTS(manager as unknown as DataSource)
    })
    console.log('已完成 FTS 全量同步回填')
  } catch (error) {
    console.error('FTS 全量同步失败:', error)
    throw error
  }
}

/**
 * 删除所有 FTS 虚拟表（及相关触发器与元数据）
 */
export async function dropAllFts(dataSource: DataSource) {
  try {
    await ensureFtsMetaTable(dataSource)
    await dataSource.transaction(async manager => {
      // 删除触发器（card_derived_text）
      await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_insert`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_update`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_card_derived_text_after_delete`)
      // 删除 FTS 表
      await manager.query(`DROP TABLE IF EXISTS card_derived_text_fts`)

      // 删除触发器（document_page_content）
      await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_insert`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_update`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_doc_page_content_after_delete`)
      // 删除 FTS 表
      await manager.query(`DROP TABLE IF EXISTS document_page_content_fts`)

      // 删除触发器（file_index）
      await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_insert`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_update`)
      await manager.query(`DROP TRIGGER IF EXISTS tr_file_index_after_delete`)
      // 删除 FTS 表
      await manager.query(`DROP TABLE IF EXISTS file_index_fts`)

      // 清理元数据
      await manager.query(`DELETE FROM fts_meta WHERE fts_name IN ('card_derived_text_fts', 'document_page_content_fts', 'file_index_fts')`)
    })
    console.log('已删除所有 FTS 虚拟表、触发器与元数据')
  } catch (error) {
    console.error('删除 FTS 虚拟表失败:', error)
    throw error
  }
}
