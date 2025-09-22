# 画布副本导入删除顺序测试

## 测试目的

验证覆盖模式中卡片删除的正确顺序，确保先删除子表数据，再删除主表数据，避免外键约束错误。

## 删除顺序说明

### 正确的删除顺序

1. **子表数据删除**（按依赖关系）：
   - `sys_card_rich_text` - 富文本卡片子表
   - `sys_card_drawboard` - 画布卡片子表
   - `sys_card_mind_map` - 思维导图卡片子表
   - `sys_card_multi_table` - 多维表卡片子表
   - `sys_card_file` - 文件卡片子表
   - `sys_card_mark` - 标记卡片子表
   - `sys_card_mermaid` - Mermaid 卡片子表

2. **主表数据删除**：
   - `sys_card_base` - 卡片主表

### 错误的删除顺序

如果先删除主表，会导致：
- 子表数据变成孤立数据
- 外键约束错误
- 数据库完整性破坏

## 测试用例

### 测试用例 1: 画布卡片覆盖

```typescript
// 1. 创建包含子表数据的画布卡片
const originalCard = {
  id: 'test-drawboard-1',
  cardType: 'draw-board',
  name: '原始画布',
  content: { elements: [{ id: 'elem1', type: 'text' }] }
}

// 2. 导入原始卡片
await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 3. 验证子表数据存在
const drawboardData = await AppDataSource.getRepository(SysCardDrawboardEntity)
  .findOne({ where: { cardId: 'test-drawboard-1' } })
assert(drawboardData !== null)

// 4. 覆盖模式导入相同ID的卡片
const newCard = {
  id: 'test-drawboard-1',
  cardType: 'draw-board',
  name: '新画布',
  content: { elements: [{ id: 'elem2', type: 'image' }] }
}

const result = await window.exportLocalApi.importCanvas({
  importMode: 'overwrite'
})

// 5. 验证覆盖成功
assert(result.success === true)
assert(result.data?.overwrittenCount > 0)

// 6. 验证子表数据被正确更新
const newDrawboardData = await AppDataSource.getRepository(SysCardDrawboardEntity)
  .findOne({ where: { cardId: 'test-drawboard-1' } })
assert(newDrawboardData !== null)
assert(newDrawboardData.content.includes('elem2'))
```

### 测试用例 2: 多维表卡片覆盖

```typescript
// 1. 创建包含复杂子表数据的多维表卡片
const originalCard = {
  id: 'test-multitable-1',
  cardType: 'multi-table',
  name: '原始多维表',
  data: { tableData: [[1, 2, 3]] },
  attrList: [{ name: 'attr1', value: 'value1' }],
  viewList: [{ id: 'view1', name: '视图1' }]
}

// 2. 导入原始卡片
await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 3. 覆盖模式导入
const newCard = {
  id: 'test-multitable-1',
  cardType: 'multi-table',
  name: '新多维表',
  data: { tableData: [[4, 5, 6]] },
  attrList: [{ name: 'attr2', value: 'value2' }],
  viewList: [{ id: 'view2', name: '视图2' }]
}

const result = await window.exportLocalApi.importCanvas({
  importMode: 'overwrite'
})

// 4. 验证覆盖成功且数据正确
assert(result.success === true)
const multiTableData = await AppDataSource.getRepository(SysCardMultiTableEntity)
  .findOne({ where: { cardId: 'test-multitable-1' } })
assert(multiTableData.data.includes('4, 5, 6'))
```

### 测试用例 3: 思维导图卡片覆盖

```typescript
// 1. 创建思维导图卡片
const originalCard = {
  id: 'test-mindmap-1',
  cardType: 'mind-map',
  name: '原始思维导图',
  content: { nodes: [{ id: 'node1', text: '节点1' }] },
  cardMap: { edges: [{ from: 'node1', to: 'node2' }] }
}

// 2. 导入并覆盖
await window.exportLocalApi.importCanvas({ importMode: 'skip' })
const result = await window.exportLocalApi.importCanvas({ importMode: 'overwrite' })

// 3. 验证数据完整性
assert(result.success === true)
const mindMapData = await AppDataSource.getRepository(SysCardMindMapEntity)
  .findOne({ where: { cardId: 'test-mindmap-1' } })
assert(mindMapData !== null)
```

## 数据库验证

### 验证删除顺序

```sql
-- 检查子表数据是否被正确删除
SELECT COUNT(*) as rich_text_count FROM sys_card_rich_text WHERE card_id = 'test-card-id';
SELECT COUNT(*) as drawboard_count FROM sys_card_drawboard WHERE card_id = 'test-card-id';
SELECT COUNT(*) as mindmap_count FROM sys_card_mind_map WHERE card_id = 'test-card-id';
SELECT COUNT(*) as multitable_count FROM sys_card_multi_table WHERE card_id = 'test-card-id';
SELECT COUNT(*) as file_count FROM sys_card_file WHERE card_id = 'test-card-id';
SELECT COUNT(*) as mark_count FROM sys_card_mark WHERE card_id = 'test-card-id';
SELECT COUNT(*) as mermaid_count FROM sys_card_mermaid WHERE card_id = 'test-card-id';

-- 检查主表数据是否被删除
SELECT COUNT(*) as base_count FROM sys_card_base WHERE id = 'test-card-id';
```

### 验证外键约束

```sql
-- 检查是否有孤立数据
SELECT 
  'sys_card_rich_text' as table_name,
  COUNT(*) as orphan_count
FROM sys_card_rich_text r
LEFT JOIN sys_card_base b ON r.card_id = b.id
WHERE b.id IS NULL

UNION ALL

SELECT 
  'sys_card_drawboard' as table_name,
  COUNT(*) as orphan_count
FROM sys_card_drawboard d
LEFT JOIN sys_card_base b ON d.card_id = b.id
WHERE b.id IS NULL

-- ... 其他子表检查
```

## 预期结果

1. **删除顺序正确**：子表数据先删除，主表数据后删除
2. **无外键约束错误**：删除过程中不会出现外键约束错误
3. **数据完整性**：覆盖后的数据完整且正确
4. **无孤立数据**：删除后不会留下孤立的子表数据
5. **事务一致性**：整个覆盖过程要么全部成功，要么全部失败

## 错误情况

### 如果删除顺序错误

- **外键约束错误**：`FOREIGN KEY constraint failed`
- **孤立数据**：子表数据存在但主表数据不存在
- **数据不一致**：部分数据被删除，部分数据保留

### 如果删除不完整

- **数据残留**：旧数据没有被完全删除
- **数据冲突**：新旧数据混合
- **性能问题**：数据库中存在无用数据

## 注意事项

1. **事务处理**：整个删除和创建过程应该在事务中进行
2. **错误回滚**：如果任何步骤失败，应该回滚所有操作
3. **性能考虑**：大量数据的删除可能影响性能
4. **日志记录**：记录删除操作的详细日志，便于调试
