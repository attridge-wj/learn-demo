# 收藏夹模块 (Collect Module)

## 概述

收藏夹模块支持无限层级嵌套结构，允许创建文件夹和收藏卡片。文件夹可以包含其他文件夹和卡片，形成树形结构。

## 目录结构

```
src/ipc/collect/
├── entities/                 # 实体定义
│   └── sys_collect.entity.ts # 收藏夹实体
├── dto/                     # 数据传输对象
│   └── index.dto.ts         # DTO定义
├── service/                 # 业务逻辑服务
│   ├── collect-create.service.ts        # 创建收藏服务
│   ├── collect-folder-create.service.ts # 创建收藏文件夹服务
│   ├── collect-update.service.ts        # 更新收藏服务
│   ├── collect-delete.service.ts        # 删除收藏服务
│   ├── collect-get-all.service.ts       # 查询收藏列表服务
│   └── collect-get-tree.service.ts      # 获取收藏树服务
├── util/                    # 工具类
│   └── collect-tree.util.ts             # 收藏夹树形处理工具
├── index.ts                 # IPC接口定义
└── README.md               # 模块说明文档
```

## 功能特性

### 1. 层级结构支持
- 支持无限层级的文件夹嵌套
- 文件夹可以包含其他文件夹和卡片
- 根据directory_id自动组装树形结构

### 2. 文件夹和卡片混合
- 支持创建文件夹（isFolder=1）
- 支持创建卡片收藏（isFolder=0）
- 文件夹优先显示，然后按名称排序

### 3. 树形结构查询
- 提供完整的收藏树结构
- 支持按多种条件过滤
- 便于前端展示层级关系

### 4. 递归删除功能
- 删除文件夹时自动删除所有子收藏
- 支持无限层级的递归删除
- 提供详细的删除统计信息
- 使用硬删除（物理删除），不保留删除记录

### 5. 卡片同步更新
- 卡片更新时自动同步更新收藏夹中对应卡片的名称和类型
- 在卡片模块中直接操作收藏夹实体，确保数据一致性
- 确保收藏夹中的卡片信息与卡片本身保持一致

### 6. 空间隔离支持
- 支持多空间环境，每个收藏都属于特定空间
- 空间间数据完全隔离，确保数据安全
- 所有操作都基于空间ID进行过滤和验证

## 核心服务

### CollectTreeUtil (收藏夹树形工具类)
位于 `util/collect-tree.util.ts`，提供以下功能：

- `buildCollectTree()`: 构建收藏夹树结构
- `deleteChildrenRecursively()`: 递归删除子收藏

### 业务服务 (Service Layer)
每个服务负责特定的业务逻辑：

- **创建服务**: 处理收藏创建，包括父目录验证
- **文件夹创建服务**: 专门处理文件夹的创建
- **更新服务**: 处理收藏更新，包括名称和目录变更
- **查询服务**: 提供列表和树形查询
- **删除服务**: 处理收藏删除，包括递归删除

## API 接口

### 基础操作
- `collect:create` - 创建收藏
- `collect:createFolder` - 创建收藏文件夹
- `collect:batchCreate` - 批量创建收藏
- `collect:update` - 更新收藏（包括文件夹名称）
- `collect:delete` - 删除收藏（包括所有子收藏）
- `collect:getAll` - 查询收藏列表
- `collect:getTree` - 获取收藏树结构

### 卡片相关操作
- `collect:deleteByCardId` - 通过cardId删除收藏
- `collect:checkByCardId` - 通过cardId查询是否被收藏

## 数据库字段

### 字段说明
- `spaceId`: 空间ID，必填字段
- `cardId`: 卡片ID，文件夹时为NULL
- `directoryId`: 父目录ID，顶级收藏时为NULL
- `cardType`: 卡片类型
- `subType`: 子类型
- `name`: 名称
- `url`: URL地址
- `isFolder`: 是否为文件夹（0-否，1-是）

## 删除功能详解

### 递归删除机制
删除文件夹时会自动检查是否有子收藏，如果有则一并删除：

```typescript
// 删除结果示例
{
  success: true,
  message: "成功删除文件夹 \"我的收藏\" 及其 5 个子收藏",
  deletedCount: 6,    // 总共删除的收藏数量
  childrenCount: 5    // 子收藏数量
}
```

### 删除流程
1. **检查收藏存在性**: 验证要删除的收藏是否存在
2. **检查子收藏**: 如果是文件夹，查询是否有子收藏
3. **递归删除**: 如果有子收藏，递归删除所有子收藏
4. **删除主收藏**: 删除目标收藏
5. **返回统计**: 返回删除的详细信息

## 使用示例

### 创建收藏文件夹
```typescript
// 创建顶级文件夹
const folder = await createCollectFolder({
  spaceId: 'space-123',
  name: '我的收藏',
  directoryId: null
}, userId)

// 创建子文件夹
const subFolder = await createCollectFolder({
  spaceId: 'space-123',
  name: '技术文档',
  directoryId: folder.id
}, userId)
```

