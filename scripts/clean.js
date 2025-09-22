const fs = require('fs');
const path = require('path');

// 清理构建文件
function cleanBuildFiles() {
  console.log('=== 清理构建文件 ===\n');
  
  const dirsToClean = [
    path.join(__dirname, '../dist'),
    path.join(__dirname, '../release')
  ];
  
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`清理目录: ${dir}`);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✓ 已清理: ${dir}`);
    } else {
      console.log(`目录不存在: ${dir}`);
    }
  });
  
  console.log('\n清理完成！');
}

cleanBuildFiles(); 