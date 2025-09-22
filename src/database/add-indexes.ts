import { AppDataSource } from './connection'

/**
 * 手动为sys_card_base表添加索引
 * 提升LIKE查询性能
 */
export async function addCardIndexes() {
  console.log('🚀 开始为sys_card_base表添加索引...')
  
  try {
    await AppDataSource.initialize()
    const queryRunner = AppDataSource.createQueryRunner()
    
    // 为LIKE查询字段添加索引
    const indexes = [
      { name: 'IDX_sys_card_base_text', field: 'text' },
      { name: 'IDX_sys_card_base_name', field: 'name' },
      { name: 'IDX_sys_card_base_description', field: 'description' },
      { name: 'IDX_sys_card_base_mark_text', field: 'mark_text' },
      { name: 'IDX_sys_card_base_extra_data', field: 'extra_data' }
    ]
    
    for (const index of indexes) {
      try {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "${index.name}" ON "sys_card_base" ("${index.field}")
        `)
        console.log(`✅ 已创建索引: ${index.name} (${index.field})`)
      } catch (error) {
        console.log(`⚠️  索引 ${index.name} 可能已存在: ${error}`)
      }
    }
    
    // 验证索引是否创建成功
    const existingIndexes = await queryRunner.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='sys_card_base' 
      AND name LIKE 'IDX_sys_card_base_%'
    `)
    
    console.log('\n📊 当前索引状态:')
    existingIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}`)
    })
    
    console.log('\n🎉 索引添加完成！')
    
  } catch (error) {
    console.error('❌ 添加索引失败:', error)
    throw error
  } finally {
    await AppDataSource.destroy()
  }
}

/**
 * 为AI对话会话表添加索引
 * 提升查询性能
 */
export async function addAiChatSessionIndexes() {
  console.log('🚀 开始为sys_ai_chat_session表添加索引...')
  
  try {
    await AppDataSource.initialize()
    const queryRunner = AppDataSource.createQueryRunner()
    
    // 为AI对话会话表添加索引
    const indexes = [
      { name: 'IDX_sys_ai_chat_session_space_id', field: 'space_id' },
      { name: 'IDX_sys_ai_chat_session_model_name', field: 'model_name' },
      { name: 'IDX_sys_ai_chat_session_title', field: 'title' },
      { name: 'IDX_sys_ai_chat_session_chat_type', field: 'chat_type' },
      { name: 'IDX_sys_ai_chat_session_create_time', field: 'create_time' },
      { name: 'IDX_sys_ai_chat_session_last_message_time', field: 'last_message_time' }
    ]
    
    for (const index of indexes) {
      try {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "${index.name}" ON "sys_ai_chat_session" ("${index.field}")
        `)
        console.log(`✅ 已创建索引: ${index.name} (${index.field})`)
      } catch (error) {
        console.log(`⚠️  索引 ${index.name} 可能已存在: ${error}`)
      }
    }
    
    // 验证索引是否创建成功
    const existingIndexes = await queryRunner.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='sys_ai_chat_session' 
      AND name LIKE 'IDX_sys_ai_chat_session_%'
    `)
    
    console.log('\n📊 当前AI对话会话表索引状态:')
    existingIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}`)
    })
    
    console.log('\n🎉 AI对话会话表索引添加完成！')
    
  } catch (error) {
    console.error('❌ 添加AI对话会话表索引失败:', error)
    throw error
  } finally {
    await AppDataSource.destroy()
  }
}

/**
 * 检查索引性能
 */
export async function checkIndexPerformance() {
  console.log('🔍 检查索引性能...')
  
  try {
    await AppDataSource.initialize()
    const queryRunner = AppDataSource.createQueryRunner()
    
    // 测试查询性能
    const testQueries = [
      { name: 'name查询', sql: 'SELECT COUNT(*) FROM sys_card_base WHERE name LIKE "%test%"' },
      { name: 'text查询', sql: 'SELECT COUNT(*) FROM sys_card_base WHERE text LIKE "%test%"' },
      { name: 'description查询', sql: 'SELECT COUNT(*) FROM sys_card_base WHERE description LIKE "%test%"' },
      { name: 'markText查询', sql: 'SELECT COUNT(*) FROM sys_card_base WHERE mark_text LIKE "%test%"' },
      { name: 'extraData查询', sql: 'SELECT COUNT(*) FROM sys_card_base WHERE extra_data LIKE "%test%"' }
    ]
    
    for (const query of testQueries) {
      const startTime = Date.now()
      await queryRunner.query(query.sql)
      const endTime = Date.now()
      console.log(`  ${query.name}: ${endTime - startTime}ms`)
    }
    
  } catch (error) {
    console.error('❌ 性能检查失败:', error)
  } finally {
    await AppDataSource.destroy()
  }
}

// 如果直接运行此文件
if (require.main === module) {
  addCardIndexes()
    .then(() => addAiChatSessionIndexes())
    .then(() => checkIndexPerformance())
    .then(() => console.log('✅ 所有操作完成'))
    .catch(console.error)
} 