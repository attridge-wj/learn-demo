import * as path from 'path'
import * as fs from 'fs-extra'
import { toUnicode } from 'idna-uts46'
import store from '../../utils/store'
import { app } from 'electron'

// 获取系统编码
function getSystemEncoding(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return 'gbk'
  } else if (platform === 'darwin') {
    return 'utf-8'
  } else {
    return 'utf-8'
  }
}

// 检测文件编码
export async function detectFileEncoding(buffer: Buffer): Promise<{ content: string, encoding: string }> {
  const platform = process.platform
  const defaultEncoding = getSystemEncoding()

  try {
    // 首先尝试 UTF-8
    const utf8Content = buffer.toString('utf-8')
    // 检查是否包含 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
    // 检查是否为有效的 UTF-8
    if (Buffer.from(utf8Content, 'utf-8').equals(buffer)) {
      return { content: utf8Content, encoding: 'utf-8' }
    }
  } catch {
    // UTF-8 解码失败，继续尝试其他编码
  }

  // 根据系统尝试不同的编码
  const encodings = ['utf-8', defaultEncoding]
  if (platform === 'win32') {
    encodings.push('gbk', 'gb2312', 'big5')
  } else if (platform === 'darwin') {
    encodings.push('mac-roman')
  }

  for (const encoding of encodings) {
    try {
      const iconv = require('iconv-lite')
      const content = iconv.decode(buffer, encoding)
      // 验证解码结果
      const reencoded = iconv.encode(content, encoding)
      if (reencoded.equals(buffer)) {
        return { content, encoding }
      }
    } catch {
      continue
    }
  }

  // 如果所有编码都失败，使用系统默认编码
  const iconv = require('iconv-lite')
  return {
    content: iconv.decode(buffer, defaultEncoding),
    encoding: defaultEncoding
  }
}

// 支持的文档类型
export const SUPPORTED_EXTENSIONS = {
  // 文档文件
  '.pdf': 'pdf',
  '.doc': 'word',
  '.docx': 'word',
  '.pptx': 'powerpoint', // 仅支持新版格式
  '.xls': 'excel',
  '.xlsx': 'excel',
}

// 所有支持的文件类型（包括代码、脚本、文本文件）
export const ALL_SUPPORTED_EXTENSIONS = new Set([
  // 文档文件
  '.pdf', '.doc', '.docx', '.pptx', '.xls', '.xlsx',
  
  // 纯文本文件
  '.txt', '.md', '.markdown', '.rst', '.asciidoc', '.adoc', '.org', '.tex', '.latex',
  '.log', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.properties', '.env', '.gitignore', '.dockerignore', '.editorconfig', '.eslintrc', '.prettierrc',
  
  // 代码文件
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  
  // Python
  '.py', '.pyw', '.pyc', '.pyo', '.pyd',
  
  // Java
  '.java', '.class', '.jar', '.war',
  
  // C/C++
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', '.c++', '.h++',
  
  // C#
  '.cs', '.csproj', '.sln',
  
  // Go
  '.go', '.mod', '.sum',
  
  // Rust
  '.rs', '.toml',
  
  // PHP
  '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',
  
  // Ruby
  '.rb', '.rbw', '.rake', '.gemspec',
  
  // Swift
  '.swift',
  
  // Kotlin
  '.kt', '.kts',
  
  // Scala
  '.scala', '.sc',
  
  // Dart
  '.dart',
  
  // R
  '.r', '.R', '.Rmd',
  
  // MATLAB
  '.m', '.mat',
  
  // Shell 脚本
  '.sh', '.bash', '.zsh', '.fish', '.csh', '.tcsh', '.ksh',
  
  // Windows 脚本
  '.bat', '.cmd', '.ps1', '.psm1', '.psd1',
  
  // 配置文件
  '.config', '.xml', '.yaml', '.yml', '.json', '.toml', '.ini', '.cfg', '.conf',
  '.properties', '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.eslintrc', '.prettierrc', '.babelrc', '.postcssrc', '.stylelintrc',
  
  // 构建文件
  '.makefile', '.cmake', '.cmake.in', '.gradle', '.maven', '.pom', '.build',
  '.sln', '.vcxproj', '.vcproj', '.xcodeproj', '.pbxproj',
  
  // 数据库
  '.sql', '.db', '.sqlite', '.sqlite3',
  
  // 网络相关
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  '.vue', '.svelte', '.jsx', '.tsx',
  
  // 数据文件
  '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.toml',
  
  // 日志文件
  '.log', '.out', '.err',
  
  // 文档文件
  '.readme', '.changelog', '.license', '.authors', '.contributors',
  '.todo', '.notes', '.memo', '.diary',
  
  // 其他文本格式
  '.rtf', '.odt', '.ods', '.odp', '.epub', '.mobi', '.azw',
  '.djvu', '.fb2', '.lit', '.prc', '.pdb', '.chm',
  
  // 系统文件
  '.hosts', '.fstab', '.passwd', '.shadow', '.group', '.gshadow',
  '.crontab', '.atab', '.anacrontab',
  
  // 网络协议文件
  '.htaccess', '.htpasswd', '.robots', '.sitemap',
  
  // 版本控制
  '.gitattributes', '.gitmodules', '.gitkeep', '.git',
  
  // 包管理
  '.package', '.bowerrc', '.npmrc', '.yarnrc', '.yarnrc.yml',
  '.composer', '.composer.json', '.package.json', '.bower.json',
  '.requirements.txt', '.Pipfile', '.Pipfile.lock', '.poetry.lock',
  '.Gemfile', '.Gemfile.lock', '.Podfile', '.Podfile.lock',
  '.Cargo.toml', '.Cargo.lock', '.go.mod', '.go.sum',
  '.pom.xml', '.build.gradle', '.settings.gradle',
  '.pubspec.yaml', '.pubspec.lock', '.mix.exs', '.mix.lock',
  
  // 测试文件
  '.test.js', '.test.ts', '.spec.js', '.spec.ts', '.test.py', '.spec.py',
  '.test.rb', '.spec.rb', '.test.php', '.spec.php',
  
  // 文档生成
  '.adoc', '.asciidoc', '.rst', '.tex', '.latex', '.bib',
  
  // 其他
  '.dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
  '.editorconfig', '.eslintrc', '.prettierrc', '.stylelintrc',
  '.babelrc', '.postcssrc', '.webpack.config', '.rollup.config',
  '.vite.config', '.nuxt.config', '.next.config', '.vue.config',
  '.angular.json', '.tsconfig.json', '.jsconfig.json',
  '.package-lock.json', '.yarn.lock', '.pnpm-lock.yaml',
  '.nvmrc', '.node-version', '.python-version', '.ruby-version',
  '.env.example', '.env.local', '.env.development', '.env.production',
  '.env.test', '.env.staging', '.env.prod', '.env.dev'
])

