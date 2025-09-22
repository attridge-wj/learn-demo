import { getDeviceInfo, generateDeviceFingerprint } from '../util/deviceInfo';

export async function getSystemDeviceInfo() {
  try {
    const deviceInfo = await getDeviceInfo();
    return {
      ...deviceInfo,
      deviceFingerprint: generateDeviceFingerprint(deviceInfo)
    };
  } catch (error: any) {
    console.error('获取设备信息失败:', error);
    return {
      error: error.message,
      machineId: '',
      hostname: '',
      platform: '',
      arch: '',
      cpus: '',
      totalMemory: 0,
      macAddresses: [],
      deviceFingerprint: ''
    };
  }
} 