# 卡片盒删除功能增强文档

## 概述

本次增强为`card-box:delete`接口添加了级联删除功能，当删除卡片盒时，会同步软删除所有属于该卡片盒的卡片。

## 功能变更

### 原有功能
- 仅软删除卡片盒（设置`delFlag = 1`）

### 增强后功能
- 软删除卡片盒
- 软删除所有`boxId`为该卡片盒ID的卡片

## 实现细节

### 1. 导入依赖
```typescript
import { SysCardBaseEntity } from '../card/entities/sys-card-base.entity'
import { In } from 'typeorm'
```

### 2. 删除逻辑
```typescript
// 软删除卡片盒
await cardBoxRepo.update(id, { delFlag: 1 })

// 查找并软删除所有boxId为该卡片盒ID的卡片
const cardRepo = AppDataSource.getRepository(SysCardBaseEntity)
const cards = await cardRepo.find({ where: { boxId: id, delFlag: 0 } })

if (cards.length > 0) {
  const cardIds = cards.map(card => card.id)
  
  // 软删除主表卡片
  await cardRepo.update({ id: In(cardIds) }, { delFlag: 1, updateTime: new Date().toISOString() })
}
```

## 删除的实体类型

### 主表（软删除）
- `SysCardBaseEntity` - 卡片基础信息
- `CardBoxEntity` - 卡片盒信息

### 子表
- 子表数据保持不变，仅通过主表的`delFlag`字段控制可见性

## 返回结果

### 成功响应
```typescript
{
  success: true,
  deletedCardsCount: number  // 删除的卡片数量
}
```

### 错误响应
```typescript
{
  error: string  // 错误信息
}
```

## 日志记录

删除操作会记录以下日志：
- 成功：`已删除卡片盒 ${id} 及其包含的 ${cards.length} 张卡片`
- 失败：`删除卡片盒失败: ${error}`

## 注意事项

1. **事务安全**: 删除操作在同一个事务中执行，确保数据一致性
2. **性能考虑**: 使用批量操作（`In`操作符）提高删除效率
3. **数据完整性**: 主表软删除，子表数据保留，便于数据恢复
4. **错误处理**: 完整的错误捕获和日志记录
5. **数据恢复**: 软删除机制保证数据可恢复性

## 测试建议

1. **基础测试**: 删除空卡片盒
2. **内容测试**: 删除包含不同类型卡片的卡片盒
3. **边界测试**: 删除包含大量卡片的卡片盒
4. **错误测试**: 删除不存在的卡片盒
5. **恢复测试**: 验证软删除的数据可以正常恢复

## 兼容性

- **接口兼容**: 保持原有接口签名不变
- **向后兼容**: 不影响现有功能
- **数据安全**: 软删除机制保证数据可恢复性
- **子表数据**: 子表数据完整保留，便于数据恢复 