// 获取文件类型
export function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  // 如果在支持的文档类型中，返回对应的类型
  if (ext in SUPPORTED_EXTENSIONS) {
    return SUPPORTED_EXTENSIONS[ext as keyof typeof SUPPORTED_EXTENSIONS]
  }
  // 否则直接返回文件后缀（去掉点号）
  return ext.substring(1) || 'unknown'
}

// 判断是否为支持的文档类型
export function isSupportedDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  // 检查是否在所有支持的文件类型中
  return ALL_SUPPORTED_EXTENSIONS.has(ext)
}

// 提取文本文件内容
export async function extractTextContent(filePath: string, encoding: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath)
    const iconv = require('iconv-lite')
    return iconv.decode(buffer, encoding)
  } catch (error) {
    console.error('提取文本内容失败:', error)
    throw error
  }
}

// 提取PDF内容（按页面）
export async function extractPdfContent(filePath: string): Promise<{ pages: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages: number }> {
  try {
    // 使用 pdfjs-dist 库进行逐页解析
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
    const buffer = await fs.readFile(filePath)
    
    // 将Buffer转换为Uint8Array
    const uint8Array = new Uint8Array(buffer)
    
    // 加载PDF文档
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
    const pdfDocument = await loadingTask.promise
    
    const totalPages = pdfDocument.numPages
    const pages: Array<{ pageNumber: number, content: string, pageType: string }> = []
    
    console.log(`PDF文档总页数: ${totalPages}`)
    
    // 逐页提取文本内容
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      try {
        const page = await pdfDocument.getPage(pageNumber)
        const textContent = await page.getTextContent()
        
        // 提取文本内容
        const textItems = textContent.items.map((item: any) => item.str)
        const pageText = textItems.join(' ')
        
        // 清理文本（移除多余空格和换行）
        const cleanedText = pageText
          .replace(/\s+/g, ' ')  // 多个空格替换为单个
          .replace(/\n\s*\n/g, '\n')  // 多个换行替换为单个
          .trim()
        
        pages.push({
          pageNumber,
          content: cleanedText,
          pageType: 'text'
        })
        
        console.log(`第 ${pageNumber} 页解析完成，文本长度: ${cleanedText.length}`)
        
      } catch (pageError) {
        console.error(`解析第 ${pageNumber} 页失败:`, pageError)
        // 如果某页解析失败，添加空内容
        pages.push({
          pageNumber,
          content: '',
          pageType: 'text'
        })
      }
    }
    
    console.log(`PDF解析完成，成功解析 ${pages.length} 页`)
    
    return {
      pages,
      totalPages
    }
    
  } catch (error) {
    console.error('提取PDF内容失败:', error)
    
    // 如果pdfjs-dist失败，回退到pdf-parse
    try {
      console.log('pdfjs-dist解析失败，回退到pdf-parse')
      const pdfParse = require('pdf-parse')
      const buffer = await fs.readFile(filePath)
      const data = await pdfParse(buffer)
      
      const text = data.text || ''
      return {
        pages: [{ pageNumber: 1, content: text, pageType: 'text' }],
        totalPages: 1
      }
    } catch (fallbackError) {
      console.error('pdf-parse回退也失败:', fallbackError)
      throw error
    }
  }
}

