const { notarize } = require('@electron/notarize');

// 重试函数
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 指数退避：5s, 10s, 20s
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // 检查是否有必要的环境变量
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.log('Skipping notarization: APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set');
    return;
  }

  console.log(`Notarizing ${appName}...`);

  try {
    await retryWithBackoff(async () => {
      console.log('Attempting notarization...');
      return await notarize({
        appBundleId: 'com.rebirth.app',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: '48N382RB7X'
      });
    });
    console.log('Notarization successful!');
  } catch (error) {
    console.error('Notarization failed after all retries:', error.message);
    
    // 如果是网络错误，给出更友好的提示
    if (error.message.includes('offline') || error.message.includes('network') || error.message.includes('NSURLErrorDomain')) {
      console.error('Network connection issue detected. This is likely a temporary GitHub Actions network problem.');
      console.error('The build will continue without notarization. You can manually notarize later if needed.');
      return; // 不抛出错误，让构建继续
    }
    
    throw error; // 其他错误仍然抛出
  }
};
