# 文档索引功能依赖库分析

## 概述

文档索引功能使用了多个第三方库来支持不同文件类型的内容提取。以下是详细的依赖分析和包大小影响评估。

## 依赖库分类

### 1. 文本文件处理

#### 核心依赖
- **iconv-lite**: 字符编码转换
  - 用途: 处理不同编码的文本文件（UTF-8, GBK, GB2312, Big5等）
  - 包大小: ~200KB
  - 必要性: 必需，用于中文编码支持

#### 支持的文件类型
- `.txt`, `.md`, `.json`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.sql`, `.log`, `.csv`

### 2. PDF文档处理

#### 核心依赖
- **pdf-parse**: PDF文本提取
  - 用途: 从PDF文件中提取纯文本内容
  - 包大小: ~1.2MB
  - 依赖: pdfjs-dist (~2.5MB)
  - 总大小: ~3.7MB
  - 必要性: 必需，用于PDF文档索引

#### 支持的文件类型
- `.pdf`

### 3. Microsoft Office文档处理

#### Word文档 (.doc, .docx)
- **mammoth**: Word文档文本提取
  - 用途: 将Word文档转换为纯文本
  - 包大小: ~800KB
  - 依赖: sax (~100KB), bluebird (~200KB)
  - 总大小: ~1.1MB
  - 必要性: 必需，用于Word文档索引

#### Excel文档 (.xls, .xlsx)
- **xlsx**: Excel文件处理
  - 用途: 读取Excel文件并提取表格数据
  - 包大小: ~2.8MB
  - 依赖: codepage (~300KB), cfb (~200KB)
  - 总大小: ~3.3MB
  - 必要性: 必需，用于Excel文档索引

#### PowerPoint文档 (.ppt, .pptx)
- **officegen**: PowerPoint文件处理
  - 用途: 读取PowerPoint文件并提取文本内容
  - 包大小: ~1.5MB
  - 依赖: archiver (~400KB), xmlbuilder (~100KB)
  - 总大小: ~2MB
  - 必要性: 必需，用于PowerPoint文档索引

### 4. 图片文件处理

#### EXIF元数据提取
- **exif-reader**: 图片元数据提取
  - 用途: 提取图片的EXIF信息（大模型失败时的备选方案）
  - 包大小: ~50KB
  - 依赖: buffer (~20KB)
  - 总大小: ~70KB
  - 必要性: 可选，用于图片元数据提取

#### 大模型Vision API
- **无本地依赖**: 使用云端大模型服务
  - 用途: 图片文字识别和内容理解
  - 包大小: 0KB（无本地依赖）
  - 网络依赖: 需要API密钥和网络连接
  - 成本: API调用费用
  - 必要性: 可选，用于图片文字识别

## 包大小影响分析

### 基础依赖（必需）
```
iconv-lite:     200KB
pdf-parse:      1.2MB
pdfjs-dist:     2.5MB
mammoth:        800KB
sax:            100KB
bluebird:       200KB
xlsx:           2.8MB
codepage:       300KB
cfb:            200KB
officegen:      1.5MB
archiver:       400KB
xmlbuilder:     100KB
```

**基础依赖总计: ~10.3MB**

### 可选依赖
```
exif-reader:        70KB
```

**可选依赖总计: ~70KB**

### 完整依赖（包含图片处理）
**总计: ~10.37MB**

## 大模型服务对比

### 支持的Vision API服务

| 服务提供商 | 模型 | 识别准确率 | 成本 | 网络要求 | 特点 |
|-----------|------|-----------|------|----------|------|
| **OpenAI** | GPT-4 Vision | 极高 | 高 | 必需 | 支持多语言，理解能力强 |
| **Claude** | Claude 3 Vision | 极高 | 高 | 必需 | 安全性好，理解能力强 |
| **Gemini** | Gemini Pro Vision | 高 | 中等 | 必需 | 免费额度较大 |
| **通义千问** | Qwen-VL | 高 | 中等 | 必需 | 中文支持好，国内访问快 |
| **自定义** | 自部署模型 | 取决于模型 | 低 | 可选 | 完全控制，隐私性好 |

## 优化建议

### 1. 按需加载策略

#### 方案A: 基础版本（无图片处理）
```typescript
// 只包含基础文档处理功能
const BASIC_DEPENDENCIES = [
  'iconv-lite',
  'pdf-parse',
  'mammoth',
  'xlsx',
  'officegen'
]
// 包大小: ~10.3MB
```

#### 方案B: 完整版本（包含图片处理）
```typescript
// 包含所有功能，包括图片元数据提取
const FULL_DEPENDENCIES = [
  ...BASIC_DEPENDENCIES,
  'exif-reader'
]
// 包大小: ~10.37MB
```

### 2. 大模型配置优化

```typescript
// 大模型配置示例
const LLM_CONFIG = {
  enabled: true,
  provider: 'openai', // 或 'claude', 'gemini', 'qwen'
  apiKey: 'your-api-key',
  model: 'gpt-4-vision-preview',
  maxTokens: 1000,
  timeout: 30000,
  retryCount: 3
}
```

### 3. 成本控制策略

```typescript
// 图片处理策略
const IMAGE_PROCESSING_STRATEGY = {
  // 小图片使用大模型
  smallImages: 'llm',
  // 大图片跳过处理
  largeImages: 'skip',
  // 批量处理时限制并发
  maxConcurrent: 2,
  // 设置每日API调用限制
  dailyLimit: 100
}
```

## 安装包大小对比

### 当前Electron应用大小
- **基础应用**: ~50-80MB
- **添加基础文档索引**: +10.3MB = ~60-90MB
- **添加完整文档索引**: +10.37MB = ~60-90MB

### 相对增长
- **基础版本**: 增长约15-20%
- **完整版本**: 增长约15-20%

## 替代方案

### 1. 轻量级替代

#### PDF处理
- **替代**: 使用系统命令行工具（如pdftotext）
- **优势**: 不增加包大小
- **劣势**: 依赖系统环境

#### Office文档
- **替代**: 使用LibreOffice命令行工具
- **优势**: 免费，功能完整
- **劣势**: 需要安装LibreOffice

### 2. 云端处理

#### 图片文字识别
- **替代**: 使用云端Vision API服务
- **优势**: 不增加包大小，识别准确率高
- **劣势**: 需要网络连接，有API调用费用

### 3. 插件化架构

```typescript
// 插件化加载
interface DocumentProcessor {
  name: string
  supportedTypes: string[]
  process(filePath: string): Promise<string>
  size: number
  cost: number // API调用成本
}

