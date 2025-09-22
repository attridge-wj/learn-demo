#!/bin/bash

# 图标更新脚本
# 用法: ./scripts/update-icon.sh /path/to/new-icon.svg

if [ $# -eq 0 ]; then
    echo "❌ 请提供新图标文件的路径"
    echo "用法: ./scripts/update-icon.sh /path/to/new-icon.svg"
    exit 1
fi

NEW_ICON_PATH="$1"
TARGET_ICON="src/assets/icon-clean.svg"

# 检查新图标文件是否存在
if [ ! -f "$NEW_ICON_PATH" ]; then
    echo "❌ 图标文件不存在: $NEW_ICON_PATH"
    exit 1
fi

echo "🔄 开始更新图标..."

# 1. 备份当前图标
if [ -f "$TARGET_ICON" ]; then
    echo "📦 备份当前图标..."
    cp "$TARGET_ICON" "${TARGET_ICON}.backup"
fi

# 2. 替换主设计文件
echo "🔄 替换主设计文件..."
cp "$NEW_ICON_PATH" "$TARGET_ICON"
echo "✅ 主设计文件已更新"

# 3. 重新生成所有平台图标
echo "🎨 生成所有平台图标..."
node scripts/generate-icons.js

if [ $? -eq 0 ]; then
    echo "✅ 图标生成完成"
else
    echo "❌ 图标生成失败"
    exit 1
fi

# 4. 清理 macOS 缓存
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🧹 清理 macOS 图标缓存..."
    ./scripts/clear-icon-cache-mac.sh
fi

echo ""
echo "🎉 图标更新完成！"
echo ""
echo "📝 下一步操作："
echo "1. 停止当前开发服务器 (Ctrl+C)"
echo "2. 重新启动开发服务器: npm run dev"
echo "3. 检查图标是否已更新"
echo ""
echo "💡 如果图标没有更新，请尝试："
echo "- 完全退出应用 (Cmd+Q)"
echo "- 等待几秒钟"
echo "- 重新启动应用"
