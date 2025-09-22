import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as child_process from 'child_process'
import { app } from 'electron'
import store from '../../../utils/store'

// 获取系统特殊目录
export async function getSpecialDirectories() {
  const homeDir = os.homedir()
  const platform = process.platform
  
  const dirs: { [key: string]: string } = {
    downloads: path.join(homeDir, 'Downloads'),
    documents: path.join(homeDir, 'Documents'),
    pictures: path.join(homeDir, 'Pictures'),
    music: path.join(homeDir, 'Music'),
    videos: path.join(homeDir, 'Videos'),
    desktop: path.join(homeDir, 'Desktop')
  }

  // macOS 特殊目录
  if (platform === 'darwin') {
    dirs.downloads = path.join(homeDir, 'Downloads')
    dirs.documents = path.join(homeDir, 'Documents')
    dirs.pictures = path.join(homeDir, 'Pictures')
    dirs.music = path.join(homeDir, 'Music')
    dirs.videos = path.join(homeDir, 'Movies')
    dirs.desktop = path.join(homeDir, 'Desktop')
  }
  // Linux 特殊目录
  else if (platform === 'linux') {
    dirs.downloads = path.join(homeDir, 'Downloads')
    dirs.documents = path.join(homeDir, 'Documents')
    dirs.pictures = path.join(homeDir, 'Pictures')
    dirs.music = path.join(homeDir, 'Music')
    dirs.videos = path.join(homeDir, 'Videos')
    dirs.desktop = path.join(homeDir, 'Desktop')
  }

  // 过滤出实际存在的目录
  const existingDirs: { name: string; path: string; type: string }[] = []
  for (const [key, value] of Object.entries(dirs)) {
    if (await fs.pathExists(value)) {
      existingDirs.push({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        path: value,
        type: 'special'
      })
    }
  }

  return existingDirs
}

// 获取系统盘符
export async function getSystemDrives() {
  const platform = process.platform
  const drives: { name: string; path: string; type: string }[] = []

  if (platform === 'win32') {
    try {
      // 首先尝试使用Node.js原生API
      const rootPath = process.env.HOMEDRIVE || process.env.SystemDrive || 'C:'
      const allUsersPath = process.env.ALLUSERSPROFILE || 'C:\\ProgramData'
      
      // 从ALLUSERSPROFILE路径中提取可能的系统盘符
      const possibleSystemDrives = new Set([
        rootPath.charAt(0).toUpperCase(),
        allUsersPath.charAt(0).toUpperCase()
      ])

      // 生成可能的盘符列表 (C-Z)，通常不检查A和B（软盘驱动器）
      const possibleDrives = Array.from({ length: 24 }, (_, i) => String.fromCharCode(67 + i))
      
      // 优先检查已知的系统盘符
      possibleSystemDrives.forEach(letter => {
        if (!possibleDrives.includes(letter)) {
          possibleDrives.unshift(letter)
        }
      })

      // 并行检查所有可能的盘符
      const driveChecks = possibleDrives.map(async letter => {
        const drivePath = `${letter}:\\`
        try {
          const stats = await fs.stat(drivePath)
          if (stats.isDirectory()) {
            return {
              name: `${letter}:`,
              path: drivePath,
              type: 'drive'
            }
          }
        } catch {
          // 忽略不存在的盘符
        }
        return null
      })

      const results = await Promise.all(driveChecks)
      const foundDrives = results.filter((drive): drive is NonNullable<typeof drive> => drive !== null)

      // 如果使用Node.js API没有找到任何驱动器，尝试使用PowerShell
      if (foundDrives.length === 0) {
        const { execSync } = require('child_process')
        try {
          const command = 'powershell -command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Root | ConvertTo-Json"'
          const output = execSync(command, { timeout: 3000 }).toString() // 设置3秒超时
          const driveList = JSON.parse(output)
          
          driveList.forEach((drive: { Name: string; Root: string }) => {
            if (drive.Root) {
              drives.push({
                name: `${drive.Name}:`,
                path: drive.Root,
                type: 'drive'
              })
            }
          })
        } catch (error) {
          console.warn('PowerShell获取驱动器列表失败:', error)
          // 如果PowerShell也失败了，至少添加系统盘
          drives.push({
            name: `${rootPath.charAt(0)}:`,
            path: `${rootPath.charAt(0)}:\\`,
            type: 'drive'
          })
        }
      } else {
        drives.push(...foundDrives)
      }
    } catch (error) {
      console.error('获取系统盘符失败:', error)
      // 如果所有方法都失败，至少返回C盘
      drives.push({
        name: 'C:',
        path: 'C:\\',
        type: 'drive'
      })
    }
  } else {
    // Unix 系统（Linux/macOS）
    drives.push({
      name: 'Root',
      path: '/',
      type: 'drive'
    })
    
    // 添加用户主目录
    const homeDir = os.homedir()
    drives.push({
      name: 'Home',
      path: homeDir,
      type: 'drive'
    })
  }

  return drives
}

// 获取系统默认编码
export function getSystemEncoding(): string {
  const platform = process.platform
  if (platform === 'win32') {
    return 'gbk'
  }
  return 'utf-8'
}

// 获取快捷方式目标路径
export async function getShortcutTarget(shortcutPath: string): Promise<string> {
  // 检查缓存
  const cachedTarget = store.get(`targets.${shortcutPath}`)
  if (cachedTarget) {
    return cachedTarget
  }

  return new Promise((resolve, reject) => {
    // 使用 PowerShell 获取快捷方式目标路径
    const command = `powershell -command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath}'); $Shortcut.TargetPath"`
    
    child_process.exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('获取快捷方式目标失败:', error)
        reject(error)
        return
      }
      if (stderr) {
        console.error('获取快捷方式目标错误:', stderr)
        reject(new Error(stderr))
        return
      }
      const targetPath = stdout.trim()
      // 缓存目标路径
      store.set(`targets.${shortcutPath}`, targetPath)
      resolve(targetPath)
    })
  })
}

// 获取文件图标
export async function getFileIcon(filePath: string): Promise<string | null> {
  // 检查缓存
  const cachedIcon = store.get(`icons.${filePath}`)
  if (cachedIcon) {
    return cachedIcon
  }

  try {
    const iconImage = await app.getFileIcon(filePath, {
      size: 'large'
    })
    if (iconImage) {
      const iconData = iconImage.toDataURL()
      // 缓存图标
      store.set(`icons.${filePath}`, iconData)
      return iconData
    }
  } catch (error) {
    console.warn('获取图标失败:', error)
  }
  return null
}

// 清理过期的缓存
export async function cleanupShortcutCache() {
  const targets = store.get('targets') as Record<string, string> || {}
  const icons = store.get('icons') as Record<string, string> || {}
  
  // 检查目标文件是否存在
  for (const [shortcutPath, targetPath] of Object.entries(targets)) {
    if (!await fs.pathExists(shortcutPath) || !await fs.pathExists(targetPath)) {
      delete targets[shortcutPath]
      delete icons[targetPath]
    }
  }
  
  // 更新缓存
  store.set('targets', targets)
  store.set('icons', icons)
} 