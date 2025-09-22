import os from 'os'
import path from 'path'
import fs from 'fs-extra'

/**
 * 获取系统目录列表
 */
export function getSystemDirectories(): string[] {
  const platform = os.platform()
  const homeDir = os.homedir()
  
  if (platform === 'win32') {
    // Windows: 扫描所有可用磁盘驱动器
    return getWindowsDrives()
  } else if (platform === 'darwin') {
    // macOS: 扫描所有挂载的卷
    return getMacOSVolumes()
  } else {
    // Linux: 扫描所有挂载的文件系统
    return getLinuxMounts()
  }
}

/**
 * 获取 Windows 所有可用磁盘驱动器
 */
function getWindowsDrives(): string[] {
  const drives: string[] = []
  const homeDir = os.homedir()
  
  // 添加用户重要目录
  const userDirs = [
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Pictures'),
    path.join(homeDir, 'Videos'),
    path.join(homeDir, 'Music'),
    path.join(homeDir, 'Favorites')
  ]
  
  for (const dir of userDirs) {
    if (fs.existsSync(dir)) {
      drives.push(dir)
    }
  }
  
  // 检查 A-Z 驱动器
  for (let i = 65; i <= 90; i++) { // A-Z
    const driveLetter = String.fromCharCode(i)
    const drivePath = `${driveLetter}:\\`
    
    try {
      if (fs.existsSync(drivePath)) {
        // 跳过 C 盘根目录，避免权限问题
        if (driveLetter !== 'C') {
          drives.push(drivePath)
        }
      }
    } catch (error) {
      // 忽略无法访问的驱动器
    }
  }
  
  return drives
}

/**
 * 获取 macOS 所有挂载的卷
 */
