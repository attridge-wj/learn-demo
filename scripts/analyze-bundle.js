const fs = require('fs');
const path = require('path');

// 分析打包体积
function analyzeBundle() {
  console.log('=== 打包体积分析 ===\n');
  
  // 分析 dist 目录
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    let totalSize = 0;
    let fileCount = 0;
    const fileSizes = [];
    
    function calculateSize(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          calculateSize(filePath);
        } else {
          const size = stat.size;
          totalSize += size;
          fileCount++;
          fileSizes.push({
            path: path.relative(distPath, filePath),
            size: size
          });
        }
      });
    }
    
    calculateSize(distPath);
    
    console.log(`dist 目录统计:`);
    console.log(`- 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- 文件数量: ${fileCount}`);
    
    // 按大小排序
    fileSizes.sort((a, b) => b.size - a.size);
    
    console.log('\n最大的 10 个文件:');
    fileSizes.slice(0, 10).forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}: ${(file.size / 1024).toFixed(2)} KB`);
    });
  }
  
  // 分析 renderer/dist 目录
  const rendererDistPath = path.join(__dirname, '../renderer/dist');
  if (fs.existsSync(rendererDistPath)) {
    let rendererSize = 0;
    let rendererFileCount = 0;
    
    function calculateRendererSize(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          calculateRendererSize(filePath);
        } else {
          rendererSize += stat.size;
          rendererFileCount++;
        }
      });
    }
    
    calculateRendererSize(rendererDistPath);
    
    console.log(`\nrenderer/dist 目录统计:`);
    console.log(`- 总大小: ${(rendererSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- 文件数量: ${rendererFileCount}`);
  }
  
  // 分析 node_modules 大小
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    let nodeModulesSize = 0;
    
    function calculateNodeModulesSize(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          calculateNodeModulesSize(filePath);
        } else {
          nodeModulesSize += stat.size;
        }
      });
    }
    
    calculateNodeModulesSize(nodeModulesPath);
    
    console.log(`\nnode_modules 大小: ${(nodeModulesSize / 1024 / 1024).toFixed(2)} MB`);
  }
}

// 优化建议
function optimizationSuggestions() {
  console.log('\n=== 优化建议 ===\n');
  
  console.log('1. 依赖优化:');
  console.log('   - 将大型依赖标记为 external');
  console.log('   - 只打包必需的依赖文件');
  console.log('   - 移除测试文件和文档');
  
  console.log('\n2. 代码优化:');
  console.log('   - 启用 terser 压缩');
  console.log('   - 移除 console.log 和 debugger');
  console.log('   - 使用 Tree Shaking');
  
  console.log('\n3. 资源优化:');
  console.log('   - 压缩图片资源');
  console.log('   - 移除未使用的资源');
  console.log('   - 优化字体文件');
  
  console.log('\n4. Electron Builder 优化:');
  console.log('   - 设置 includeSubNodeModules: false');
  console.log('   - 移除不必要的文件');
  console.log('   - 启用 removePackageScripts');
  
  console.log('\n5. 预期效果:');
  console.log('   - 减少 50-70% 的最终打包大小');
  console.log('   - 从 200MB+ 减少到 60-100MB');
}

analyzeBundle();
optimizationSuggestions(); 