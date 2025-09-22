# 卡片集树形结构 API

## 接口概述

提供两个接口用于获取卡片集的树形结构：
- `card:getCardSetTree`: 通过单个 `boxId` 获取卡片集树形结构
- `card:getCardSetTreeByBoxIds`: 通过 `boxIds` 数组获取多个卡片盒的树形结构

## 代码结构

### 核心逻辑抽取
为了提高代码复用性和维护性，将通用的树形结构构建逻辑抽取到了 `src/ipc/card/util/card-tree.util.ts` 文件中：

- `buildCardTree()`: 通用的树形结构构建函数
- `queryCardSetData()`: 通用的卡片集数据查询函数
- `getCardSetTree()`: 单个boxId的树形结构获取函数
- `getCardSetTreeByBoxIds()`: 多个boxId的树形结构获取函数

### 文件结构
```
src/ipc/card/
├── index.ts                    # IPC接口定义
├── util/
│   └── card-tree.util.ts       # 通用工具函数
├── test-card-set-tree.ts       # 单个boxId测试
└── test-card-set-tree-by-boxids.ts  # 多个boxId测试
```

## 接口详情

### 接口名称
`card:getCardSetTree`

### 参数
- `boxId` (string): 卡片盒ID
  - `'all'`: 获取所有卡片集
  - `'none'`: 获取未分类的卡片集（boxId 为 null 或空字符串）
  - 其他值: 获取指定 boxId 的卡片集

### 返回值
返回树形结构的卡片集数组，每个节点包含以下字段：
- `id`: 卡片ID
- `name`: 卡片名称
- `text`: 卡片文本
- `description`: 卡片描述
- `coverUrl`: 封面URL
- `cardType`: 卡片类型（mind-map, draw-board, multi-table）
- `parentId`: 父级卡片ID
- `createTime`: 创建时间
- `updateTime`: 更新时间
- `extraData`: 额外数据
- `spaceId`: 空间ID
- `boxId`: 卡片盒ID
- `isCollect`: 是否收藏
- `tagIds`: 标签ID列表
- `children`: 子节点数组（如果有的话）

## 使用示例

### 前端调用示例

```typescript
// 获取指定boxId的卡片集树形结构
const tree = await window.electronAPI.invoke('card:getCardSetTree', 'box1')

// 获取所有卡片集树形结构
const allTree = await window.electronAPI.invoke('card:getCardSetTree', 'all')

// 获取未分类的卡片集树形结构
const unclassifiedTree = await window.electronAPI.invoke('card:getCardSetTree', 'none')
```

### 返回数据示例

```json
[
  {
    "id": "card-1",
    "name": "项目A",
    "text": "项目A的描述",
    "cardType": "mind-map",
    "parentId": null,
    "boxId": "box1",
    "createTime": "2024-01-01T00:00:00.000Z",
    "updateTime": "2024-01-01T00:00:00.000Z",
    "children": [
      {
        "id": "card-2",
        "name": "子项目A-1",
        "text": "子项目A-1的描述",
        "cardType": "multi-table",
        "parentId": "card-1",
        "boxId": "box1",
        "createTime": "2024-01-01T00:00:00.000Z",
        "updateTime": "2024-01-01T00:00:00.000Z",
        "children": [
          {
            "id": "card-3",
            "name": "孙项目A-1-1",
            "text": "孙项目A-1-1的描述",
            "cardType": "draw-board",
            "parentId": "card-2",
            "boxId": "box1",
            "createTime": "2024-01-01T00:00:00.000Z",
            "updateTime": "2024-01-01T00:00:00.000Z"
          }
        ]
      },
      {
        "id": "card-4",
        "name": "子项目A-2",
        "text": "子项目A-2的描述",
        "cardType": "mind-map",
        "parentId": "card-1",
        "boxId": "box1",
        "createTime": "2024-01-01T00:00:00.000Z",
        "updateTime": "2024-01-01T00:00:00.000Z"
      }
    ]
  },
  {
    "id": "card-5",
    "name": "项目B",
    "text": "项目B的描述",
    "cardType": "draw-board",
    "parentId": null,
    "boxId": "box1",
    "createTime": "2024-01-01T00:00:00.000Z",
    "updateTime": "2024-01-01T00:00:00.000Z"
  }
]
```

## 性能优化

### 查询优化
1. **一次性查询**: 使用单次查询获取所有相关数据，避免 N+1 查询问题
2. **索引优化**: 查询条件使用数据库索引字段（delFlag, cardType, boxId, parentId）
3. **字段选择**: 只查询必要的字段，减少数据传输量
4. **排序优化**: 按 createTime 排序，确保层级关系正确

### 内存优化
1. **递归构建**: 使用递归算法构建树形结构，内存使用效率高
2. **条件过滤**: 在数据库层面进行过滤，减少内存中的数据量
3. **空值处理**: 自动移除空的 children 属性，减少数据冗余

## 错误处理

接口会抛出以下错误：
- `获取卡片集树形结构失败`: 数据库查询或处理过程中发生错误

### 错误处理示例

```typescript
try {
  const tree = await window.electronAPI.invoke('card:getCardSetTree', 'box1')
  console.log('获取成功:', tree)
} catch (error) {
  console.error('获取失败:', error.message)
}
```

## 注意事项

1. **卡片类型限制**: 只返回 `mind-map`、`draw-board`、`multi-table` 类型的卡片
2. **删除标记**: 只返回 `delFlag = 0` 的卡片（未删除的卡片）
3. **层级深度**: 支持无限层级的树形结构
4. **性能考虑**: 对于大量数据的场景，建议添加分页或限制查询条件
5. **数据一致性**: 确保 parentId 引用的卡片存在且未被删除

## 测试

可以使用 `src/ipc/card/test-card-set-tree.ts` 文件进行测试：

```bash
# 运行测试
npx ts-node src/ipc/card/test-card-set-tree.ts
```

测试会创建示例数据，验证树形结构的正确性，并清理测试数据。 