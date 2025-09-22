# 卡片查询索引优化指南

## 概述

为了提高卡片查询性能，特别是LIKE查询的性能，我们为`sys_card_base`表的关键字段添加了索引。

## 已添加索引的字段

| 字段名 | 数据库列名 | 索引名称 | 用途 |
|--------|------------|----------|------|
| `text` | `text` | `IDX_sys_card_base_text` | 卡片文本内容搜索 |
| `name` | `name` | `IDX_sys_card_base_name` | 卡片名称搜索 |
| `description` | `description` | `IDX_sys_card_base_description` | 卡片描述搜索 |
| `markText` | `mark_text` | `IDX_sys_card_base_mark_text` | 标记文本搜索 |
| `extraData` | `extra_data` | `IDX_sys_card_base_extra_data` | 额外数据搜索 |

## 性能提升

这些索引将显著提升以下查询的性能：

```typescript
// 在card-find-page.service.ts中的查询
if (query.name) {
  queryBuilder.andWhere('(card.name LIKE :name OR card.text LIKE :name OR card.date LIKE :name OR card.description LIKE :name) OR card.markText LIKE :name',
    { name: `%${query.name}%` })
}

if (query.text) {
  queryBuilder.andWhere('card.text LIKE :text', { text: `%${query.text}%` })
}

if (query.extraData) {
  queryBuilder.andWhere('card.extraData LIKE :extraData', { extraData: `%${query.extraData}%` })
}
```

## 如何应用索引

### 方法1：使用TypeORM装饰器（推荐）

在实体类中已经添加了`@Index`装饰器：

```typescript
@Entity('sys_card_base')
@Index(['text'])
@Index(['name'])
@Index(['description'])
@Index(['markText'])
@Index(['extraData'])
export class SysCardBaseEntity extends BaseEntity {
  // ... 字段定义
}
```

### 方法2：手动执行SQL

```sql
-- 为text字段添加索引
CREATE INDEX IF NOT EXISTS "IDX_sys_card_base_text" ON "sys_card_base" ("text");

-- 为name字段添加索引
CREATE INDEX IF NOT EXISTS "IDX_sys_card_base_name" ON "sys_card_base" ("name");

-- 为description字段添加索引
CREATE INDEX IF NOT EXISTS "IDX_sys_card_base_description" ON "sys_card_base" ("description");

-- 为mark_text字段添加索引
CREATE INDEX IF NOT EXISTS "IDX_sys_card_base_mark_text" ON "sys_card_base" ("mark_text");

-- 为extra_data字段添加索引
CREATE INDEX IF NOT EXISTS "IDX_sys_card_base_extra_data" ON "sys_card_base" ("extra_data");
```

### 方法3：使用提供的脚本

```bash
# 运行索引添加脚本
npx ts-node src/database/add-indexes.ts
```

## 验证索引

### 查看现有索引

```sql
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='sys_card_base' 
AND name LIKE 'IDX_sys_card_base_%';
```

### 检查查询计划

```sql
EXPLAIN QUERY PLAN 
SELECT * FROM sys_card_base 
WHERE name LIKE '%test%' 
AND del_flag = 0;
```

## 性能测试

运行性能测试脚本：

```bash
npx ts-node src/database/add-indexes.ts
```

这将执行以下测试：
- 添加索引
- 验证索引创建
- 测试查询性能

## 注意事项

### 1. 索引维护
- 索引会占用额外的存储空间
- 插入、更新、删除操作会稍微变慢（需要维护索引）
- 但对于查询性能的提升通常超过这个成本

### 2. LIKE查询优化
- 索引对`LIKE '%keyword%'`（前后都有通配符）的效果有限
- 对`LIKE 'keyword%'`（前缀匹配）效果最好
- 对`LIKE '%keyword'`（后缀匹配）效果较差

### 3. 数据量考虑
- 对于小表（< 1000行），索引可能不会带来明显提升
- 对于大表（> 10000行），索引效果显著
- 建议根据实际数据量测试性能

## 监控和维护

### 1. 定期检查索引使用情况

```sql
-- 查看索引使用统计（SQLite不支持，仅供参考）
SELECT * FROM sqlite_stat1 WHERE tbl='sys_card_base';
```

### 2. 重建索引（如果需要）

```sql
-- 重建所有索引
REINDEX;
```

### 3. 删除不需要的索引

```sql
-- 删除特定索引
DROP INDEX IF EXISTS "IDX_sys_card_base_text";
```

## 最佳实践

1. **只索引必要的字段**：避免过度索引
2. **监控查询性能**：定期检查慢查询
3. **测试索引效果**：在应用前测试性能提升
4. **考虑复合索引**：如果经常同时查询多个字段
5. **定期维护**：重建索引以保持性能

## 相关文件

- `src/ipc/card/entities/sys-card-base.entity.ts` - 实体定义和索引装饰器
- `src/database/add-indexes.ts` - 索引添加脚本
- `src/database/migrations/add-simple-card-indexes.ts` - 数据库迁移
- `src/ipc/card/service/card-find-page.service.ts` - 查询服务 