// 提取Word文档内容（按页面）
export async function extractWordContent(filePath: string): Promise<{ pages: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages: number }> {
  try {
    // 使用 mammoth 库提取Word文档内容
    const mammoth = require('mammoth')
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value || ''
    
    // Word文档通常按段落分割，模拟页面
    const paragraphs = text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0)
    
    // 每3-5个段落作为一个页面
    const pagesPerPage = 4
    const pages = []
    
    for (let i = 0; i < paragraphs.length; i += pagesPerPage) {
      const pageContent = paragraphs.slice(i, i + pagesPerPage).join('\n\n')
      pages.push({
        pageNumber: Math.floor(i / pagesPerPage) + 1,
        content: pageContent,
        pageType: 'text'
      })
    }
    
    return {
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, content: text, pageType: 'text' }],
      totalPages: pages.length > 0 ? pages.length : 1
    }
  } catch (error) {
    console.error('提取Word内容失败:', error)
    throw error
  }
}

// 提取PowerPoint内容（按页面）
export async function extractPowerPointContent(filePath: string): Promise<{ pages: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages: number }> {
  try {
    console.log('使用 pptx2json 直接提取 PowerPoint 内容:', filePath)
    
    // 直接使用 pptx2json 作为主要方案
    return await extractPowerPointContentWithPptx2Json(filePath)
    
  } catch (error) {
    console.error('pptx2json 提取 PowerPoint 内容失败:', error)
    
    // 如果 pptx2json 失败，尝试 mammoth 作为备选
    try {
      console.log('pptx2json 失败，尝试 mammoth...')
      return await extractPowerPointContentWithMammoth(filePath)
    } catch (fallbackError) {
      console.error('mammoth 备选也失败:', fallbackError)
      
      // 最后的降级方案
      return {
        pages: [{ pageNumber: 1, content: 'PowerPoint文档（解析失败，但文件已识别）', pageType: 'text' }],
        totalPages: 1
      }
    }
  }
}

