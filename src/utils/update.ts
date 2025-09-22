
const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const { machineIdSync } = require('node-machine-id')
const axios = require('axios')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')

// 飞书API配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a82fa62ccdbb900c',
  APP_SECRET: 'qc6AB2bxwGRH9aDfTOn1ldrkUEijHnt2',
  FILE_TOKEN: 'your_file_token', // 安装包文件token
  VERSION_TABLE: 'your_version_table' // 版本记录表
}

let mainWindow: any = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // 获取设备ID(历史问题1的集成)
  const deviceId = machineIdSync({ original: true })
  
  // 初始化更新检查
  await checkForUpdates(deviceId)
  
  mainWindow.loadFile('index.html')
}

// 飞书API授权
async function getFeishuToken() {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: FEISHU_CONFIG.APP_ID,
      app_secret: FEISHU_CONFIG.APP_SECRET
    }
  )
  return response.data.tenant_access_token
}

// 检查更新
async function checkForUpdates(deviceId: string) {
  try {
    const token = await getFeishuToken()
    
    // 从飞书多维表格获取最新版本(历史问题2的集成)
    const versionRes = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.VERSION_TABLE}/records`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    
    const latestVersion = versionRes.data.items[0].fields.version
    const currentVersion = app.getVersion()
    
    if (latestVersion > currentVersion) {
      console.log(`发现新版本: ${latestVersion}, 当前版本: ${currentVersion}`)
      
      // 下载飞书文件（二进制流）
      const fileRes = await axios.get(
        `https://open.feishu.cn/open-apis/drive/v1/files/${FEISHU_CONFIG.FILE_TOKEN}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer' // 重要：指定响应类型为二进制
        }
      )
      
      // 创建临时目录和文件
      const tempDir = path.join(os.tmpdir(), 'rebirth-update')
      await fs.ensureDir(tempDir)
      
      // 根据平台确定文件扩展名
      const platform = process.platform
      let fileExtension = '.exe'
      if (platform === 'darwin') {
        fileExtension = '.dmg'
      } else if (platform === 'linux') {
        fileExtension = '.AppImage'
      }
      
      const tempFilePath = path.join(tempDir, `rebirth-${latestVersion}${fileExtension}`)
      
      // 将二进制数据写入临时文件
      await fs.writeFile(tempFilePath, fileRes.data)
      console.log(`安装包已保存到: ${tempFilePath}`)
      
      // 验证文件是否成功写入
      const stats = await fs.stat(tempFilePath)
      if (stats.size === 0) {
        throw new Error('下载的安装包文件为空')
      }
      
      // 使用本地文件路径配置electron-updater
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: `file://${tempFilePath}` // 使用本地文件路径
      })
      
      // 设置更新选项
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      
      console.log('开始检查更新...')
      autoUpdater.checkForUpdatesAndNotify()
    } else {
      console.log('当前已是最新版本')
    }
  } catch (error) {
    console.error('更新检查失败:', error)
    
    // 清理临时文件
    try {
      const tempDir = path.join(os.tmpdir(), 'rebirth-update')
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir)
        console.log('已清理临时更新文件')
      }
    } catch (cleanupError) {
      console.error('清理临时文件失败:', cleanupError)
    }
  }
}

// 更新事件监听
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded')
})

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(createWindow)
