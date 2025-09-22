# 标签层级功能使用示例

## 概述

标签系统现在支持嵌套层级结构，允许创建父子标签关系。子标签会自动继承父标签的名称前缀，格式为 `父标签_子标签`。

## 数据库字段

新增的字段：
- `parentId`: 父标签ID
- `parentName`: 父标签名称  
- `level`: 标签层级（0-顶级，1-一级子标签，2-二级子标签...）

## API 使用示例

### 1. 创建顶级标签

```typescript
// 创建顶级标签
const createTopLevelTag = async () => {
  const tagData = {
    name: '技术',
    type: 'category',
    spaceId: 'space-123',
    color: '#007bff'
  }
  
  const result = await window.electronAPI.invoke('tag:create', tagData, userId)
  console.log('创建的标签:', result)
  // 输出: { id: 'uuid', name: '技术', level: 0, parentId: null, parentName: null, ... }
}
```

### 2. 创建子标签

```typescript
// 在"技术"标签下创建子标签
const createSubTag = async () => {
  const parentTag = await window.electronAPI.invoke('tag:getOne', 'parent-tag-id')
  
  const tagData = {
    name: '前端',
    type: 'category',
    spaceId: 'space-123',
    color: '#28a745',
    parentId: parentTag.id
  }
  
  const result = await window.electronAPI.invoke('tag:create', tagData, userId)
  console.log('创建的子标签:', result)
  // 输出: { id: 'uuid', name: '技术_前端', level: 1, parentId: 'parent-tag-id', parentName: '技术', ... }
}
```

### 3. 创建多级子标签

```typescript
// 在"技术_前端"下创建子标签
const createNestedSubTag = async () => {
  const tagData = {
    name: 'React',
    type: 'category',
    spaceId: 'space-123',
    color: '#17a2b8',
    parentId: 'frontend-tag-id'
  }
  
  const result = await window.electronAPI.invoke('tag:create', tagData, userId)
  console.log('创建的多级子标签:', result)
  // 输出: { id: 'uuid', name: '技术_前端_React', level: 2, parentId: 'frontend-tag-id', parentName: '技术_前端', ... }
}
```

### 4. 查询标签列表

```typescript
// 查询所有顶级标签
const getTopLevelTags = async () => {
  const query = {
    spaceId: 'space-123',
    parentId: null // 查询顶级标签
  }
  
  const result = await window.electronAPI.invoke('tag:getAll', query)
  console.log('顶级标签:', result)
}

// 查询特定父标签下的子标签
const getSubTags = async (parentId: string) => {
  const query = {
    spaceId: 'space-123',
    parentId: parentId
  }
  
  const result = await window.electronAPI.invoke('tag:getAll', query)
  console.log('子标签:', result)
}
```

### 5. 获取标签树结构

```typescript
// 获取完整的标签树
const getTagTree = async () => {
  const query = {
    spaceId: 'space-123'
  }
  
  const result = await window.electronAPI.invoke('tag:getTree', query)
  console.log('标签树:', result)
  // 输出结构:
  // [
  //   {
  //     id: 'parent-id',
  //     name: '技术',
  //     level: 0,
  //     children: [
  //       {
  //         id: 'child-id',
  //         name: '技术_前端',
  //         level: 1,
  //         children: [
  //           {
  //             id: 'grandchild-id',
  //             name: '技术_前端_React',
  //             level: 2,
  //             children: []
  //           }
  //         ]
  //       }
  //     ]
  //   }
  // ]
}
```

### 6. 更新标签名称

```typescript
// 更新父标签名称，子标签会自动更新
const updateParentTagName = async () => {
  const updateData = {
    id: 'parent-tag-id',
    name: '编程技术' // 从"技术"改为"编程技术"
  }
  
  const result = await window.electronAPI.invoke('tag:update', 'parent-tag-id', updateData, userId)
  console.log('更新结果:', result)
  
  // 子标签会自动更新为:
  // "技术_前端" -> "编程技术_前端"
  // "技术_前端_React" -> "编程技术_前端_React"
}
```

**重要说明**: 标签名称更新逻辑已修复，现在会正确提取子标签的原始名称部分，然后重新拼接。