// 使用 pptx2json 作为主要方案
async function extractPowerPointContentWithPptx2Json(filePath: string): Promise<{ pages: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages: number }> {
  try {
    // 使用 pptx2json 库提取PowerPoint内容
    const PPTX2Json = require('pptx2json')
    const pptx2json = new PPTX2Json()
    
    // 使用 toJson 方法解析文件
    const json = await pptx2json.toJson(filePath)
    
    console.log('PowerPoint解析结果键:', Object.keys(json))
    
    const pages: Array<{ pageNumber: number, content: string, pageType: string }> = []
    
    // 查找所有幻灯片文件
    const slideFiles = Object.keys(json).filter(key => key.startsWith('ppt/slides/slide') && key.endsWith('.xml'))
    console.log('找到的幻灯片文件:', slideFiles)
    
    // 按文件名排序
    slideFiles.sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0')
      const bNum = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0')
      return aNum - bNum
    })
    
    // 智能文本识别函数 - 只提取有意义的文本内容
    function extractMeaningfulText(obj: any): string[] {
      const texts: string[] = []
      
      // 递归遍历对象
      function traverse(node: any, path: string[] = []) {
        if (typeof node === 'string') {
          // 字符串处理
          const text = node.trim()
          if (isMeaningfulText(text)) {
            texts.push(text)
          }
        } else if (Array.isArray(node)) {
          // 数组处理
          node.forEach((item, index) => {
            traverse(item, [...path, `[${index}]`])
          })
        } else if (node && typeof node === 'object') {
          // 对象处理
          for (const [key, value] of Object.entries(node)) {
            traverse(value, [...path, key])
          }
        }
      }
      
      traverse(obj)
      return texts
    }
    
    // 判断是否为有意义的文本
    function isMeaningfulText(text: string): boolean {
      if (!text || text.length < 2) return false
      
      // 过滤掉明显的元数据
      const excludePatterns = [
        // 字体和样式信息
        /^[A-Za-z\s]+_\w+\s+\d{12}\s*-\d+$/,  // 华文黑体_易方达 02010600040101010101 -122
        /^[A-Za-z\s]+\s+\d{12}\s*-\d+$/,      // 华文黑体 02010600040101010101 -122
        /^[A-Za-z\s]+\s+\d{6}$/,              // Arial 020B06
        /^[A-Za-z\s]+\s+\d{6}\s+\d{6}\s+\d{6}\s+\d{6}\s+\d{6}$/, // Arial 020B0604020202020204
        
        // 颜色代码
        /^[0-9A-F]{6}$/i,                     // FFFFFF, 3C3C3C
        /^[0-9A-F]{8}$/i,                     // 8位颜色代码
        
        // 坐标和尺寸
        /^-?\d+\s+-?\d+\s+\d+\s+\d+$/,        // 363151 211632 3946375 268047
        /^-?\d+\s+\d+$/,                       // -122, 1000
        
        // 样式属性
        /^(rect|square|accent\d+|flat|sng|ctr|dash|none|med|horz|just|base|arabicPeriod)$/i,
        
        // 语言代码
        /^(zh-CN|en-US|fr-FR|ja-JP|ko-KR)$/i,
        
        // 字体大小
        /^\d{4}$/,                             // 2300, 1200, 1000
        
        // GUID和ID
        /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
        /^[0-9A-F]{16,}$/i,                   // 长ID
        
        // 文件路径
        /^[A-Z]:\\.*/,                         // C:\Users\...
        /^\/.*/,                                // Unix路径
        
        // 其他元数据
        /^(tmRoot|title|textNoShape|Picture|Rectangle|TextBox)$/i,
        /^(indefinite|never|auto|bg1|tx1)$/i,
        /^\+[a-z-]+$/,                         // +mn-ea, +mn-lt
        /^[a-z]+[A-Z][a-z]+$/,                // camelCase样式
        
        // 新增：过滤更多元数据
        /^(ellipse|minor|RTL|barn|wipe|fade|entr|hold|seek|lin|num|style|visibility|visible|barn|outVertical)$/i,
        /^(迷你简菱心|冬青黑体简体中文 W3)$/i,
      ]
      
      // 检查是否匹配任何排除模式
      for (const pattern of excludePatterns) {
        if (pattern.test(text)) {
          return false
        }
      }
      
      // 检查是否包含太多数字和特殊字符
      const digitCount = (text.match(/\d/g) || []).length
      const specialCharCount = (text.match(/[^a-zA-Z0-9\u4e00-\u9fff\s]/g) || []).length
      
      // 如果数字或特殊字符占比过高，可能是元数据
      if (digitCount > text.length * 0.3 || specialCharCount > text.length * 0.4) {
        return false
      }
      
      // 检查是否包含中文字符（通常是有意义的文本）
      const hasChinese = /[\u4e00-\u9fff]/.test(text)
      
      // 检查是否包含有意义的英文单词
      const meaningfulWords = text.match(/\b[a-zA-Z]{3,}\b/g) || []
      const hasMeaningfulWords = meaningfulWords.some(word => 
        !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will', 'been', 'they', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'].includes(word.toLowerCase())
      )
      
      // 如果包含中文或有意义的英文单词，且长度适中，认为是有意义的文本
      return (hasChinese || hasMeaningfulWords) && text.length >= 2 && text.length <= 200
    }
    
    // 解析每个幻灯片
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i]
      const slide = json[slideFile]
      let slideContent = ''
      
      console.log(`\n=== 解析幻灯片 ${i + 1}: ${slideFile} ===`)
      
      try {
        // 使用智能文本识别提取有意义的文本
        const meaningfulTexts = extractMeaningfulText(slide)
        console.log(`幻灯片 ${i + 1} 找到的有意义文本:`, meaningfulTexts)
        
        // 组合所有有意义的文本内容
        slideContent = meaningfulTexts.join(' ').trim()
        
        // 如果还是没有内容，尝试查找特定的文本模式
        if (!slideContent) {
          console.log(`幻灯片 ${i + 1} 尝试查找特定文本模式...`)
          
          // 将整个幻灯片对象转为字符串，查找可能的文本模式
          const slideStr = JSON.stringify(slide)
          
          // 查找所有可能的文本内容（更宽松的模式）
          const textPatterns = [
            /"([^"]{3,})"/g,  // 3个字符以上的引号内容
            /_":\s*"([^"]+)"/g,  // _": "文本" 模式
            /text":\s*"([^"]+)"/g,  // text": "文本" 模式
          ]
          
          for (const pattern of textPatterns) {
            const matches = slideStr.match(pattern)
            if (matches) {
              console.log(`幻灯片 ${i + 1} 模式匹配:`, matches)
              for (const match of matches) {
                const text = match.replace(/^["_":\s]+|["\s]+$/g, '')
                if (isMeaningfulText(text)) {
                  slideContent += text + ' '
                }
              }
            }
          }
        }
        
        // 清理幻灯片内容
        slideContent = cleanSlideContent(slideContent)
        
        pages.push({
          pageNumber: i + 1,
          content: slideContent.trim() || `幻灯片 ${i + 1}（无文本内容）`,
          pageType: 'text'
        })
        
        console.log(`幻灯片 ${i + 1} 最终内容长度:`, slideContent.trim().length)
        if (slideContent.trim()) {
          console.log(`幻灯片 ${i + 1} 内容预览:`, slideContent.trim().substring(0, 100) + '...')
        }
        
      } catch (slideError) {
        console.error(`解析幻灯片 ${i + 1} 失败:`, slideError)
        pages.push({
          pageNumber: i + 1,
          content: `幻灯片 ${i + 1}（解析失败）`,
          pageType: 'text'
        })
      }
    }
    
    // 如果没有解析到内容，提供默认信息
    if (pages.length === 0) {
      console.log('未找到任何幻灯片，使用降级方案')
      pages.push({
        pageNumber: 1,
        content: 'PowerPoint文档（无法解析内容）',
        pageType: 'text'
      })
    }
    
    console.log(`\nPowerPoint解析完成，共 ${pages.length} 页`)
    
    return {
      pages,
      totalPages: pages.length
    }
    
  } catch (error) {
    console.error('提取PowerPoint内容失败:', error)
    throw error
  }
}

// 清理幻灯片内容
function cleanSlideContent(content: string): string {
  if (!content) return ''
  
  let cleanedContent = content
  
  // 1. 过滤所有 XML 命名空间和架构引用
  cleanedContent = cleanedContent.replace(/https?:\/\/[^\s]+/g, '')
  
  // 2. 过滤重复的字体名称
  const fontPatterns = [
    /(华文黑体_易方达\s*){2,}/g,
    /(华文黑体\s*){2,}/g,
    /(Arial\s*){2,}/g,
    /(黑体\s*){2,}/g,
    /(华文细黑\s*){2,}/g,
    /(Arial Narrow\s*){2,}/g,
    /(腾讯体 W7\s*){2,}/g,
    /(微软雅黑\s*){2,}/g,
    /(迷你简菱心\s*){2,}/g,
    /(冬青黑体简体中文 W3\s*){2,}/g,
  ]
  
  fontPatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, (match) => {
      const fonts = match.trim().split(/\s+/)
      return fonts[0] // 只保留第一个
    })
  })
  
  // 3. 过滤样式标识和占位符
  const stylePatterns = [
    /\b(TextBox|Title|Content Placeholder|Rectangle|Picture|图示|图片|标题|内容占位符|矩形|图片|图示)\s*\d*\b/gi,
    /\b(rect|square|accent\d+|flat|sng|ctr|dash|none|med|horz|just|base|black|ellipse|minor|RTL|barn|wipe|fade|entr|hold|seek|lin|num|style|visibility|visible|barn|outVertical)\b/gi,
  ]
  
  stylePatterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '')
  })
  
  // 4. 清理多余的空格和换行
  cleanedContent = cleanedContent
    .replace(/\s+/g, ' ')  // 多个空格替换为单个
    .replace(/\n\s*\n/g, '\n')  // 多个换行替换为单个
    .trim()
  
  // 5. 过滤掉只包含单个单词或数字的行
  const lines = cleanedContent.split('\n')
  const filteredLines = lines.filter(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return false
    
    // 过滤掉只包含字体名称的行
    if (/^(华文黑体_易方达|华文黑体|Arial|黑体|华文细黑|Arial Narrow|腾讯体 W7|微软雅黑|迷你简菱心|冬青黑体简体中文 W3)\s*$/i.test(trimmedLine)) {
      return false
    }
    
    // 过滤掉只包含单个单词、数字或特殊字符的行
    if (/^[A-Za-z\s]+$/.test(trimmedLine) && trimmedLine.split(/\s+/).length <= 2) return false
    if (/^\d+$/.test(trimmedLine)) return false
    if (/^[^\u4e00-\u9fff]+$/.test(trimmedLine) && trimmedLine.length < 10) return false
    
    return true
  })
  
  cleanedContent = filteredLines.join('\n')
  
  // 6. 最终清理
  cleanedContent = cleanedContent
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // 最多保留两个连续换行
    .replace(/^\s+|\s+$/gm, '')  // 去除每行首尾空格
    .trim()
  
  return cleanedContent
}