### 批量创建收藏
```typescript
// 批量创建收藏
const collects = await batchCreateCollect([
  {
    spaceId: 'space-123',
    name: '文档1',
    cardId: 'card-1',
    cardType: 'document',
    subType: 'pdf',
    directoryId: folder.id
  },
  {
    spaceId: 'space-123',
    name: '文档2',
    cardId: 'card-2',
    cardType: 'document',
    subType: 'docx',
    directoryId: folder.id
  },
  {
    spaceId: 'space-123',
    name: '图片1',
    cardId: 'card-3',
    cardType: 'image',
    subType: 'png',
    directoryId: subFolder.id
  }
], userId)

console.log(collects.data.count) // 创建的收藏数量
console.log(collects.data.collects) // 创建的收藏列表
```

### 创建收藏卡片
```typescript
// 创建收藏卡片
const collect = await createCollect({
  spaceId: 'space-123',
  name: '重要文档',
  cardId: 'card-123',
  cardType: 'document',
  subType: 'pdf',
  directoryId: folder.id
}, userId)
```

### 更新收藏
```typescript
// 更新文件夹名称
const updatedCollect = await updateCollect('collect-id', {
  name: '新的文件夹名称'
}, userId)

// 更新收藏的父目录
const updatedCollect = await updateCollect('collect-id', {
  directoryId: 'new-parent-id'
}, userId)
```

### 获取收藏树
```typescript
// 获取完整的收藏树结构
const result = await getCollectTree({ spaceId: 'space-123' })
console.log(result.data.list) // 树形结构
console.log(result.data.stats) // 统计信息
```

### 删除收藏
```typescript
// 删除收藏及其所有子收藏
const result = await deleteCollect('collect-id')
console.log(result.message) // "成功删除文件夹 \"我的收藏\" 及其 5 个子收藏"
```

### 通过cardId删除收藏
```typescript
// 删除指定卡片的所有收藏
const result = await deleteCollectByCardId('card-123', 'space-123')
console.log(result.message) // "成功删除 2 个相关收藏"
```

### 检查卡片是否被收藏
```typescript
// 检查卡片是否被收藏
const result = await checkCollectByCardId('card-123', 'space-123')
console.log(result.data) // true 或 false
```

## 注意事项

1. **层级限制**: 建议不要超过5级嵌套，避免结构过于复杂
2. **数据完整性**: 删除文件夹时会递归删除所有子收藏
3. **删除安全**: 删除操作不可逆，建议在删除前进行确认
4. **性能考虑**: 大量子收藏时，删除操作可能需要较长时间
5. **名称唯一性**: 同一父目录下的收藏名称建议不重复
6. **空间隔离**: 所有操作都必须指定spaceId，确保数据隔离
7. **必填字段**: spaceId是必填字段，创建收藏时必须提供

## 前端调用方式

### 通过 preload 调用

前端可以通过 `window.collectApi` 调用收藏模块的所有功能：

```typescript
// 查询收藏列表
const result = await window.collectApi.queryAll({ spaceId: 'space-123' })
console.log(result.data.list) // 收藏列表

// 获取收藏树结构
const result = await window.collectApi.getTree({ spaceId: 'space-123' })
console.log(result.data.list) // 树形结构
console.log(result.data.stats) // 统计信息

// 创建收藏
const result = await window.collectApi.create({
  spaceId: 'space-123',
  name: '我的收藏',
  cardId: 'card-123',
  cardType: 'document',
  subType: 'pdf',
  directoryId: null
}, userId)

// 创建收藏文件夹
const result = await window.collectApi.createFolder({
  spaceId: 'space-123',
  name: '新文件夹',
  directoryId: null
}, userId)

// 批量创建收藏
const result = await window.collectApi.batchCreate([
  {
    spaceId: 'space-123',
    name: '文档1',
    cardId: 'card-1',
    cardType: 'document',
    subType: 'pdf',
    directoryId: 'folder-id'
  },
  {
    spaceId: 'space-123',
    name: '文档2',
    cardId: 'card-2',
    cardType: 'document',
    subType: 'docx',
    directoryId: 'folder-id'
  }
], userId)
console.log(result.data.count) // 创建的收藏数量

// 更新收藏
const result = await window.collectApi.update('collect-id', {
  name: '更新后的名称'
}, userId)

// 删除收藏
const result = await window.collectApi.delete('collect-id')
console.log(result.message) // 删除结果信息

// 通过cardId删除收藏
const result = await window.collectApi.deleteByCardId('card-123', 'space-123')
console.log(result.data.deletedCount) // 删除的收藏数量

// 检查卡片是否被收藏
const result = await window.collectApi.checkByCardId('card-123', 'space-123')
console.log(result.data) // true 或 false
```

### 错误处理

所有API调用都应该进行错误处理：

```typescript
try {
  const result = await window.collectApi.create({
    spaceId: 'space-123',
    name: '新收藏',
    cardId: 'card-123'
  }, userId)
  
  if (result.success) {
    console.log('创建成功:', result.data)
  } else {
    console.error('创建失败:', result.message)
  }
} catch (error) {
  console.error('API调用失败:', error)
}
```

## 扩展性

该模块设计具有良好的扩展性：

- **服务层分离**: 每个功能独立成服务，便于维护和测试
- **工具类复用**: 树形处理逻辑封装在工具类中，便于复用
- **接口统一**: 所有IPC接口遵循统一的错误处理和返回格式
- **类型安全**: 使用TypeScript确保类型安全 