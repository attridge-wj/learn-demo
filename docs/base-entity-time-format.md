# BaseEntity 时间格式说明

## 概述

BaseEntity 是所有实体类的基础类，提供了统一的时间字段处理。时间字段包括 `createTime`（创建时间）和 `updateTime`（更新时间）。

## 时间格式

### 存储格式
- 数据库中存储为完整的 ISO 格式：`2024-01-15T10:30:45.123Z`

### 显示格式
- 前端显示格式：`YYYY-MM-DD HH:mm:ss`
- 例如：`2024-01-15 18:30:45`

## 时间字段

### createTime（创建时间）
- **类型**: `@CreateDateColumn`
- **数据库字段**: `create_time`
- **说明**: 记录创建时间，自动生成
- **格式**: `YYYY-MM-DD HH:mm:ss`

### updateTime（更新时间）
- **类型**: `@UpdateDateColumn`
- **数据库字段**: `update_time`
- **说明**: 记录最后更新时间，自动更新
- **格式**: `YYYY-MM-DD HH:mm:ss`

## 自动更新机制

### 创建时
- `createTime` 和 `updateTime` 都会自动设置为当前时间

### 更新时
- `updateTime` 会自动更新为当前时间
- 通过 `@BeforeUpdate()` 钩子确保时间戳的准确性

## 使用示例

```typescript
// 创建实体时，时间字段会自动设置
const entity = new SomeEntity()
entity.id = 'test-123'
// createTime 和 updateTime 会自动设置为当前时间

// 更新实体时，updateTime 会自动更新
entity.someField = 'new value'
await repository.save(entity)
// updateTime 会自动更新为当前时间
```

## 时间转换器

BaseEntity 使用了自定义的时间转换器：

```typescript
transformer: {
  to: (value: Date) => new Date().toISOString(), // 存储为ISO格式
  from: (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
```

### 转换逻辑
1. **存储时** (`to`): 将 Date 对象转换为 ISO 字符串格式
2. **读取时** (`from`): 将 ISO 字符串转换为可读的日期时间格式

## 注意事项

1. **时区处理**: 时间以本地时区显示
2. **精度**: 时间精确到秒级别
3. **自动更新**: 实体更新时 `updateTime` 会自动更新
4. **格式统一**: 所有继承 BaseEntity 的实体都使用相同的时间格式

## 影响范围

这个时间格式变更会影响所有继承 BaseEntity 的实体类：

- `AiChatHistoryEntity`
- `AiChatSessionEntity`
- `AiPromptTemplateEntity`
- `CardBoxEntity`
- `SysCardBaseEntity`
- 以及其他所有实体类

所有实体的创建时间和更新时间现在都会精确到秒级别显示。 