// 使用 mammoth 作为备选方案
async function extractPowerPointContentWithMammoth(filePath: string): Promise<{ pages: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages: number }> {
  try {
    console.log('使用 mammoth 作为备选方案提取 PowerPoint 内容:', filePath)
    
    // 使用 mammoth 库提取 PowerPoint 内容
    const mammoth = require('mammoth')
    
    // 读取文件
    const buffer = await fs.readFile(filePath)
    
    // 使用 mammoth 提取文本内容
    const result = await mammoth.extractRawText({ buffer })
    const rawText = result.value || ''
    
    console.log('mammoth 提取的原始文本长度:', rawText.length)
    
    // 智能清理 PowerPoint 文本内容
    const cleanedText = cleanPowerPointText(rawText)
    console.log('清理后的文本长度:', cleanedText.length)
    
    // 尝试按页面分割
    let pages: Array<{ pageNumber: number, content: string, pageType: string }> = []
    
    // 按段落分割
    const paragraphs = cleanedText.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0)
    
    // 每3-5个段落作为一个页面
    const pagesPerPage = 4
    for (let i = 0; i < paragraphs.length; i += pagesPerPage) {
      const pageContent = paragraphs.slice(i, i + pagesPerPage).join('\n\n')
      pages.push({
        pageNumber: Math.floor(i / pagesPerPage) + 1,
        content: pageContent,
        pageType: 'text'
      })
    }
    
    // 如果没有解析到内容，提供默认信息
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        content: cleanedText || 'PowerPoint文档（无法解析内容）',
        pageType: 'text'
      })
    }
    
    return {
      pages,
      totalPages: pages.length
    }
    
  } catch (error) {
    console.error('mammoth 提取 PowerPoint 内容失败:', error)
    throw error
  }
}