**更新前**:
- 父标签: "技术"
- 子标签: "技术_前端"
- 孙标签: "技术_前端_React"

**更新父标签为"编程技术"后**:
- 父标签: "编程技术"
- 子标签: "编程技术_前端" ✅ (正确)
- 孙标签: "编程技术_前端_React" ✅ (正确)

**修复的问题**: 之前的逻辑会导致重复拼接，现在使用正则表达式确保只替换开头的父标签名称，避免出现 "编程技术_技术_前端" 这样的错误结果。

### 7. 删除标签（包括所有子标签）

```typescript
// 删除标签（包括所有子标签）
const deleteTag = async (tagId: string) => {
  const result = await window.electronAPI.invoke('tag:delete', tagId)
  console.log('删除结果:', result)
  // 输出示例:
  // {
  //   success: true,
  //   message: "成功删除标签 \"技术\" 及其 5 个子标签",
  //   deletedCount: 6,
  //   childrenCount: 5
  // }
  
  // 会递归删除所有子标签，包括：
  // - 技术_前端
  // - 技术_前端_React
  // - 技术_前端_React_Hooks
  // - 技术_前端_Vue
  // - 技术_后端
  // - 技术_后端_Node.js
}
```

### 8. 删除前的确认检查

```typescript
// 在删除前检查是否有子标签
const checkBeforeDelete = async (tagId: string) => {
  // 获取标签详情
  const tag = await window.electronAPI.invoke('tag:getOne', tagId)
  
  // 查询子标签
  const children = await window.electronAPI.invoke('tag:getAll', {
    parentId: tagId
  })
  
  if (children.length > 0) {
    console.log(`警告：标签 "${tag.name}" 有 ${children.length} 个子标签，删除将一并删除所有子标签`)
    
    // 显示子标签列表
    console.log('将被删除的子标签:')
    children.forEach(child => {
      console.log(`- ${child.name}`)
    })
    
    // 可以在这里添加用户确认逻辑
    const confirmed = await showConfirmDialog(`确定要删除标签 "${tag.name}" 及其 ${children.length} 个子标签吗？`)
    
    if (confirmed) {
      return await window.electronAPI.invoke('tag:delete', tagId)
    } else {
      console.log('用户取消了删除操作')
      return null
    }
  } else {
    // 没有子标签，直接删除
    return await window.electronAPI.invoke('tag:delete', tagId)
  }
}

// 模拟确认对话框
const showConfirmDialog = async (message: string): Promise<boolean> => {
  // 这里应该调用实际的确认对话框
  return window.confirm(message)
}
```

## 自动命名规则

1. **创建子标签时**: 自动将父标签名称作为前缀
   - 父标签: "技术"
   - 子标签名称: "前端"
   - 最终名称: "技术_前端"

2. **更新父标签名称时**: 自动更新所有子标签
   - 原父标签: "技术"
   - 子标签: "技术_前端", "技术_前端_React"
   - 更新父标签为: "编程技术"
   - 子标签自动变为: "编程技术_前端", "编程技术_前端_React"

## 删除功能特性

### 递归删除
- 删除父标签时会自动删除所有子标签
- 支持无限层级的递归删除
- 使用数据库事务确保数据一致性

### 删除确认
- 返回详细的删除信息
- 包含删除的标签数量和子标签数量
- 提供友好的提示消息

### 删除结果示例
```typescript
// 删除有子标签的标签
{
  success: true,
  message: "成功删除标签 \"技术\" 及其 5 个子标签",
  deletedCount: 6,    // 总共删除的标签数量
  childrenCount: 5    // 子标签数量
}

// 删除没有子标签的标签
{
  success: true,
  message: "成功删除标签 \"技术\"",
  deletedCount: 1,
  childrenCount: 0
}
```

## 注意事项

1. 标签层级没有限制，但建议不要超过5级
2. 删除父标签时会递归删除所有子标签，请谨慎操作
3. 更新父标签名称时会自动更新所有子标签的名称和parentName字段
4. 查询时可以通过`level`字段过滤特定层级的标签
5. 树结构查询会返回完整的层级关系，便于前端展示
6. 删除操作不可逆，建议在删除前进行确认
7. 大量子标签时，删除操作可能需要较长时间 