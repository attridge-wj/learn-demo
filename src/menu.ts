import { app, Menu, MenuItemConstructorOptions } from 'electron'

export function setupAppMenu(): void {
  const isMac = process.platform === 'darwin'

  // 只在 Mac 平台设置应用菜单
  if (isMac) {
    const template: MenuItemConstructorOptions[] = []

    // macOS 应用菜单（建议保留，保证系统集成体验）
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    // 编辑菜单：启用剪切/复制/粘贴/撤销/全选等快捷键
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }
      ]
    })

    // 视图菜单（可选，便于开发调试）
    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    })

    // 窗口菜单
    template.push({ role: 'windowMenu' })

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    
    // 调试信息：确认菜单已设置
    console.log('macOS 应用菜单已设置，包含以下项目:')
    template.forEach(item => {
      if (item.label) {
        console.log(`- ${item.label}`)
      }
    })
  } else {
    console.log('非 macOS 平台，跳过应用菜单设置')
  }
} 