// 智能清理 PowerPoint 文本内容，过滤冗余信息
function cleanPowerPointText(text: string): string {
  if (!text) return ''
  
  let cleanedText = text
  
  // 1. 过滤所有 XML 命名空间和架构引用（更激进）
  cleanedText = cleanedText.replace(/https?:\/\/[^\s]+/g, '')
  
  // 2. 过滤重复的字体名称（更激进，连续出现多次的相同字体）
  const fontPatterns = [
    /(华文黑体_易方达\s*){2,}/g,
    /(华文黑体\s*){2,}/g,
    /(Arial\s*){2,}/g,
    /(黑体\s*){2,}/g,
    /(华文细黑\s*){2,}/g,
    /(Arial Narrow\s*){2,}/g,
    /(腾讯体 W7\s*){2,}/g,
    /(华文细黑\s*){2,}/g,
  ]
  
  fontPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, (match) => {
      const fonts = match.trim().split(/\s+/)
      return fonts[0] // 只保留第一个
    })
  })
  
  // 3. 过滤样式标识和占位符（更全面）
  const stylePatterns = [
    /\b(TextBox|Title|Content Placeholder|Rectangle|Picture|图示|图片)\s*\d*\b/gi,
    /\b(标题|内容占位符|矩形|图片|图示)\s*\d*\b/g,
    /\b(rect|square|accent\d+|flat|sng|ctr|dash|none|med|horz|just|base|black)\b/gi,
  ]
  
  stylePatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })
  
  // 4. 过滤重复的架构引用（更全面）
  const schemaPatterns = [
    /(http:\/\/schemas\.microsoft\.com\/office\/powerpoint\/2010\/main\s*){2,}/g,
    /(http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/main\s*){2,}/g,
    /(http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\s*){2,}/g,
    /(http:\/\/schemas\.openxmlformats\.org\/presentationml\/2006\/main\s*){2,}/g,
    /(http:\/\/schemas\.microsoft\.com\/office\/drawing\/2010\/main\s*){2,}/g,
    /(http:\/\/schemas\.microsoft\.com\/office\/mac\/drawingml\/2011\/main\s*){2,}/g,
    /(http:\/\/schemas\.microsoft\.com\/office\/drawing\/2014\/main\s*){2,}/g,
    /(http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/diagram\s*){2,}/g,
  ]
  
  schemaPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })
  
  // 5. 激进清理：过滤掉只包含字体名称的行
  const lines = cleanedText.split('\n')
  const filteredLines = lines.filter(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return false
    
    // 过滤掉只包含字体名称的行
    if (/^(华文黑体_易方达|华文黑体|Arial|黑体|华文细黑|Arial Narrow|腾讯体 W7)\s*$/i.test(trimmedLine)) {
      return false
    }
    
    // 过滤掉只包含单个单词、数字或特殊字符的行
    if (/^[A-Za-z\s]+$/.test(trimmedLine) && trimmedLine.split(/\s+/).length <= 2) return false
    if (/^\d+$/.test(trimmedLine)) return false
    if (/^[^\u4e00-\u9fff]+$/.test(trimmedLine) && trimmedLine.length < 10) return false
    
    return true
  })
  
  cleanedText = filteredLines.join('\n')
  
  // 6. 清理多余的空格和换行
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')  // 多个空格替换为单个
    .replace(/\n\s*\n/g, '\n')  // 多个换行替换为单个
    .trim()
  
  // 7. 最终清理：去除每行首尾空格，最多保留两个连续换行
  cleanedText = cleanedText
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // 最多保留两个连续换行
    .replace(/^\s+|\s+$/gm, '')  // 去除每行首尾空格
    .trim()
  
  // 8. 后处理：清理掉仍然存在的冗余字体名称
  // 使用更智能的方法：如果一行中字体名称占比过高，过滤掉
  const finalLines = cleanedText.split('\n')
  const finalFilteredLines = finalLines.filter(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return false
    
    // 计算字体名称在行中的占比
    const fontNames = ['华文黑体_易方达', '华文黑体', 'Arial', '黑体', '华文细黑', 'Arial Narrow', '腾讯体 W7']
    let fontCount = 0
    let totalWords = trimmedLine.split(/\s+/).length
    
    fontNames.forEach(font => {
      const regex = new RegExp(font, 'gi')
      const matches = trimmedLine.match(regex)
      if (matches) {
        fontCount += matches.length
      }
    })
    
    // 如果字体名称占比超过50%，过滤掉这行
    if (fontCount > 0 && fontCount / totalWords > 0.5) {
      return false
    }
    
    return true
  })
  
  cleanedText = finalFilteredLines.join('\n')
  
  // 9. 最终清理：去除多余空格和换行
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
  
  return cleanedText
}

