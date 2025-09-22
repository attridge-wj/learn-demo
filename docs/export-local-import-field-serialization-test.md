# 画布副本导入字段序列化测试

## 测试目的

验证导入功能中对象字段的序列化处理是否正确，确保复杂数据结构能够正确导入到数据库。

## 需要序列化的字段

根据数据库实体定义，以下字段需要序列化为 JSON 字符串：

### 基础卡片字段 (sys_card_base)
- `extraData` - 额外数据
- `content` - 内容数据
- `viewList` - 视图列表
- `data` - 数据字段
- `attrList` - 属性列表
- `markList` - 标记列表
- `cardMap` - 卡片映射
- `config` - 配置数据

### 多维表字段 (sys_card_multi_table)
- `content` - 内容数据
- `data` - 数据字段
- `attrList` - 属性列表
- `viewList` - 视图列表

### 思维导图字段 (sys_card_mind_map)
- `content` - 内容数据
- `cardMap` - 卡片映射

### 画布字段 (sys_card_drawboard)
- `content` - 内容数据

## 测试用例

### 测试用例 1: 基础对象字段序列化

```typescript
// 测试数据
const testCardData = {
  id: 'test-card-1',
  name: '测试卡片',
  extraData: { key1: 'value1', key2: { nested: true } },
  content: { elements: [{ id: 'elem1', type: 'text' }] },
  viewList: [{ id: 'view1', name: '视图1' }],
  data: { tableData: [[1, 2, 3]] },
  attrList: [{ name: 'attr1', value: 'value1' }],
  markList: [{ id: 'mark1', text: '标记1' }],
  cardMap: { nodes: [], edges: [] },
  config: { theme: 'dark', layout: 'grid' }
}

// 执行导入
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 验证结果
assert(result.success === true)
// 验证数据库中的字段是否正确序列化
```

### 测试用例 2: 字符串字段处理

```typescript
// 测试已经是字符串的字段
const testCardData = {
  id: 'test-card-2',
  name: '测试卡片',
  extraData: '{"key": "value"}', // 已经是 JSON 字符串
  content: '{"elements": []}',   // 已经是 JSON 字符串
  viewList: '[]'                 // 已经是 JSON 字符串
}

// 执行导入
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 验证结果
assert(result.success === true)
// 验证字段没有被重复序列化
```

### 测试用例 3: 空值和未定义字段处理

```typescript
// 测试空值和未定义字段
const testCardData = {
  id: 'test-card-3',
  name: '测试卡片',
  extraData: null,
  content: undefined,
  viewList: [],
  data: {},
  attrList: null,
  markList: undefined
}

// 执行导入
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 验证结果
assert(result.success === true)
// 验证空值和未定义字段被正确处理
```

### 测试用例 4: 复杂嵌套对象序列化

```typescript
// 测试复杂嵌套对象
const testCardData = {
  id: 'test-card-4',
  name: '测试卡片',
  content: {
    elements: [
      {
        id: 'elem1',
        type: 'text',
        data: {
          text: 'Hello World',
          style: {
            fontSize: 14,
            color: '#000000',
            bold: true
          }
        }
      },
      {
        id: 'elem2',
        type: 'image',
        data: {
          src: 'image.jpg',
          alt: 'Image',
          metadata: {
            width: 100,
            height: 100,
            format: 'jpeg'
          }
        }
      }
    ],
    config: {
      layout: 'grid',
      spacing: 10,
      theme: {
        primary: '#007bff',
        secondary: '#6c757d'
      }
    }
  }
}

// 执行导入
const result = await window.exportLocalApi.importCanvas({
  importMode: 'skip'
})

// 验证结果
assert(result.success === true)
// 验证复杂嵌套对象被正确序列化
```

## 验证方法

### 1. 数据库验证

```sql
-- 检查序列化后的字段
SELECT id, name, extra_data, content, view_list, data, attr_list, mark_list, card_map, config 
FROM sys_card_base 
WHERE id = 'test-card-id';

-- 验证字段是否为有效的 JSON 字符串
SELECT 
  CASE 
    WHEN json_valid(extra_data) THEN 'valid' 
    ELSE 'invalid' 
  END as extra_data_valid,
  CASE 
    WHEN json_valid(content) THEN 'valid' 
    ELSE 'invalid' 
  END as content_valid
FROM sys_card_base 
WHERE id = 'test-card-id';
```

### 2. 程序验证

```typescript
// 验证序列化后的数据可以正确解析
const card = await getOneCard('test-card-id')
assert(typeof card.extraData === 'string')
assert(JSON.parse(card.extraData).key1 === 'value1')

assert(typeof card.content === 'string')
const content = JSON.parse(card.content)
assert(content.elements.length > 0)
```

## 预期结果

1. **对象字段序列化**：所有对象类型字段都被正确序列化为 JSON 字符串
2. **字符串字段保持**：已经是 JSON 字符串的字段不会被重复序列化
3. **空值处理**：null 和 undefined 字段被正确处理
4. **复杂结构支持**：嵌套对象和数组被正确序列化
5. **数据完整性**：序列化后的数据可以正确解析回原始对象

## 注意事项

1. **性能考虑**：大量复杂对象的序列化可能影响导入性能
2. **内存使用**：序列化过程会占用额外内存
3. **错误处理**：序列化失败时应该有适当的错误处理
4. **数据验证**：序列化后的数据应该通过 JSON 有效性验证
