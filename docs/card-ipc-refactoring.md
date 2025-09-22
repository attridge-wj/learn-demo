# 卡片IPC模块重构文档

## 概述

本次重构将卡片IPC模块中代码量超过15行的IPC方法抽取到独立的service文件中，以提高代码的可维护性和可读性。

## 重构内容

### 1. 抽取的Service文件

#### 1.1 `card-get-all.service.ts`
- **功能**: 查询卡片列表
- **原方法**: `card:getAll`
- **代码行数**: 约140行 → 1行调用

#### 1.2 `card-create.service.ts`
- **功能**: 创建卡片及子表
- **原方法**: `card:create`
- **代码行数**: 约80行 → 1行调用

#### 1.3 `card-update.service.ts`
- **功能**: 更新卡片及子表
- **原方法**: `card:update`
- **代码行数**: 约120行 → 1行调用

#### 1.4 `card-batch-get.service.ts`
- **功能**: 批量获取卡片信息
- **原方法**: `card:batchGet`
- **代码行数**: 约60行 → 1行调用

#### 1.5 `card-find-page.service.ts`
- **功能**: 分页查询卡片
- **原方法**: `card:findPage`
- **代码行数**: 约180行 → 1行调用

#### 1.6 `card-statistics.service.ts`
- **功能**: 统计卡片数据
- **原方法**: `card:statistics`
- **代码行数**: 约50行 → 1行调用

#### 1.7 `card-find-relate-cards.service.ts`
- **功能**: 查询引用了指定卡片的列表
- **原方法**: `card:findRelateCards`
- **代码行数**: 约50行 → 1行调用

#### 1.8 `card-find-recycle-page.service.ts`
- **功能**: 回收站分页查询
- **原方法**: `card:findRecyclePage`
- **代码行数**: 约80行 → 1行调用

#### 1.9 `card-get-one.service.ts`
- **功能**: 查询单个卡片及子表内容
- **原方法**: `card:getOne`
- **代码行数**: 约30行 → 1行调用

### 2. 保留的简单方法

以下方法由于代码量较少（15行以内），保持原有实现：

- `card:findByDate` - 根据日期查询卡片
- `card:delete` - 删除卡片及子表
- `card:restore` - 恢复卡片
- `card:batchCreate` - 批量创建卡片
- `card:clearRecycle` - 清空回收站
- `card:batchDelete` - 批量删除卡片
- `card:findByIds` - 通过ID数组查询卡片列表
- `card:batchUpdate` - 批量更新卡片
- `card:getAttachmentCount` - 获取附件数量统计
- `card:findAllDate` - 查询所有日期卡片
- `card:getCardSetTree` - 通过boxId获取卡片集树形结构
- `card:getCardSetTreeByBoxIds` - 传入boxIds获取卡片集树形结构

## 重构效果

### 1. 代码结构优化
- **index.ts**: 从1016行减少到约250行，减少了75%以上
- **职责分离**: IPC接口定义与业务逻辑分离
- **可读性提升**: 每个service文件专注于单一功能

### 2. 维护性提升
- **模块化**: 每个复杂功能独立成文件
- **可测试性**: service方法可以独立测试
- **可复用性**: service方法可以在其他地方复用

### 3. 命名规范
- **Service文件命名**: 以接口名命名，如`card-get-all.service.ts`
- **方法命名**: 使用动词+名词的形式，如`getAllCards`

## 文件结构

```
src/ipc/card/
├── index.ts                           # IPC接口定义（简化后）
├── service/                           # 业务逻辑层
│   ├── card-tree.util.ts             # 卡片树形结构工具（已存在）
│   ├── card-get-all.service.ts       # 查询卡片列表
│   ├── card-create.service.ts        # 创建卡片
│   ├── card-update.service.ts        # 更新卡片
│   ├── card-batch-get.service.ts     # 批量获取卡片
│   ├── card-find-page.service.ts     # 分页查询卡片
│   ├── card-statistics.service.ts    # 统计卡片数据
│   ├── card-find-relate-cards.service.ts # 查询引用卡片
│   ├── card-find-recycle-page.service.ts # 回收站分页查询
│   └── card-get-one.service.ts       # 查询单个卡片
├── entities/                          # 实体定义
├── dto/                              # 数据传输对象
└── test-*.ts                         # 测试文件
```

## 使用示例

### 重构前
```typescript
ipcMain.handle('card:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardDto) => {
  // 140行复杂的查询逻辑
  const repo = AppDataSource.getRepository(SysCardBaseEntity)
  const queryBuilder = repo.createQueryBuilder('card')
  // ... 大量查询构建代码
})
```

### 重构后
```typescript
ipcMain.handle('card:getAll', async (_event: IpcMainInvokeEvent, query: QueryCardDto) => {
  return await getAllCards(query)
})
```

## 注意事项

1. **功能不变**: 所有重构都保持了原有功能的完整性
2. **接口兼容**: IPC接口签名保持不变
3. **错误处理**: 保持了原有的错误处理逻辑
4. **性能影响**: 无性能影响，只是代码组织方式的改变

## 后续优化建议

1. **进一步抽取**: 可以考虑将剩余的简单方法也抽取到service中
2. **统一错误处理**: 在service层统一错误处理机制
3. **添加日志**: 在service层添加详细的日志记录
4. **单元测试**: 为每个service方法编写单元测试 