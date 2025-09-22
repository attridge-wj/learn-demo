#!/bin/bash

# macOS 图标缓存清理脚本
echo "🧹 清理 macOS 图标缓存..."

# 清理图标缓存
sudo rm -rf /Library/Caches/com.apple.dock.iconcache
sudo rm -rf ~/Library/Caches/com.apple.dock.iconcache
sudo rm -rf /Library/Caches/com.apple.finder
sudo rm -rf ~/Library/Caches/com.apple.finder

# 重启服务
killall Dock
killall Finder

echo "✅ 图标缓存清理完成！"
