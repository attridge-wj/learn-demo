#!/usr/bin/env node

/**
 * 文档索引依赖包大小分析脚本
 * 用于分析各个依赖包对Electron安装包大小的影响
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 依赖包配置
const DEPENDENCIES = {
  // 文本文件处理
  'iconv-lite': {
    description: '字符编码转换',
    category: 'text',
    necessity: 'required',
    fileTypes: ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.sql', '.log', '.csv']
  },
  
  // PDF文档处理
  'pdf-parse': {
    description: 'PDF文本提取',
    category: 'pdf',
    necessity: 'required',
    fileTypes: ['.pdf'],
    dependencies: ['pdfjs-dist']
  },
  'pdfjs-dist': {
    description: 'PDF.js核心库',
    category: 'pdf',
    necessity: 'required',
    fileTypes: ['.pdf']
  },
  
  // Word文档处理
  'mammoth': {
    description: 'Word文档文本提取',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.doc', '.docx'],
    dependencies: ['sax', 'bluebird']
  },
  'sax': {
    description: 'XML解析器',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.doc', '.docx']
  },
  'bluebird': {
    description: 'Promise库',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.doc', '.docx']
  },
  
  // Excel文档处理
  'xlsx': {
    description: 'Excel文件处理',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.xls', '.xlsx'],
    dependencies: ['codepage', 'cfb']
  },
  'codepage': {
    description: '字符编码处理',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.xls', '.xlsx']
  },
  'cfb': {
    description: '复合文件二进制格式',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.xls', '.xlsx']
  },
  
  // PowerPoint文档处理
  'officegen': {
    description: 'PowerPoint文件处理',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.ppt', '.pptx'],
    dependencies: ['archiver', 'xmlbuilder']
  },
  'archiver': {
    description: '压缩文件处理',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.ppt', '.pptx']
  },
  'xmlbuilder': {
    description: 'XML构建器',
    category: 'office',
    necessity: 'required',
    fileTypes: ['.ppt', '.pptx']
  },
  
  // 图片处理
  'exif-reader': {
    description: '图片EXIF元数据提取',
    category: 'image',
    necessity: 'optional',
    fileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'],
    dependencies: ['buffer']
  }
}

// 获取包大小
function getPackageSize(packageName) {
  try {
    const packagePath = path.join(process.cwd(), 'node_modules', packageName)
    if (!fs.existsSync(packagePath)) {
      return { size: 0, error: 'Package not installed' }
    }
    
    const stats = fs.statSync(packagePath)
    return { size: stats.size, error: null }
  } catch (error) {
    return { size: 0, error: error.message }
  }
}

// 递归获取目录大小
function getDirectorySize(dirPath) {
  try {
    let totalSize = 0
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = fs.statSync(itemPath)
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(itemPath)
      } else {
        totalSize += stats.size
      }
    }
    
    return totalSize
  } catch (error) {
    return 0
  }
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 分析依赖包
function analyzeDependencies() {
  console.log('📦 文档索引依赖包大小分析\n')
  
  const results = {
    text: { packages: [], totalSize: 0 },
    pdf: { packages: [], totalSize: 0 },
    office: { packages: [], totalSize: 0 },
    image: { packages: [], totalSize: 0 }
  }
  
  let totalRequired = 0
  let totalOptional = 0
  
  for (const [packageName, config] of Object.entries(DEPENDENCIES)) {
    const { size, error } = getPackageSize(packageName)
    const category = config.category
    
    const packageInfo = {
      name: packageName,
      description: config.description,
      size: size,
      formattedSize: formatSize(size),
      necessity: config.necessity,
      fileTypes: config.fileTypes,
      error: error
    }
    
    results[category].packages.push(packageInfo)
    results[category].totalSize += size
    
    if (config.necessity === 'required') {
      totalRequired += size
    } else {
      totalOptional += size
    }
  }
  
  // 输出分析结果
  console.log('📋 分类统计:')
  console.log('─'.repeat(60))
  
  for (const [category, data] of Object.entries(results)) {
    const categoryNames = {
      text: '文本文件处理',
      pdf: 'PDF文档处理',
      office: 'Office文档处理',
      image: '图片文件处理'
    }
    
    console.log(`\n📁 ${categoryNames[category]}:`)
    console.log(`   总大小: ${formatSize(data.totalSize)}`)
    
    for (const pkg of data.packages) {
      const status = pkg.error ? '❌' : '✅'
      const necessity = pkg.necessity === 'required' ? '[必需]' : '[可选]'
      console.log(`   ${status} ${pkg.name} ${necessity} - ${pkg.formattedSize}`)
      console.log(`     用途: ${pkg.description}`)
      console.log(`     支持: ${pkg.fileTypes.join(', ')}`)
      if (pkg.error) {
        console.log(`     错误: ${pkg.error}`)
      }
    }
  }
  
  console.log('\n📊 总体统计:')
  console.log('─'.repeat(60))
  console.log(`必需依赖总大小: ${formatSize(totalRequired)}`)
  console.log(`可选依赖总大小: ${formatSize(totalOptional)}`)
  console.log(`完整依赖总大小: ${formatSize(totalRequired + totalOptional)}`)
  
  // 计算对Electron应用的影响
  const baseAppSize = 65 * 1024 * 1024 // 假设基础应用65MB
  const basicImpact = (totalRequired / baseAppSize * 100).toFixed(1)
  const fullImpact = ((totalRequired + totalOptional) / baseAppSize * 100).toFixed(1)
  
  console.log('\n📈 对Electron应用大小的影响:')
  console.log('─'.repeat(60))
  console.log(`基础应用大小: ${formatSize(baseAppSize)}`)
  console.log(`添加基础索引: ${formatSize(baseAppSize + totalRequired)} (增长 ${basicImpact}%)`)
  console.log(`添加完整索引: ${formatSize(baseAppSize + totalRequired + totalOptional)} (增长 ${fullImpact}%)`)
  
  return results
}

// 生成优化建议
function generateOptimizationSuggestions(results) {
  console.log('\n💡 优化建议:')
  console.log('─'.repeat(60))
  
  // 找出最大的包
  const allPackages = []
  for (const category of Object.values(results)) {
    allPackages.push(...category.packages)
  }
  
  const sortedPackages = allPackages
    .filter(pkg => !pkg.error)
    .sort((a, b) => b.size - a.size)
  
  console.log('\n🔍 最大的依赖包:')
  sortedPackages.slice(0, 5).forEach((pkg, index) => {
    console.log(`${index + 1}. ${pkg.name}: ${pkg.formattedSize}`)
  })
  
  console.log('\n⚡ 优化策略:')
  console.log('1. 按需加载: 只在需要时加载OCR功能')
  console.log('2. 插件化: 将大功能模块作为可选插件')
  console.log('3. 语言包优化: 只包含必要的OCR语言包')
  console.log('4. 云端处理: 将OCR功能迁移到云端服务')
  console.log('5. 替代方案: 使用系统命令行工具')
  
  // 生成配置建议
  console.log('\n⚙️ 推荐配置:')
  console.log('最小化配置 (仅文本+PDF): ~4MB')
  console.log('标准配置 (包含Office): ~10MB')
  console.log('完整配置 (包含OCR): ~25MB')
}

// 主函数
function main() {
  try {
    console.log('🚀 开始分析文档索引依赖包...\n')
    
    const results = analyzeDependencies()
    generateOptimizationSuggestions(results)
    
    console.log('\n✅ 分析完成!')
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = {
  analyzeDependencies,
  generateOptimizationSuggestions,
  DEPENDENCIES
} 