// 提取Excel内容
export async function extractExcelContent(filePath: string): Promise<string> {
  try {
    // 使用 xlsx 库提取Excel内容
    const XLSX = require('xlsx')
    const workbook = XLSX.readFile(filePath)
    const content: string[] = []
    
    workbook.SheetNames.forEach((sheetName: string) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      jsonData.forEach((row: any[]) => {
        if (row && row.length > 0) {
          content.push(row.join('\t'))
        }
      })
    })
    
    return content.join('\n')
  } catch (error) {
    console.error('提取Excel内容失败:', error)
    throw error
  }
}

// 提取图片内容（使用大模型处理）
export async function extractImageContent(filePath: string): Promise<string> {
  try {
    console.log('开始使用大模型处理图片:', filePath)
    
    // 预留大模型处理接口
    const imageContent = await processImageWithLLM(filePath)
    
    console.log('大模型处理完成，提取文字长度:', imageContent.length)
    
    // 如果大模型没有识别到文字，返回图片描述
    if (!imageContent || imageContent.length < 5) {
      return '图片文件（大模型未识别到文字内容）'
    }
    
    return imageContent
  } catch (error) {
    console.error('大模型处理失败:', error)
    
    // 大模型失败时的降级处理
    try {
      // 尝试使用 exif-reader 提取基本信息作为备选
      const exifReader = require('exif-reader')
      const fs = require('fs')
      
      return new Promise((resolve) => {
        fs.readFile(filePath, (err: any, data: Buffer) => {
          if (err) {
            resolve('图片文件（无法读取内容）')
            return
          }
          
          try {
            const exif = exifReader(data)
            const metadata: string[] = []
            
            if (exif && exif.Image) {
              if (exif.Image.Make) metadata.push(`相机: ${exif.Image.Make}`)
              if (exif.Image.Model) metadata.push(`型号: ${exif.Image.Model}`)
              if (exif.Image.DateTime) metadata.push(`时间: ${exif.Image.DateTime}`)
            }
            
            resolve(metadata.length > 0 ? metadata.join(', ') : '图片文件')
          } catch {
            resolve('图片文件')
          }
        })
      })
    } catch {
      return '图片文件（处理失败）'
    }
  }
}

// 大模型图片处理接口（预留，由外部实现）
export async function processImageWithLLM(filePath: string): Promise<string> {
  try {
    // 读取图片文件
    const imageBuffer = await fs.readFile(filePath)
    const base64Image = imageBuffer.toString('base64')
    
    // 这里应该调用外部的大模型服务
    // 可以通过事件总线、IPC或其他方式与外部大模型服务通信
    console.log('预留大模型处理接口，需要外部实现')
    
    // 临时返回空字符串，等待外部实现
    return ''
  } catch (error) {
    console.error('大模型处理图片失败:', error)
    throw error
  }
}

// 提取文档内容
export async function extractDocumentContent(filePath: string, fileType: string): Promise<{ content: string, encoding: string, pages?: Array<{ pageNumber: number, content: string, pageType: string }>, totalPages?: number }> {
  let content = ''
  let encoding = 'utf-8'
  let pages: Array<{ pageNumber: number, content: string, pageType: string }> | undefined
  let totalPages: number | undefined
  
  try {
    switch (fileType) {
      case 'pdf':
        const pdfData = await extractPdfContent(filePath)
        content = pdfData.pages.map(page => page.content).join('\n')
        pages = pdfData.pages
        totalPages = pdfData.totalPages
        break
      case 'word':
        const wordData = await extractWordContent(filePath)
        content = wordData.pages.map(page => page.content).join('\n')
        pages = wordData.pages
        totalPages = wordData.totalPages
        break
      case 'powerpoint':
        const pptData = await extractPowerPointContent(filePath)
        content = pptData.pages.map(page => page.content).join('\n')
        pages = pptData.pages
        totalPages = pptData.totalPages
        break
      case 'excel':
        content = await extractExcelContent(filePath)
        break
      case 'image':
        content = await extractImageContent(filePath)
        break
      default:
        // 文本文件
        const textData = await detectFileEncoding(await fs.readFile(filePath))
        content = textData.content
        encoding = textData.encoding
        break
    }
    
    return { content, encoding, pages, totalPages }
  } catch (error) {
    console.error('提取文档内容失败:', error)
    throw error
  }
}