const processors: DocumentProcessor[] = [
  {
    name: 'text',
    supportedTypes: ['.txt', '.md'],
    process: extractTextContent,
    size: 200, // KB
    cost: 0
  },
  {
    name: 'pdf',
    supportedTypes: ['.pdf'],
    process: extractPdfContent,
    size: 3700, // KB
    cost: 0
  },
  {
    name: 'image-llm',
    supportedTypes: ['.jpg', '.png'],
    process: processImageWithLLM,
    size: 0, // KB
    cost: 0.01 // 每张图片的API成本
  }
]
```

## 推荐配置

### 1. 最小化配置（推荐用于轻量级应用）
```json
{
  "enableLLM": false,
  "enablePowerPoint": false,
  "enableExcel": false
}
```
**包大小增加**: ~4MB

### 2. 标准配置（推荐用于一般应用）
```json
{
  "enableLLM": false,
  "enablePowerPoint": true,
  "enableExcel": true
}
```
**包大小增加**: ~10MB

### 3. 完整配置（推荐用于专业应用）
```json
{
  "enableLLM": true,
  "enablePowerPoint": true,
  "enableExcel": true,
  "llmProvider": "openai"
}
```
**包大小增加**: ~10MB + API成本

## 总结

1. **基础文档索引**（PDF、Word、文本）: 增加约10MB
2. **完整文档索引**（包含图片处理）: 增加约10MB
3. **移除OCR后包大小显著减少**（从25MB减少到10MB）
4. **大模型功能不增加包大小**，但需要API调用费用
5. **建议根据应用需求选择配置**，避免不必要的包大小增加
6. **可以考虑插件化架构**，让用户按需安装功能模块
7. **大模型服务提供更好的识别准确率**，但需要考虑成本和网络依赖 