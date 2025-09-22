# Electron 图标设置指南

## 图标设计

当前应用使用简洁的 "Re" 图标设计：
- **背景**：白色圆角矩形
- **文字**：黑色粗体 "Re" 字母
- **圆角**：80px 圆角半径
- **字体**：280px 字体大小

## 图标文件

### 主要文件
- `src/assets/icon-clean.svg` - 主设计文件（SVG 格式）

### 多平台图标
```
src/assets/icons/
├── dev/                    # 开发环境图标
│   ├── icon-16x16.png
│   ├── icon-32x32.png
│   ├── icon-64x64.png
│   ├── icon-128x128.png
│   ├── icon-256x256.png
│   └── icon-512x512.png
├── windows/                # Windows 图标
│   └── icon.ico
├── macos/                  # macOS 图标
│   └── icon.icns
└── linux/                  # Linux 图标
    └── icon-512x512.png
```

## 配置

### package.json 配置
```json
{
  "build": {
    "icon": "src/assets/icons/windows/icon.ico",
    "win": {
      "icon": "src/assets/icons/windows/icon.ico"
    },
    "mac": {
      "icon": "src/assets/icons/macos/icon.icns"
    },
    "linux": {
      "icon": "src/assets/icons/linux/icon-512x512.png"
    }
  }
}
```

## 使用方法

### 生成图标
```bash
# 生成所有平台的图标文件
node scripts/generate-icons.js
```

### 清理缓存（macOS）
```bash
# 清理 macOS 图标缓存
./scripts/clear-icon-cache-mac.sh
```

### 开发环境
```bash
# 重启开发服务器以应用新图标
npm run dev
```

### 构建应用
```bash
# 构建所有平台
npm run dist

# 构建特定平台
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## 自定义图标

### 修改设计
如果需要修改图标设计，请编辑 `src/assets/icon-clean.svg` 文件，然后运行：

```bash
# 重新生成所有平台的图标
node scripts/generate-icons.js
```

## 目录结构

```
src/assets/
├── icon-clean.svg              # 主设计文件
└── icons/
    ├── dev/                    # 开发环境图标
    ├── windows/                # Windows 图标
    ├── macos/                  # macOS 图标
    └── linux/                  # Linux 图标

scripts/
├── generate-icons.js           # 图标生成脚本
└── clear-icon-cache-mac.sh    # macOS 缓存清理脚本
```

## 相关文件

- `src/assets/icon-clean.svg` - 主设计文件
- `src/assets/icons/` - 按平台分类的图标文件
- `scripts/generate-icons.js` - 图标生成脚本
- `scripts/clear-icon-cache-mac.sh` - macOS 缓存清理脚本