function getMacOSVolumes(): string[] {
  const volumes: string[] = []
  const homeDir = os.homedir()
  
  try {
    // 添加用户重要目录（类似 Windows）
    const userDirs = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Downloads'),
      path.join(homeDir, 'Pictures'),
      path.join(homeDir, 'Movies'),
      path.join(homeDir, 'Music'),
      path.join(homeDir, 'Public')
    ]
    
    for (const dir of userDirs) {
      if (fs.existsSync(dir)) {
        volumes.push(dir)
      }
    }
    
    // 检查根目录（跳过系统目录，只扫描用户可访问的内容）
    const rootDir = '/'
    if (fs.existsSync(rootDir)) {
      volumes.push(rootDir)
    }
    
    // 尝试读取 /Volumes 目录下的所有挂载点（外部驱动器）
    const volumesDir = '/Volumes'
    if (fs.existsSync(volumesDir)) {
      try {
        const items = fs.readdirSync(volumesDir)
        for (const item of items) {
          const itemPath = path.join(volumesDir, item)
          if (fs.existsSync(itemPath)) {
            volumes.push(itemPath)
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
      }
    }
  } catch (error) {
    console.warn('获取 macOS 卷失败:', error)
  }
  
  return volumes
}

/**
 * 获取 Linux 所有挂载的文件系统
 */
function getLinuxMounts(): string[] {
  const mounts: string[] = []
  const homeDir = os.homedir()
  
  try {
    // 检查常见的挂载点
    const commonMounts = [
      '/',
      '/home',
      '/mnt',
      '/media',
      homeDir
    ]
    
    for (const mount of commonMounts) {
      if (fs.existsSync(mount)) {
        mounts.push(mount)
      }
    }
    
    // 尝试读取 /mnt 和 /media 目录
    const mountDirs = ['/mnt', '/media']
    for (const mountDir of mountDirs) {
      if (fs.existsSync(mountDir)) {
        try {
          const items = fs.readdirSync(mountDir)
          for (const item of items) {
            const itemPath = path.join(mountDir, item)
            if (fs.existsSync(itemPath)) {
              mounts.push(itemPath)
            }
          }
        } catch (error) {
          // 忽略无法读取的目录
        }
      }
    }
  } catch (error) {
    console.warn('获取 Linux 挂载点失败:', error)
  }
  
  return mounts
}

/**
 * 获取排除模式列表（精确匹配 AnyTXT 排除规则）
 */
export function getExcludePatterns(): string[] {
  const platform = os.platform()
  
  if (platform === 'win32') {
    return [
      // Windows 系统目录（精确匹配 AnyTXT）
      'C:/Program Files/**',
      'C:/Program Files (x86)/**',
      'C:/ProgramData/**',
      'C:/Recovery/**',
      'C:/Windows/**',
      'C:/Users/*/AppData/Local/Microsoft/**',
      'C:/Users/*/AppData/Local/Packages/**',
      'C:/Users/*/AppData/Local/Temp/**',
      'C:/Users/*/AppData/Local/cache/**',
      'C:/Users/*/AppData/Roaming/Microsoft/**',
      
      // 系统卷信息
      '**/System Volume Information/**',
      '**/$RECYCLE.BIN/**',
      
      // 版本控制
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      
      // 开发依赖
      '**/node_modules/**',
      '**/__pycache__/**',
      '**/.pytest_cache/**',
      '**/venv/**',
      '**/env/**',
      '**/.npm/**',
      '**/.yarn/**',
      '**/pnpm-store/**',
      '**/yarn.lock',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      
      // Java 相关
      '**/target/**',
      '**/.m2/**',
      '**/.gradle/**',
      '**/build/**',
      '**/out/**',
      '**/.classpath',
      '**/.project',
      '**/.settings/**',
      '**/bin/**',
      
      // Python 相关
      '**/*.pyc',
      '**/*.pyo',
      '**/*.pyd',
      '**/.coverage',
      
      // IDE 配置
      '**/.vscode/**',
      '**/.idea/**',
      '**/.vs/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',
      
      // 构建输出
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.output/**',
      
      // 缓存文件
      '**/.cache/**',
      '**/cache/**',
      '**/.eslintcache',
      '**/.stylelintcache',
      
      // 临时文件
      '**/temp/**',
      '**/.temp/**',
      '**/*.tmp',
      '**/*.temp',
      
      // 系统隐藏文件
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/desktop.ini',
      '**/ehthumbs.db',
      '**/ehthumbs_vista.db',
      
      // 日志文件
      '**/*.log',
      '**/logs/**',
      
      // 备份文件
      '**/*.bak',
      '**/*.backup',
      '**/*.old',
      
      // 压缩包（可选，根据需要调整）
      '**/*.zip',
      '**/*.rar',
      '**/*.7z',
      '**/*.tar',
      '**/*.gz',
      '**/*.bz2'
    ]
  } else if (platform === 'darwin') {
    return [
      // macOS 系统目录
      '/System/**',
      '/Library/**',
      '/Applications/**',
      '/private/**',
      '/var/**',
      '/tmp/**',
      '/Users/*/Library/Caches/**',
      '/Users/*/Library/Logs/**',
      '/Users/*/Library/Application Support/**',
      '/Users/*/Library/Preferences/**',
      '/Users/*/Library/Saved Application State/**',
      '/Users/*/Library/WebKit/**',
      '/Users/*/Library/Developer/**',
      '/Users/*/Library/Containers/**',
      '/Users/*/Library/Group Containers/**',
      '/Users/*/Library/Mobile Documents/**',
      '/Users/*/Library/CloudStorage/**',
      
      // 版本控制
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      
      // 开发依赖
      '**/node_modules/**',
      '**/__pycache__/**',
      '**/.pytest_cache/**',
      '**/venv/**',
      '**/env/**',
      '**/.npm/**',
      '**/.yarn/**',
      '**/pnpm-store/**',
      '**/yarn.lock',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      
      // Java 相关
      '**/target/**',
      '**/.m2/**',
      '**/.gradle/**',
      '**/build/**',
      '**/out/**',
      '**/.classpath',
      '**/.project',
      '**/.settings/**',
      '**/bin/**',
      
      // Python 相关
      '**/*.pyc',
      '**/*.pyo',
      '**/*.pyd',
      '**/.coverage',
      
      // IDE 配置
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',
      
      // 构建输出
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.output/**',
      
      // 缓存文件
      '**/.cache/**',
      '**/cache/**',
      '**/.eslintcache',
      '**/.stylelintcache',
      
      // 临时文件
      '**/temp/**',
      '**/.temp/**',
      '**/*.tmp',
      '**/*.temp',
      
      // 系统隐藏文件
      '**/.DS_Store',
      '**/.Spotlight-V100/**',
      '**/.Trashes/**',
      '**/.fseventsd/**',
      '**/.TemporaryItems/**',
      
      // 日志文件
      '**/*.log',
      '**/logs/**',
      
      // 备份文件
      '**/*.bak',
      '**/*.backup',
      '**/*.old',
      
      // 压缩包（可选，根据需要调整）
      '**/*.zip',
      '**/*.rar',
      '**/*.7z',
      '**/*.tar',
      '**/*.gz',
      '**/*.bz2'
    ]
  } else {
    // Linux
    return [
      // Linux 系统目录
      '/proc/**',
      '/sys/**',
      '/dev/**',
      '/boot/**',
      '/var/cache/**',
      '/var/log/**',
      '/var/tmp/**',
      '/tmp/**',
      '/run/**',
      '/mnt/**',
      '/media/**',
      
      // 版本控制
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      
      // 开发依赖
      '**/node_modules/**',
      '**/__pycache__/**',
      '**/.pytest_cache/**',
      '**/venv/**',
      '**/env/**',
      '**/.npm/**',
      '**/.yarn/**',
      '**/pnpm-store/**',
      '**/yarn.lock',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      
      // Java 相关
      '**/target/**',
      '**/.m2/**',
      '**/.gradle/**',
      '**/build/**',
      '**/out/**',
      '**/.classpath',
      '**/.project',
      '**/.settings/**',
      '**/bin/**',
      
      // Python 相关
      '**/*.pyc',
      '**/*.pyo',
      '**/*.pyd',
      '**/.coverage',
      
      // IDE 配置
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',
      
      // 构建输出
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.output/**',
      
      // 缓存文件
      '**/.cache/**',
      '**/cache/**',
      '**/.eslintcache',
      '**/.stylelintcache',
      
      // 临时文件
      '**/temp/**',
      '**/.temp/**',
      '**/*.tmp',
      '**/*.temp',
      
      // 系统隐藏文件
      '**/.DS_Store',
      '**/.Trash/**',
      '**/.cache/**',
      
      // 日志文件
      '**/*.log',
      '**/logs/**',
      
      // 备份文件
      '**/*.bak',
      '**/*.backup',
      '**/*.old',
      
      // 压缩包（可选，根据需要调整）
      '**/*.zip',
      '**/*.rar',
      '**/*.7z',
      '**/*.tar',
      '**/*.gz',
      '**/*.bz2'
    ]
  }
}

/**
 * 获取文件类型（精确匹配 AnyTXT 支持的类型）
 */
export function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (!ext) return 'unknown'
  
  // 纯文本格式
  if (['.txt', '.log', '.md', '.rtf'].includes(ext)) return 'text'
  
  // 代码文件（支持任意代码和配置文件）
  const codeExtensions = [
    // 主流编程语言
    '.java', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.scss', '.less', 
       '.py', '.cpp', '.c', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift',
    '.kt', '.scala', '.clj', '.hs', '.ml', '.fs', '.vb', '.sql', '.sh', '.bat', '.ps1',
    
    // 配置文件
    '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.cfg', '.conf', '.config', 
    '.properties', '.env',
    
    // 版本控制和构建文件
    '.gitignore', '.gitattributes', '.dockerfile', '.makefile', '.cmake', '.gradle', 
    '.maven', '.pom', '.sbt', '.cabal', '.cargo',
    
    // 前端框架和工具配置
    '.vue', '.svelte', '.astro', '.jsx', '.tsx',
    
    // 构建工具配置（无扩展名文件通过文件名识别）
    'package.json', 'webpack.config.js', 'vite.config.js', 'rollup.config.js',
    'babel.config.js', 'eslint.config.js', 'prettier.config.js', 'jest.config.js',
    
    // 数据库相关
    '.sql', '.sqlite', '.db',
    
    // 脚本文件
    '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.psm1',
    
    // 标记语言
    '.md', '.markdown', '.rst', '.adoc', '.tex', '.ltx'
  ]
  
  if (codeExtensions.includes(ext)) return 'code'
  
  // Microsoft Office 格式
  if (['.doc', '.docx'].includes(ext)) return 'word'
  if (['.xls', '.xlsx'].includes(ext)) return 'excel'
  if (['.ppt', '.pptx'].includes(ext)) return 'powerpoint'
  if (['.one'].includes(ext)) return 'onenote'
  
  // PDF 格式
  if (['.pdf'].includes(ext)) return 'pdf'
  
  // 邮件格式
  if (['.eml'].includes(ext)) return 'email'
  
  // 电子书格式
  if (['.mobi', '.epub', '.azw', '.azw3', '.djvu'].includes(ext)) return 'ebook'
  
  // Microsoft 编译 HTML 帮助
  if (['.chm'].includes(ext)) return 'chm'
  
  // WPS 格式
  if (['.wps', '.et', '.dps'].includes(ext)) return 'wps'
  
  // 思维导图格式
  if (['.lighten', '.mmap', '.emmx', '.mm', '.xmind'].includes(ext)) return 'mindmap'
  
  // 其他文档格式
  if (['.ofd', '.ziw', '.eddx'].includes(ext)) return 'document'
  
  // LaTeX 格式
  if (['.tex', '.ltx', '.sty', '.cls', '.bbl', '.aux', '.log', '.toc', '.lof', '.lot'].includes(ext)) return 'latex'
  
  // 图片格式（支持 OCR）
  if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.gif', '.webp'].includes(ext)) return 'image'
  
  // 可执行文件
  if (['.exe', '.dll', '.so', '.dylib', '.app', '.msi', '.deb', '.rpm', '.pkg'].includes(ext)) return 'executable'
  
  return 'unknown'
}
