# 文档文件流API

本文档描述了document模块新增的文件流读取IPC服务，用于读取文件内容并返回Buffer对象。

## 概述

文件流API提供了一个简单的功能：
- `document:readFileStream` - 读取文件流数据

这个API将整个文件读取为Buffer对象，可以直接用于PDF.js等库。

## API接口

### 读取文件流

**IPC通道**: `document:readFileStream`

**参数**:
```typescript
filePath: string  // 文件路径（支持user-data://、app://协议）
```

**返回值**:
```typescript
{
  success: boolean,        // 是否成功
  data?: Buffer,          // 文件Buffer数据
  error?: string         // 错误信息
}
```

**使用示例**:
```typescript
// 读取文件
const result = await window.electronAPI.invoke('document:readFileStream', 
  'user-data://documents/file.pdf'
)

if (result.success) {
  // 直接使用Buffer数据
  const fileBuffer = result.data
  
  // 将Buffer转换为ArrayBuffer（用于PDF.js）
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  )
  
  // 使用PDF.js加载文档
  const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise
  console.log('PDF页数:', pdfDoc.numPages)
}
```

## 特性

### 1. 协议支持
- `user-data://` - 用户数据目录
- `app://` - 应用程序目录
- 普通文件路径

### 2. 安全验证
- 路径解析和验证
- 文件存在性检查
- 权限检查
- 防止目录穿越攻击

### 3. 错误处理
- 详细的错误信息
- 优雅的异常处理

## 使用场景

### 1. 读取PDF文件
```typescript
const result = await window.electronAPI.invoke('document:readFileStream', 
  'user-data://documents/document.pdf'
)

if (result.success) {
  const fileBuffer = result.data
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  )
  const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise
}
```

### 2. 读取图片文件
```typescript
const result = await window.electronAPI.invoke('document:readFileStream', 
  'user-data://images/photo.jpg'
)

if (result.success) {
  const fileBuffer = result.data
  // 创建Blob URL用于显示图片
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' })
  const imageUrl = URL.createObjectURL(blob)
  document.getElementById('image').src = imageUrl
}
```

### 3. 读取文本文件
```typescript
const result = await window.electronAPI.invoke('document:readFileStream', 
  'user-data://documents/readme.txt'
)

if (result.success) {
  const fileBuffer = result.data
  const text = fileBuffer.toString('utf-8')
  console.log('文本内容:', text)
}
```

## 注意事项

1. **文件大小**: 建议读取的文件不超过100MB，避免内存问题
2. **路径安全**: 始终使用协议路径而非直接文件路径
3. **错误处理**: 始终检查返回的success字段
4. **内存管理**: 及时释放Buffer数据
5. **编码处理**: 文本文件可能需要指定正确的编码

## 错误代码

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| 文件不存在 | 路径错误或文件被删除 | 检查文件路径 |
| 不能读取目录 | 路径指向目录而非文件 | 使用正确的文件路径 |
| 没有读取权限 | 文件权限不足 | 检查文件权限 |
| 读取文件流失败 | 文件损坏或IO错误 | 检查文件完整性 | 