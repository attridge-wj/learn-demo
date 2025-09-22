# GitHub Actions 自动化构建配置指南

## 1. 准备工作

### 1.1 创建 GitHub 仓库
1. 在 GitHub 上创建新的仓库
2. 将代码推送到仓库

### 1.2 配置 Secrets

在 GitHub 仓库的 Settings > Secrets and variables > Actions 中添加以下 secrets：

#### macOS 签名相关
- `MACOS_CERTIFICATE_P12`: macOS 开发者证书的 .p12 文件（base64 编码）
- `MACOS_CERTIFICATE_PASSWORD`: .p12 文件的密码
- `APPLE_ID`: 您的 Apple ID 邮箱
- `APPLE_ID_PASSWORD`: App 专用密码
- `APPLE_TEAM_ID`: Apple Developer 团队 ID

#### Windows 签名相关（可选）
- `WINDOWS_CERTIFICATE_P12`: Windows 代码签名证书的 .p12 文件（base64 编码）
- `WINDOWS_CERTIFICATE_PASSWORD`: .p12 文件的密码

## 2. 获取证书和配置

### 2.1 macOS 证书准备

1. **导出开发者证书**：
   ```bash
   # 在 Keychain Access 中找到证书，右键导出为 .p12 文件
   # 然后转换为 base64
   base64 -i your-certificate.p12 | pbcopy
   ```

2. **获取 Apple ID 信息**：
   - Apple ID: 您的 Apple ID 邮箱
   - App 专用密码: 在 https://appleid.apple.com 生成
   - Team ID: 在 Apple Developer 账户中查看

### 2.2 Windows 证书准备（可选）

1. **获取代码签名证书**：
   - 从证书颁发机构购买
   - 或使用自签名证书（仅用于测试）

2. **导出证书**：
   ```bash
   # 导出为 .p12 文件并转换为 base64
   base64 -i your-windows-cert.p12 | pbcopy
   ```

## 3. 配置环境变量

### 3.1 在 GitHub Actions 中设置环境变量

在 `.github/workflows/` 文件中，我们使用以下环境变量：

```yaml
env:
  CSC_NAME: "Developer ID Application: Your Name (TEAM_ID)"
  CSC_TEAM_ID: "YOUR_TEAM_ID"
  APPLE_ID: "your-apple-id@example.com"
  APPLE_ID_PASSWORD: "your-app-specific-password"
  APPLE_TEAM_ID: "YOUR_TEAM_ID"
```

### 3.2 在本地设置环境变量

创建 `.env` 文件（不要提交到仓库）：

```bash
# macOS 签名
CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
CSC_TEAM_ID="YOUR_TEAM_ID"
APPLE_ID="your-apple-id@example.com"
APPLE_ID_PASSWORD="your-app-specific-password"
APPLE_TEAM_ID="YOUR_TEAM_ID"

# Windows 签名（可选）
WINDOWS_CERTIFICATE_P12="base64-encoded-certificate"
WINDOWS_CERTIFICATE_PASSWORD="certificate-password"
```

## 4. 工作流说明

### 4.1 触发条件

- **标签推送**: 当推送 `v*` 标签时触发完整构建和发布
- **Pull Request**: 在 PR 中触发代码检查
- **手动触发**: 可以在 Actions 页面手动触发

### 4.2 构建流程

1. **代码检查** (`lint`): 运行 ESLint 检查
2. **多平台构建** (`build`): 在 macOS、Windows、Linux 上构建
3. **macOS 签名** (`macos-sign`): 签名和公证 macOS 应用
4. **Windows 签名** (`windows-sign`): 签名 Windows 应用
5. **Linux 构建** (`linux-build`): 构建 Linux 应用
6. **发布** (`release`): 创建 GitHub Release

### 4.3 构建产物

- **macOS**: `.dmg` 文件和 `.app` 应用
- **Windows**: `.exe` 安装程序和 `.msi` 包
- **Linux**: `.AppImage` 和 `.deb` 包

## 5. 使用方法

### 5.1 创建发布

1. 更新 `package.json` 中的版本号
2. 提交代码并推送
3. 创建并推送标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### 5.2 手动触发构建

1. 访问 GitHub 仓库的 Actions 页面
2. 选择对应的工作流
3. 点击 "Run workflow" 按钮

## 6. 故障排除

### 6.1 常见问题

**macOS 签名失败**：
- 检查证书是否正确导入
- 确认 Apple ID 和密码正确
- 检查 Team ID 是否正确

**Windows 签名失败**：
- 确认证书格式正确
- 检查证书密码是否正确
- 确认证书未过期

**构建失败**：
- 检查 Node.js 版本兼容性
- 确认所有依赖都已安装
- 查看构建日志中的具体错误

### 6.2 调试方法

1. **查看构建日志**：在 Actions 页面点击具体的构建任务
2. **本地测试**：在本地运行相同的命令
3. **检查 Secrets**：确认所有必要的 secrets 都已设置

## 7. 安全注意事项

1. **不要提交证书文件**：证书文件包含敏感信息，只通过 GitHub Secrets 传递
2. **定期更新证书**：确保证书在有效期内
3. **限制访问权限**：只给必要的团队成员仓库访问权限
4. **监控构建日志**：定期检查构建日志，确保没有敏感信息泄露

## 8. 优化建议

1. **使用缓存**：利用 GitHub Actions 的缓存功能加速构建
2. **并行构建**：多个平台可以并行构建
3. **增量构建**：只构建有变化的平台
4. **构建矩阵**：使用构建矩阵减少重复配置
