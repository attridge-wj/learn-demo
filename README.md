# Rebirth Electron 主进程项目

这是一个基于 Electron 的主进程项目，使用 TypeScript 开发，集成了 TypeORM 和 better-sqlite3 进行数据存储。

## 技术栈

- Electron
- TypeScript
- TypeORM
- better-sqlite3
- SQLite

## 项目结构

```
rebirth-electron/
├── src/
│   ├── main.ts              # 主进程入口文件
│   ├── database/            # 数据库相关
│   │   ├── data-source.ts   # 数据库配置
│   │   └── entities/        # 数据实体
│   └── ipc/                 # IPC 通信处理
│       └── handlers.ts      # IPC 处理程序
├── package.json
├── tsconfig.json
└── README.md
```

## 开发环境设置

1. 安装依赖：
```bash
npm install
```

2. 开发模式运行：
```bash
npm start
```

3. 构建项目：
```bash
npm run build
```

## 打包应用

### Windows
```bash
npm run dist:win
```

### macOS
```bash
npm run dist:mac
```

### Linux
```bash
npm run dist:linux
```

## 渲染进程集成

1. 将渲染进程项目构建后的文件（dist 目录）复制到主进程项目的 `renderer/dist` 目录下
2. 重新打包主进程应用

## IPC 通信

主进程提供了以下 IPC 通道供渲染进程调用：

- `database:query`: 执行原始 SQL 查询
- `entity:save`: 保存实体数据
- `entity:find`: 查询实体数据

## 图标更新指南

### 替换新图标

当您获得一张新的图标 SVG 文件时，请按以下步骤操作：

#### 方法一：使用快速更新脚本（推荐）
```bash
# 一键更新图标（自动完成所有步骤）
./scripts/update-icon.sh /path/to/your/new-icon.svg
```

#### 方法二：手动更新
```bash
# 1. 替换主设计文件
cp /path/to/your/new-icon.svg src/assets/icon-clean.svg

# 2. 重新生成所有平台图标
node scripts/generate-icons.js

# 3. 清理系统缓存（macOS）
./scripts/clear-icon-cache-mac.sh

# 4. 重启开发服务器
npm run dev
```

#### 5. 验证图标更新
- **开发环境**: 检查 Dock 图标和窗口标题栏图标
- **生产环境**: 重新构建应用并检查安装包图标

### 图标文件结构
```
src/assets/
├── icon-clean.svg              # 主设计文件（替换此文件）
└── icons/
    ├── dev/                    # 开发环境图标（自动生成）
    ├── windows/                # Windows 图标（自动生成）
    ├── macos/                  # macOS 图标（自动生成）
    └── linux/                  # Linux 图标（自动生成）
```

### 示例操作

假设您有一个名为 `new-app-icon.svg` 的新图标文件：

```bash
# 使用快速更新脚本
./scripts/update-icon.sh ~/Downloads/new-app-icon.svg

# 或者手动操作
cp ~/Downloads/new-app-icon.svg src/assets/icon-clean.svg
node scripts/generate-icons.js
./scripts/clear-icon-cache-mac.sh
npm run dev
```

### 注意事项
- 确保新的 SVG 文件尺寸为 512x512 像素
- 建议使用简洁的设计，在小尺寸下也能清晰显示
- 生成图标后记得清理系统缓存以确保更新生效
- 快速更新脚本会自动备份当前图标到 `icon-clean.svg.backup`

## 注意事项

1. 确保渲染进程项目已经正确构建
2. 开发环境下需要同时运行渲染进程的开发服务器
3. 生产环境下需要将渲染进程的构建文件放在正确的位置
4. 更新图标后需要重新生成所有平台的图标文件 