# 文档索引功能依赖说明

## 需要安装的依赖包

为了支持文档索引和搜索功能，需要安装以下依赖包：

```bash
npm install pdf-parse mammoth xlsx exif-reader pptx2json
```

### 依赖包说明

1. **pdf-parse**: 用于提取PDF文档的文本内容
   - 版本: ^1.1.1
   - 功能: 解析PDF文件并提取纯文本内容

2. **mammoth**: 用于提取Word文档(.doc, .docx)的文本内容
   - 版本: ^1.6.0
   - 功能: 将Word文档转换为纯文本或HTML

3. **xlsx**: 用于提取Excel文档(.xls, .xlsx)的内容
   - 版本: ^0.18.5
   - 功能: 读取Excel文件并提取表格数据

4. **exif-reader**: 用于提取图片文件的EXIF元数据（大模型失败时的备选方案）
   - 版本: ^1.0.3
   - 功能: 从图片文件中提取拍摄信息、相机信息等

5. **pptx2json**: 用于处理PowerPoint文档(.pptx)
   - 版本: ^1.6.1
   - 功能: 读取PowerPoint文件并提取文本内容

## 安装命令

```bash
npm install pdf-parse@^1.1.1 mammoth@^1.6.0 xlsx@^0.18.5 exif-reader@^1.0.3 pptx2json@^1.6.1
```

## 大模型处理接口

### 预留接口

文档索引服务预留了大模型图片处理接口，支持外部大模型服务集成：

```typescript
// 大模型图片处理接口（预留，由外部实现）
async function processImageWithLLM(filePath: string): Promise<string> {
  // 这里应该调用外部的大模型服务
  // 可以通过事件总线、IPC或其他方式与外部大模型服务通信
  console.log('预留大模型处理接口，需要外部实现')
  
  // 临时返回空字符串，等待外部实现
  return ''
}
```

### 接口说明

1. **输入参数**: 图片文件路径
2. **返回结果**: 识别出的文字内容字符串
3. **错误处理**: 抛出异常时自动降级到EXIF元数据提取
4. **集成方式**: 可通过事件总线、IPC或其他方式与外部服务通信

## 功能特性

### 支持的文档类型

- **文本文件**: .txt, .md, .json, .xml, .html, .css, .js, .ts, .py, .java, .cpp, .c, .h, .sql, .log, .csv
- **PDF文档**: .pdf (支持按页面索引)
- **Word文档**: .doc, .docx (支持按页面索引)
- **PowerPoint文档**: .pptx (支持按页面索引，仅支持新版格式)
- **Excel文档**: .xls, .xlsx
- **图片文件**: .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg, .tiff, .tif (预留大模型文字识别)

### 页码索引功能

1. **按页面存储**: PDF、Word、PowerPoint文档按页面分别存储内容
   - 自动识别文档页面结构
   - 支持页面类型标记（text, table, image）
   - 记录页面内容长度

2. **精确页面匹配**: 搜索时能快速定位到具体页面
   - 显示匹配的页码
   - 提供页面内容片段
   - 支持多页面结果

3. **页面内容访问**: 提供页面级别的API接口
   - 获取文档所有页面
   - 获取指定页面内容
   - 支持页面导航

### 图片处理功能

1. **主要功能**: 预留大模型Vision API接口进行图片文字识别
   - 支持中文和英文识别
   - 自动清理识别结果
   - 提高识别准确率

2. **降级处理**: 当大模型失败时，自动降级到EXIF元数据提取
   - 提取相机信息、拍摄时间等
   - 确保索引过程的稳定性

### 协议支持

- **user-data://**: 用户数据目录协议
- **app://**: 应用程序协议
- **file://**: 普通文件系统路径

### 索引功能

1. **单个文件索引**: 支持索引单个文档文件
2. **目录批量索引**: 支持递归索引整个目录
3. **增量更新**: 自动检测文件修改并更新索引
4. **错误处理**: 记录索引失败的文件和错误信息
5. **FTS5全文搜索**: 使用SQLite FTS5提供高性能全文检索

