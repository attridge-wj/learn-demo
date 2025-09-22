import { machineIdSync } from 'node-machine-id';
import os from 'os';
import crypto from 'crypto';

// 平台特定的网络接口过滤规则
function getPlatformSpecificFilters(): {
  virtualInterfacePatterns: string[];
  preferredInterfacePatterns: string[];
} {
  const platform = os.platform();
  
  switch (platform) {
    case 'win32':
      return {
        virtualInterfacePatterns: [
          'vEthernet', 'VMware', 'VirtualBox', 'Hyper-V', 'Loopback', 
          'Bluetooth', 'Wi-Fi Direct', 'Teredo', '6TO4', 'ISATAP'
        ],
        preferredInterfacePatterns: ['Ethernet', 'Wi-Fi', 'Local Area Connection']
      };
    
    case 'darwin': // macOS
      return {
        virtualInterfacePatterns: [
          'bridge', 'utun', 'awdl', 'llw', 'lo', 'gif', 'stf', 'XHC'
        ],
        preferredInterfacePatterns: ['en0', 'en1', 'en2', 'en3']
      };
    
    case 'linux':
      return {
        virtualInterfacePatterns: [
          'docker', 'veth', 'br-', 'virbr', 'lo', 'tun', 'tap', 'ppp'
        ],
        preferredInterfacePatterns: ['eth', 'wlan', 'wifi']
      };
    
    default:
      return {
        virtualInterfacePatterns: ['virtual', 'tunnel', 'pseudo', 'lo'],
        preferredInterfacePatterns: []
      };
  }
}

// 检查是否为虚拟接口
function isVirtualInterface(interfaceName: string, platform: string): boolean {
  const filters = getPlatformSpecificFilters();
  const lowerInterfaceName = interfaceName.toLowerCase();
  
  return filters.virtualInterfacePatterns.some(pattern => 
    lowerInterfaceName.includes(pattern.toLowerCase())
  );
}

// 安全获取机器ID
function getSafeMachineId(): string {
  try {
    return machineIdSync(true);
  } catch (error) {
    console.warn('获取机器ID失败，使用备用方案:', error);
    // 备用方案：使用主机名和平台信息生成
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const fallbackId = crypto.createHash('sha256')
      .update(`${hostname}-${platform}-${arch}`)
      .digest('hex');
    return fallbackId;
  }
}

// 获取设备信息
export async function getDeviceInfo(): Promise<{
  machineId: string;
  hostname: string;
  platform: string;
  arch: string;
  cpus: string;
  totalMemory: number;
  macAddresses: string[];
}> {
  try {
    // 获取机器唯一标识符（带错误处理）
    const machineId = getSafeMachineId();
    
    // 获取主机名
    const hostname = os.hostname();
    
    // 获取平台信息
    const platform = os.platform();
    const arch = os.arch();
    
    // 获取CPU信息
    const cpus = os.cpus().map(cpu => cpu.model).join(', ');
    
    // 获取内存信息
    const totalMemory = os.totalmem();
    
    // 获取网络接口信息
    const networkInterfaces = os.networkInterfaces();
    
    // 提取MAC地址 - 跨平台兼容的物理网卡识别
    const macAddresses: string[] = [];
    Object.keys(networkInterfaces).forEach(interfaceName => {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        interfaces.forEach(interfaceInfo => {
          // 基础验证
          if (!interfaceInfo.mac || 
              interfaceInfo.mac === '00:00:00:00:00:00' ||
              interfaceInfo.internal) {
            return;
          }
          
          // 使用平台特定的虚拟接口检测
          if (isVirtualInterface(interfaceName, platform)) {
            return;
          }
          
          // 只获取IPv4接口
          if (interfaceInfo.family === 'IPv4') {
            macAddresses.push(interfaceInfo.mac);
          }
        });
      }
    });
    
    // 按MAC地址排序，确保顺序一致
    macAddresses.sort();
    
    return {
      machineId,
      hostname,
      platform,
      arch,
      cpus,
      totalMemory,
      macAddresses
    };
  } catch (error) {
    console.error('获取设备信息失败:', error);
    throw error;
  }
}

// 生成设备指纹（用于注册码绑定）
export function generateDeviceFingerprint(deviceInfo: any): string {
  const fingerprintData = {
    machineId: deviceInfo.machineId,
    hostname: deviceInfo.hostname,
    platform: deviceInfo.platform,
    arch: deviceInfo.arch,
    cpus: deviceInfo.cpus,
    macAddresses: deviceInfo.macAddresses.slice(0, 3).sort()
  };
  
  const sortedKeys = Object.keys(fingerprintData).sort();
  const fingerprintString = JSON.stringify(fingerprintData, sortedKeys);
  
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
} 