// 获取协议类型
export function getProtocolType(filePath: string): string {
  if (filePath.startsWith('user-data://')) return 'user-data'
  if (filePath.startsWith('app://')) return 'app'
  return 'file'
}

// 获取存储路径
export function getStoragePath(): string {
  const storagePath = store.get('storagePath')
  return storagePath ? path.join(storagePath, 'files') : path.join(app.getPath('userData'), 'files')
}

// 处理文件路径
export function resolveFilePath(filePath: string): string {
  // 处理 user-data:// 协议
  if (filePath.startsWith('user-data://')) {
    let relativePath = filePath.replace('user-data://files/', '')
    relativePath = relativePath.replace('user-data://', '')
    // 移除开头/结尾的斜杠
    relativePath = relativePath.replace(/^\/|\/$/g, '')
    
    try {
      // 处理 IDN 编码
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      
      // URL 解码 - 使用更安全的解码方式
      try {
        relativePath = decodeURIComponent(relativePath)
      } catch (decodeError) {
        console.warn('URL解码失败，尝试使用原始路径:', relativePath, decodeError)
        // 如果解码失败，使用原始路径继续处理
      }
      
      const storagePath = getStoragePath()
      const resolvedPath = path.normalize(path.join(storagePath, relativePath))

      // 安全校验：防止目录穿越攻击
      if (!resolvedPath.startsWith(storagePath)) {
        console.error('路径安全校验失败:', {
          originalPath: filePath,
          relativePath,
          resolvedPath,
          storagePath
        })
        throw new Error('无效的文件路径：路径安全校验失败')
      }
      
      // 验证文件是否存在（可选，用于调试）
      if (!fs.existsSync(resolvedPath)) {
        console.warn('解析后的路径不存在:', {
          originalPath: filePath,
          resolvedPath,
          storagePath
        })
      }
      
      return resolvedPath
    } catch (error) {
      console.error('处理文件路径失败:', {
        originalPath: filePath,
        relativePath,
        error: error instanceof Error ? error.message : error
      })
      throw new Error(`无效的文件路径: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  
  // 处理 app:// 协议
  if (filePath.startsWith('app://')) {
    let relativePath = filePath.replace('app://', '')
    
    try {
      // 处理 IDN 编码
      if (relativePath.includes('xn--')) {
        relativePath = toUnicode(relativePath)
      }
      
      // URL 解码
      try {
        relativePath = decodeURIComponent(relativePath)
      } catch (decodeError) {
        console.warn('URL解码失败，尝试使用原始路径:', relativePath, decodeError)
      }
      
      // Windows: 将盘符转为大写并添加冒号，例如 c\... -> C:\...
      if (process.platform === 'win32') {
        // 检查路径是否已经包含盘符（如 C:\ 或 C:/）
        const drivePattern = /^[A-Za-z]:[\\\/]/
        if (!drivePattern.test(relativePath)) {
          // 只有在没有盘符的情况下才添加
          const driveLetter = relativePath.charAt(0).toUpperCase()
          if (driveLetter && /[A-Z]/.test(driveLetter)) {
            relativePath = driveLetter + ':' + relativePath.substring(1)
          }
        }
      }
      // macOS: 确保以斜杠开头
      if (process.platform === 'darwin' && !relativePath.startsWith('/')) {
        relativePath = '/' + relativePath
      }
      return path.normalize(relativePath)
    } catch (error) {
      console.error('处理文件路径失败:', {
        originalPath: filePath,
        relativePath,
        error: error instanceof Error ? error.message : error
      })
      throw new Error(`无效的文件路径: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  
  // 处理普通文件路径
  return path.normalize(filePath)
}

// 将绝对路径转换为原始协议路径
export function convertToOriginalPath(absolutePath: string, originalDirPath: string): string {
  // 这里需要根据原始路径的协议类型来转换
  // 简化实现，实际使用时可能需要更复杂的逻辑
  if (originalDirPath.startsWith('user-data://files/')) {
    const storagePath = store.get('storagePath')
    const baseDir = storagePath ? path.join(storagePath, 'files') : path.join(app.getPath('userData'), 'files')
    const relativePath = path.relative(baseDir, absolutePath)
    return `user-data://files/${relativePath.replace(/\\/g, '/')}`
  } else if (originalDirPath.startsWith('app://')) {
    return `app://${absolutePath}`
  } else {
    return absolutePath
  }
}
