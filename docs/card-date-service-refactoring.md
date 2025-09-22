# 日记日期卡片服务重构

## 概述

将日记日期卡片（card-date）的创建和更新逻辑抽取为公用服务，避免代码重复，提高可维护性。

## 问题背景

在多个文件中都有相同的日记日期卡片处理逻辑：
- `card-create.service.ts` - 创建日记时
- `card-update.service.ts` - 更新日记时  
- `card/index.ts` - 删除日记时

这些逻辑重复且容易出错，需要统一管理。

## 解决方案

### 1. 创建公用服务

创建 `src/ipc/card/service/card-date.service.ts` 文件，包含以下功能：

#### 核心函数

- **`updateCardDateForDiary(date, spaceId)`** - 更新或创建指定日期的card-date卡片
- **`removeCardDateIfNoDiary(date)`** - 删除空的日期卡片
- **`getDiariesByDate(date)`** - 获取指定日期的所有日记
- **`getCardDateByDate(date)`** - 获取指定日期的card-date卡片

#### 功能特性

- ✅ 自动创建或更新card-date卡片
- ✅ 同步更新extraData字段
- ✅ 错误处理和日志记录
- ✅ 类型安全
- ✅ 事务安全

### 2. 重构现有代码

#### card-create.service.ts
```typescript
// 重构前
if (card.cardType === 'diary') {
  const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
  const cardDate = await cardDateRepo.findOne({ where: { date: card.date, cardType: 'card-date' } })
  if (!cardDate) {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary', delFlag: 0 } });
    await cardDateRepo.save({ id: uuidv4(), name: card.date, date: card.date, cardType: 'card-date', spaceId: card.spaceId, extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) })
  } else {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary', delFlag: 0 } });
    await cardDateRepo.update({ id: cardDate.id }, { 
      extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) as any,
      updateTime: new Date().toISOString()
    })
  }
}

// 重构后
if (card.cardType === 'diary') {
  const result = await updateCardDateForDiary(card.date, card.spaceId)
  if (!result.success) {
    console.warn('更新日期卡片失败:', result.message)
  }
}
```

#### card-update.service.ts
```typescript
// 重构前
if (card.cardType === 'diary') {
  const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
  const cardDate = await cardDateRepo.findOne({ where: { date: card.date, cardType: 'card-date' } })
  if (!cardDate) {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary' } });
    await cardDateRepo.save({ id: uuidv4(), name: card.date, date: card.date, cardType: 'card-date', spaceId: card.spaceId, extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) })
  } else {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary' } });
    await cardDateRepo.update({ id: cardDate.id }, { 
      extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) as any,
      updateTime: new Date().toISOString()
    })
  }
}

// 重构后
if (card.cardType === 'diary') {
  const result = await updateCardDateForDiary(card.date, card.spaceId)
  if (!result.success) {
    console.warn('更新日期卡片失败:', result.message)
  }
}
```

#### card/index.ts (删除逻辑)
```typescript
// 重构前
if (card.cardType === 'diary') {
  const cardDateRepo = AppDataSource.getRepository(SysCardBaseEntity)
  const cardDate = await cardDateRepo.findOne({ where: { date: card.date, cardType: 'card-date' } })
  if (!cardDate) {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary', delFlag: 0 } });
    await cardDateRepo.save({ id: uuidv4(), name: card.date, date: card.date, cardType: 'card-date', extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) })
  } else {
    const currentDateDiary = await cardDateRepo.find({ where: { date: card.date, cardType: 'diary', delFlag: 0 } });
    await cardDateRepo.update({ id: cardDate.id }, { 
      extraData: JSON.stringify(currentDateDiary.map((item) => { return { id: item.id, name: item.name } })) as any,
      updateTime: new Date().toISOString()
    })
  }
}

// 重构后
if (card.cardType === 'diary') {
  const result = await updateCardDateForDiary(card.date, card.spaceId)
  if (!result.success) {
    console.warn('更新日期卡片失败:', result.message)
  }
}
```

## 优势

### 1. 代码复用
- 消除重复代码，减少维护成本
- 统一逻辑处理，避免不一致

### 2. 错误处理
- 统一的错误处理机制
- 详细的错误日志和返回信息

### 3. 类型安全
- 完整的TypeScript类型定义
- 编译时错误检查

### 4. 可扩展性
- 易于添加新功能
- 支持批量操作

### 5. 测试友好
- 独立的服务便于单元测试
- 清晰的接口定义

## 使用示例

### 基本使用
```typescript
import { updateCardDateForDiary } from './service/card-date.service'

// 更新日期卡片
const result = await updateCardDateForDiary('2024-01-01', 'space-123')
if (result.success) {
  console.log('日期卡片更新成功:', result.cardDateId)
} else {
  console.error('更新失败:', result.message)
}
```

### 获取日记列表
```typescript
import { getDiariesByDate } from './service/card-date.service'

// 获取指定日期的所有日记
const diaries = await getDiariesByDate('2024-01-01')
console.log('日记数量:', diaries.length)
```

### 删除空日期卡片
```typescript
import { removeCardDateIfNoDiary } from './service/card-date.service'

// 删除没有日记的日期卡片
const result = await removeCardDateIfNoDiary('2024-01-01')
console.log(result.message)
```

## 相关文件

- `src/ipc/card/service/card-date.service.ts` - 公用服务实现
- `src/ipc/card/service/card-create.service.ts` - 创建服务（已重构）
- `src/ipc/card/service/card-update.service.ts` - 更新服务（已重构）
- `src/ipc/card/index.ts` - IPC接口（已重构）

## 注意事项

1. **导入依赖**: 确保在使用服务的文件中正确导入
2. **错误处理**: 检查返回的success状态并处理错误
3. **类型安全**: 使用TypeScript类型检查确保参数正确
4. **性能考虑**: 服务内部已优化查询，避免重复数据库操作 