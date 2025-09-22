# 思维导图批量获取API文档

## 概述

本文档描述了思维导图批量获取详情的API接口，用于一次性获取多个思维导图的完整详情信息。

## API接口

### 批量获取思维导图详情

**接口名称**: `card:batchGetMindMapDetails`

**参数**:
- `ids`: `string[]` - 思维导图卡片ID数组

**返回值**: `{ [id: string]: MindMapDetail }`

**示例**:
```javascript
// 前端调用示例
const mindMapDetails = await window.electronAPI.invoke('card:batchGetMindMapDetails', [
  'card-id-1',
  'card-id-2',
  'card-id-3'
])
```

## 数据结构

### MindMapDetail

思维导图详情的数据结构：

```typescript
interface MindMapDetail {
  id: string                    // 思维导图ID
  elements: MindNode[]          // 思维导图节点数组
  lines: any[]                 // 连接线数组
  layout: string               // 布局类型，默认 'leftAndRight'
  theme: string                // 主题，默认 'vitalityOrange'
  rainBowLines: string         // 彩虹线样式，默认 'rose'
  width: number                // 宽度，默认 200
  height: number               // 高度，默认 200
  lineType: string             // 线条类型，默认 'POLYLINE'
  x: number                    // X坐标，默认 0
  y: number                    // Y坐标，默认 0
}
```

### MindNode

思维导图节点数据结构：

```typescript
interface MindNode {
  id: string                   // 节点ID
  text: string                 // 节点文本
  children?: MindNode[]        // 子节点数组
  [key: string]: any           // 其他属性
}
```

## 返回示例

```json
{
  "card-id-1": {
    "id": "card-id-1",
    "elements": [
      {
        "id": "node-1",
        "text": "根节点",
        "children": [
          {
            "id": "node-2",
            "text": "子节点1"
          },
          {
            "id": "node-3",
            "text": "子节点2"
          }
        ]
      }
    ],
    "lines": [],
    "layout": "leftAndRight",
    "theme": "vitalityOrange",
    "rainBowLines": "rose",
    "width": 800,
    "height": 600,
    "lineType": "POLYLINE",
    "x": 0,
    "y": 0
  },
  "card-id-2": {
    "id": "card-id-2",
    "elements": [],
    "lines": [],
    "layout": "leftAndRight",
    "theme": "vitalityOrange",
    "rainBowLines": "rose",
    "width": 200,
    "height": 200,
    "lineType": "POLYLINE",
    "x": 0,
    "y": 0
  }
}
```

## 错误处理

- 如果传入的ID数组为空，返回空对象 `{}`
- 如果某个思维导图的数据解析失败，会返回默认结构，并在控制台输出错误信息
- 如果某个ID对应的思维导图不存在，该ID不会出现在返回结果中

## 性能优化

- 使用批量查询减少数据库访问次数
- 一次性获取所有思维导图数据，避免N+1查询问题
- 对JSON解析进行错误处理，确保单个数据解析失败不影响整体结果

## 使用场景

1. **批量预览**: 在卡片列表中批量预览多个思维导图
2. **数据同步**: 批量获取思维导图数据进行同步操作
3. **批量操作**: 对多个思维导图进行批量编辑或处理
4. **缓存预热**: 预先加载多个思维导图数据到缓存中 