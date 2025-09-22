# 卡片盒IPC服务重构文档

## 概述

本次重构将卡片盒模块中超过15行的IPC方法抽取到独立的service文件中，提高代码的可维护性和可读性。

## 重构内容

### 抽取的Service文件

1. **card-box-get-all.service.ts**
   - 功能：查询卡片盒列表
   - 接口：`card-box:getAll`
   - 原代码行数：35行

2. **card-box-update.service.ts**
   - 功能：更新卡片盒
   - 接口：`card-box:update`
   - 原代码行数：20行

3. **card-box-delete.service.ts**
   - 功能：删除卡片盒（软删除）
   - 接口：`card-box:delete`
   - 原代码行数：30行

4. **card-box-get-by-ids.service.ts**
   - 功能：批量获取卡片盒详情
   - 接口：`card-box:getByIds`
   - 原代码行数：20行

### 保留在index.ts的方法

1. **card-box:create** - 15行，符合保留条件
2. **card-box:getOne** - 12行，符合保留条件

## 文件结构

```
src/ipc/card-box/
├── index.ts                                    # 主接口文件
├── dto/
│   └── index.dto.ts                           # 数据传输对象
├── entities/
│   └── sys_card_box.entity.ts                 # 实体定义
└── service/                                   # 服务层
    ├── card-box-get-all.service.ts            # 查询列表服务
    ├── card-box-update.service.ts             # 更新服务
    ├── card-box-delete.service.ts             # 删除服务
    └── card-box-get-by-ids.service.ts         # 批量获取服务
```

## 重构优势

### 1. 代码组织
- **职责分离**：每个service文件专注于单一功能
- **可维护性**：便于单独修改和测试特定功能
- **可读性**：index.ts文件更加简洁，接口列表清晰

### 2. 开发效率
- **并行开发**：不同开发者可以同时修改不同的service
- **测试友好**：可以独立测试每个service方法
- **复用性**：service方法可以在其他地方复用

### 3. 代码质量
- **单一职责**：每个service只负责一个业务功能
- **错误处理**：统一的错误处理逻辑
- **类型安全**：完整的TypeScript类型定义

## 接口调用示例

### 重构前
```typescript
// index.ts中直接包含大量业务逻辑
ipcMain.handle('card-box:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardBoxDto) => {
  try {
    const cardBoxRepo = AppDataSource.getRepository(CardBoxEntity)
    const qb = cardBoxRepo.createQueryBuilder('cardBox')
      .where('cardBox.delFlag = :delFlag', { delFlag: 0 })
    // ... 大量查询逻辑
  } catch (error) {
    console.error('查询卡片盒列表失败:', error)
    throw error
  }
})
```

### 重构后
```typescript
// index.ts中简洁的接口定义
ipcMain.handle('card-box:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardBoxDto) => {
  return await getAllCardBoxes(query)
})
```

## 注意事项

1. **导入路径**：确保所有service文件的导入路径正确
2. **类型定义**：保持DTO和实体类型的完整性
3. **错误处理**：每个service都包含完整的错误处理逻辑
4. **日志记录**：保持原有的日志记录功能

## 测试建议

1. **功能测试**：验证所有接口功能正常
2. **错误测试**：测试各种异常情况
3. **性能测试**：确保重构后性能无下降
4. **集成测试**：测试与其他模块的集成

## 兼容性

- **接口兼容**：所有IPC接口签名保持不变
- **功能兼容**：业务逻辑完全一致
- **数据兼容**：数据库操作逻辑不变
- **错误兼容**：错误处理机制保持一致

## 后续优化

1. **单元测试**：为每个service添加单元测试
2. **文档完善**：为每个service添加详细注释
3. **性能优化**：进一步优化数据库查询
4. **代码规范**：统一代码风格和命名规范 