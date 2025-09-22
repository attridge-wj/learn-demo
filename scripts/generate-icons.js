const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

// 图标生成脚本
const generateIcons = async () => {
  console.log('🎨 生成多平台图标...\n');
  
  const sourceIcon = path.join(__dirname, '../src/assets/icon-clean.svg');
  const outputDir = path.join(__dirname, '../src/assets/icons');
  const devDir = path.join(outputDir, 'dev');
  const windowsDir = path.join(outputDir, 'windows');
  const macosDir = path.join(outputDir, 'macos');
  const linuxDir = path.join(outputDir, 'linux');
  const tempDir = path.join(__dirname, '../temp-icons');
  
  // 确保输出目录存在
  [outputDir, devDir, windowsDir, macosDir, linuxDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 检查源文件是否存在
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ 源图标文件不存在:', sourceIcon);
    return;
  }
  
  try {
    // 1. 将 SVG 转换为高分辨率 PNG (1024x1024)
    console.log('🔄 将 SVG 转换为 PNG...');
    const png1024 = path.join(tempDir, 'icon-1024x1024.png');
    await sharp(sourceIcon)
      .resize(1024, 1024)
      .png()
      .toFile(png1024);
    
    console.log('✅ PNG 转换完成');
    
    // 2. 生成开发环境 PNG 图标
    const devSizes = [16, 32, 64, 128, 256, 512];
    console.log('📏 生成开发环境 PNG 图标...');
    
    for (const size of devSizes) {
      const outputFile = path.join(devDir, `icon-${size}x${size}.png`);
      await sharp(png1024)
        .resize(size, size)
        .png()
        .toFile(outputFile);
      console.log(`  ✅ ${size}x${size} PNG 生成完成`);
    }
    
    // 3. 生成 Windows ICO 格式
    console.log('🪟 生成 Windows ICO 图标...');
    try {
      execSync(`npx electron-icon-builder --input="${png1024}" --output="${windowsDir}" --flatten`, { stdio: 'inherit' });
      
      // 移动生成的 ICO 文件到正确位置
      const generatedIco = path.join(windowsDir, 'icons', 'icon.ico');
      const targetIco = path.join(windowsDir, 'icon.ico');
      if (fs.existsSync(generatedIco)) {
        fs.copyFileSync(generatedIco, targetIco);
        fs.rmSync(path.join(windowsDir, 'icons'), { recursive: true, force: true });
      }
      
      console.log('✅ Windows ICO 生成完成');
    } catch (error) {
      console.warn('⚠️ Windows ICO 生成失败，将使用 PNG 格式');
    }
    
    // 4. 生成 macOS ICNS 格式
    console.log('🍎 生成 macOS ICNS 图标...');
    try {
      // 使用 sips 命令生成 ICNS (macOS 系统工具)
      const icnsPath = path.join(macosDir, 'icon.icns');
      const iconsetDir = path.join(tempDir, 'icon.iconset');
      
      if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir, { recursive: true });
      }
      
      // 生成不同尺寸的图标
      const icnsSizes = [
        { size: 16, name: 'icon_16x16.png' },
        { size: 32, name: 'icon_16x16@2x.png' },
        { size: 32, name: 'icon_32x32.png' },
        { size: 64, name: 'icon_32x32@2x.png' },
        { size: 128, name: 'icon_128x128.png' },
        { size: 256, name: 'icon_128x128@2x.png' },
        { size: 256, name: 'icon_256x256.png' },
        { size: 512, name: 'icon_256x256@2x.png' },
        { size: 512, name: 'icon_512x512.png' },
        { size: 1024, name: 'icon_512x512@2x.png' }
      ];
      
      for (const { size, name } of icnsSizes) {
        const outputFile = path.join(iconsetDir, name);
        await sharp(png1024)
          .resize(size, size)
          .png()
          .toFile(outputFile);
      }
      
      // 使用 sips 生成 ICNS
      execSync(`sips -s format icns "${iconsetDir}" --out "${icnsPath}"`, { stdio: 'inherit' });
      console.log('✅ macOS ICNS 生成完成');
      
    } catch (error) {
      console.warn('⚠️ macOS ICNS 生成失败，将使用 PNG 格式');
    }
    
    // 5. 生成 Linux PNG 格式
    console.log('🐧 生成 Linux PNG 图标...');
    const linuxIconPath = path.join(linuxDir, 'icon-512x512.png');
    await sharp(png1024)
      .resize(512, 512)
      .png()
      .toFile(linuxIconPath);
    console.log('✅ Linux PNG 图标生成完成');
    
    console.log('\n✅ 多平台图标生成完成！');
    console.log('📁 输出目录:', outputDir);
    
    // 列出生成的文件
    console.log('\n📋 生成的文件:');
    ['dev', 'windows', 'macos', 'linux'].forEach(platform => {
      const platformDir = path.join(outputDir, platform);
      if (fs.existsSync(platformDir)) {
        console.log(`\n${platform.toUpperCase()}:`);
        const files = fs.readdirSync(platformDir);
        files.forEach(file => {
          const filePath = path.join(platformDir, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file} (${(stats.size / 1024).toFixed(2)}KB)`);
        });
      }
    });
    
    // 清理临时文件
    console.log('\n🧹 清理临时文件...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('❌ 图标生成失败:', error.message);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  generateIcons();
}

module.exports = { generateIcons };
