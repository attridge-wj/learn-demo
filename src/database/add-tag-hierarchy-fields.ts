import { AppDataSource } from './connection'

export async function addTagHierarchyFields(): Promise<void> {
  try {
    const connection = await AppDataSource.initialize()
    
    // 检查字段是否已存在
    const tableInfo = await connection.query(`
      PRAGMA table_info(sys_tag)
    `)
    
    const existingColumns = tableInfo.map((col: any) => col.name)
    
    // 添加新字段
    const alterQueries = []
    
    if (!existingColumns.includes('parent_id')) {
      alterQueries.push('ALTER TABLE sys_tag ADD COLUMN parent_id TEXT')
    }
    
    if (!existingColumns.includes('parent_name')) {
      alterQueries.push('ALTER TABLE sys_tag ADD COLUMN parent_name TEXT')
    }
    
    if (!existingColumns.includes('level')) {
      alterQueries.push('ALTER TABLE sys_tag ADD COLUMN level INTEGER DEFAULT 0')
    }
    
    // 执行ALTER语句
    for (const query of alterQueries) {
      await connection.query(query)
      console.log(`执行SQL: ${query}`)
    }
    
    // 更新现有数据的level字段
    await connection.query(`
      UPDATE sys_tag 
      SET level = 0, parent_id = NULL, parent_name = NULL 
      WHERE level IS NULL OR parent_id IS NULL
    `)
    
    console.log('标签层级字段添加完成')
    
    await connection.destroy()
  } catch (error) {
    console.error('添加标签层级字段失败:', error)
    throw error
  }
}

// 如果直接运行此文件
if (require.main === module) {
  addTagHierarchyFields()
    .then(() => {
      console.log('数据库迁移完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('数据库迁移失败:', error)
      process.exit(1)
    })
} 