### 搜索功能

1. **全文搜索**: 在文档内容中进行关键词搜索
2. **相关性排序**: 根据关键词匹配度排序结果
3. **片段提取**: 提取包含关键词的文本片段
4. **高亮显示**: 在搜索结果中高亮关键词
5. **预留大模型内容搜索**: 支持搜索图片中的文字内容

## 使用示例

### 索引文档

```typescript
// 索引单个文件
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://documents/example.pdf');

// 索引整个目录
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://documents/');

// 索引图片（预留大模型接口）
const result = await window.electronAPI.invoke('document:indexDocument', 'user-data://images/screenshot.png');
```

### 搜索文档

```typescript
// 搜索文档（包括图片中的文字）
const searchResult = await window.electronAPI.invoke('document:searchDocuments', {
  keyword: '关键词',
  limit: 50
});

// 搜索结果包含页码信息
searchResult.results.forEach(result => {
  console.log(`文件: ${result.fileName}`);
  if (result.pageNumber) {
    console.log(`匹配页面: 第${result.pageNumber}页 (共${result.totalPages}页)`);
    console.log(`页面片段: ${result.snippet}`);
  }
});
```

### 获取页面内容

```typescript
// 获取文档的所有页面
const pagesResult = await window.electronAPI.invoke('document:getDocumentPages', documentId);
if (pagesResult.success) {
  pagesResult.pages.forEach(page => {
    console.log(`第${page.pageNumber}页: ${page.contentLength}字符`);
  });
}

// 获取指定页面内容
const pageResult = await window.electronAPI.invoke('document:getDocumentPage', {
  documentId: 123,
  pageNumber: 5
});
if (pageResult.success) {
  console.log(`第${pageResult.page.pageNumber}页内容:`, pageResult.page.content);
}
```

### 获取统计信息

```typescript
// 获取索引统计
const stats = await window.electronAPI.invoke('document:getIndexStats');
```

## 性能优化

### FTS5全文搜索

1. **虚拟表**: 使用SQLite FTS5虚拟表存储全文内容
2. **倒排索引**: 提供极快的全文检索性能
3. **相关性排序**: 基于FTS5的rank算法进行智能排序
4. **内存优化**: 主表只存储元数据，FTS表存储搜索内容
5. **自动初始化**: FTS5表在数据库连接时自动创建

### 大模型优化

1. **异步处理**: 大模型识别在后台异步进行
2. **缓存机制**: 避免重复识别相同图片
3. **降级策略**: 大模型失败时自动使用元数据
4. **超时控制**: 可配置请求超时时间

## 数据库初始化

### 自动初始化流程

1. **数据库连接**: 在应用启动时自动连接数据库
2. **表结构同步**: TypeORM自动同步实体到数据库
3. **FTS5表创建**: 自动创建全文搜索虚拟表
4. **字段扩展**: 自动添加页码相关字段
5. **用户数据初始化**: 创建默认空间等用户数据

### 初始化顺序

```typescript
// 1. 数据库连接和表结构初始化
await initDatabase() // 包含FTS5表创建

// 2. 用户数据初始化
initData() // 创建默认空间等
```

## 注意事项

1. **大模型集成**: 需要外部实现大模型服务接口
2. **网络依赖**: 大模型功能需要网络连接
3. **API费用**: 使用大模型服务可能产生费用
4. **隐私安全**: 图片内容会发送到大模型服务，注意隐私保护
5. **性能影响**: 大模型处理可能较慢，建议异步处理

## 包大小分析

### 当前依赖包总大小
- **总计**: 约6MB
- **主要贡献**: xlsx (2MB) + pdf-parse (2MB) + pptx2json (1MB)

### 优化建议

1. **按需加载**: 将大型库改为动态导入
2. **插件化架构**: 将文档处理功能模块化
3. **替代方案**: 考虑使用更轻量的库 