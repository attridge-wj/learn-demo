# 标签模块 (Tag Module)

## 概述

标签模块支持嵌套层级结构，允许创建父子标签关系。子标签会自动继承父标签的名称前缀，格式为 `父标签_子标签`。

## 目录结构

```
src/ipc/tag/
├── entities/                 # 实体定义
│   └── sys_tag.entity.ts    # 标签实体
├── dto/                     # 数据传输对象
│   └── index.dto.ts         # DTO定义
├── service/                 # 业务逻辑服务
│   ├── tag-create.service.ts        # 创建标签服务
│   ├── tag-get-all.service.ts       # 查询标签列表服务
│   ├── tag-get-one.service.ts       # 查询单个标签服务
│   ├── tag-update.service.ts        # 更新标签服务
│   ├── tag-delete.service.ts        # 删除标签服务
│   ├── tag-get-by-ids.service.ts    # 批量获取标签服务
│   ├── tag-set-top.service.ts       # 设置标签置顶服务
│   ├── tag-cancel-top.service.ts    # 取消标签置顶服务
│   └── tag-get-tree.service.ts      # 获取标签树服务
├── util/                    # 工具类
│   └── tag-hierarchy.util.ts        # 标签层级处理工具
├── index.ts                 # IPC接口定义
├── test-delete-hierarchy.ts # 删除功能测试脚本
└── README.md               # 模块说明文档
```

## 功能特性

### 1. 层级结构支持
- 支持无限层级的标签嵌套
- 自动生成层级路径名称
- 父标签名称变更时自动更新子标签

### 2. 自动命名规则
- 创建子标签时自动拼接父标签名称
- 更新父标签名称时递归更新所有子标签
- 格式：`父标签_子标签_孙标签`
- **修复**: 使用正则表达式确保正确提取原始名称，避免重复拼接

### 3. 树形结构查询
- 提供完整的标签树结构
- 支持按层级、类型、空间等条件过滤
- 便于前端展示层级关系

### 4. 递归删除功能
- 删除父标签时自动删除所有子标签
- 支持无限层级的递归删除
- 提供详细的删除统计信息
- 使用数据库事务确保数据一致性

### 5. 名称更新修复
- 修复了子标签名称更新时的重复拼接问题
- 使用正则表达式精确匹配父标签名称前缀
- 确保只替换开头的父标签名称，避免错误拼接

## 核心服务

### TagHierarchyUtil (标签层级工具类)
位于 `util/tag-hierarchy.util.ts`，提供以下功能：

- `generateFullTagName()`: 生成完整标签名称
- `getParentTagInfo()`: 获取父标签信息
- `updateChildrenTags()`: 递归更新子标签
- `deleteChildrenRecursively()`: 递归删除子标签
- `buildTagTree()`: 构建标签树结构

### 业务服务 (Service Layer)
每个服务负责特定的业务逻辑：

- **创建服务**: 处理标签创建，包括层级计算和名称生成
- **查询服务**: 提供多种查询方式（列表、单个、批量、树形）
- **更新服务**: 处理标签更新，包括子标签同步更新
- **删除服务**: 处理标签删除，包括递归删除子标签
- **置顶服务**: 处理标签置顶/取消置顶功能

## API 接口

### 基础操作
- `tag:create` - 创建标签
- `tag:getAll` - 查询标签列表
- `tag:getOne` - 查询单个标签
- `tag:update` - 更新标签
- `tag:delete` - 删除标签（包括所有子标签）

### 批量操作
- `tag:getByIds` - 批量获取标签

### 特殊功能
- `tag:setTop` - 设置标签置顶
- `tag:cancelTop` - 取消标签置顶
- `tag:getTree` - 获取标签树结构

## 数据库字段

### 新增字段
- `parentId`: 父标签ID
- `parentName`: 父标签名称
- `level`: 标签层级（0-顶级，1-一级子标签，2-二级子标签...）

### 字段说明
- `parentId`: 指向父标签的ID，顶级标签为NULL
- `parentName`: 父标签的完整名称，用于快速查询
- `level`: 标签在层级中的深度，从0开始

## 删除功能详解

### 递归删除机制
删除标签时会自动检查是否有子标签，如果有则一并删除：

```typescript
// 删除结果示例
{
  success: true,
  message: "成功删除标签 \"技术\" 及其 5 个子标签",
  deletedCount: 6,    // 总共删除的标签数量
  childrenCount: 5    // 子标签数量
}
```

### 删除流程
1. **检查标签存在性**: 验证要删除的标签是否存在
2. **检查子标签**: 查询是否有子标签
3. **递归删除**: 如果有子标签，递归删除所有子标签
4. **删除主标签**: 删除目标标签
5. **返回统计**: 返回删除的详细信息

### 安全特性
- 使用数据库事务确保数据一致性
- 提供详细的删除统计信息
- 支持删除前的确认检查
- 记录删除操作的日志

## 使用示例

### 创建层级标签
```typescript
// 创建顶级标签
const topTag = await createTag({
  name: '技术',
  type: 'category',
  spaceId: 'space-123'
}, userId)

// 创建子标签
const subTag = await createTag({
  name: '前端',
  parentId: topTag.id,
  type: 'category',
  spaceId: 'space-123'
}, userId)
// 结果: { name: '技术_前端', level: 1, parentId: 'top-tag-id', parentName: '技术' }
```

### 更新父标签名称
```typescript
// 更新父标签名称，子标签会自动更新
await updateTag('parent-id', {
  name: '编程技术' // 从"技术"改为"编程技术"
}, userId)
// 子标签自动变为: "编程技术_前端"
```

### 删除标签（包括子标签）
```typescript
// 删除标签及其所有子标签
const result = await deleteTag('tag-id')
console.log(result.message) // "成功删除标签 \"技术\" 及其 5 个子标签"
```

## 测试

### 运行测试脚本
```bash
# 运行删除功能测试
npx ts-node src/ipc/tag/test-delete-hierarchy.ts
```

### 测试内容
- 创建多层级标签结构
- 验证标签数量
- 测试递归删除功能
- 验证删除结果

## 注意事项

1. **层级限制**: 建议不要超过5级嵌套，避免名称过长
2. **事务处理**: 更新和删除操作使用数据库事务确保数据一致性
3. **性能考虑**: 大量子标签时，更新操作可能较慢，建议分批处理
4. **数据完整性**: 删除父标签时会递归删除所有子标签
5. **名称唯一性**: 同一父标签下的子标签名称不能重复
6. **删除安全**: 删除操作不可逆，建议在删除前进行确认
7. **大量数据**: 大量子标签时，删除操作可能需要较长时间

## 扩展性

该模块设计具有良好的扩展性：

- **服务层分离**: 每个功能独立成服务，便于维护和测试
- **工具类复用**: 层级处理逻辑封装在工具类中，便于复用
- **接口统一**: 所有IPC接口遵循统一的错误处理和返回格式
- **类型安全**: 使用TypeScript确保类型安全
- **测试覆盖**: 提供完整的测试脚本验证功能正确性 