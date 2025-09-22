/**
 * 时间工具函数
 * 统一处理时间格式，确保与本地时间一致
 */

/**
 * 获取当前本地时间字符串
 * 格式：YYYY-MM-DD HH:mm:ss
 * 时区：Asia/Shanghai (UTC+8)
 */
export function getCurrentLocalTimeString(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/[/:]/g, '-').replace(/\s/g, '_');
}

/**
 * 获取当前本地时间字符串（用于显示）
 * 格式：YYYY-MM-DD HH:mm:ss
 */
export function getCurrentLocalTimeDisplayString(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 将本地时间字符串转换为Date对象
 * 支持格式：YYYY-MM-DD_HH-mm-ss 或 YYYY-MM-DD HH:mm:ss
 */
export function parseLocalTimeString(timeString: string): Date {
  // 统一格式处理
  const normalizedString = timeString.replace(/_/g, ' ').replace(/-/g, ':');
  return new Date(normalizedString);
}

/**
 * 比较两个本地时间字符串
 * 返回：-1 (timeA < timeB), 0 (timeA = timeB), 1 (timeA > timeB)
 */
export function compareLocalTimeStrings(timeA: string, timeB: string): number {
  const dateA = parseLocalTimeString(timeA);
  const dateB = parseLocalTimeString(timeB);
  return dateA.getTime() - dateB.getTime();
}

/**
 * 获取时间差（毫秒）
 */
export function getTimeDifference(timeA: string, timeB: string): number {
  const dateA = parseLocalTimeString(timeA);
  const dateB = parseLocalTimeString(timeB);
  return Math.abs(dateA.getTime() - dateB.getTime());
}

/**
 * 格式化时间差为可读字符串
 */
export function formatTimeDifference(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 获取同步时间格式的本地时间字符串
 * 格式：2025/09/03 15:25:29 （与getSyncTime保持一致）
 */
export function getSyncTimeFormat(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 将时间字符串转换为ISO格式（用于数据库查询）
 * 支持多种输入格式：
 * - ISO格式: "2025-09-03T07:12:37.125Z"
 * - 本地格式: "2025/09/03 15:25:29" 
 */
export function toISOString(timeString: string): string {
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string');
    }
    return date.toISOString();
  } catch (error) {
    console.error('时间转换失败:', error, 'input:', timeString);
    return timeString;
  }
}

/**
 * 将ISO时间字符串转换为同步时间格式
 * 格式: 2025/09/03 15:25:29
 */
export function toSyncTimeFormat(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string');
    }
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('时间转换失败:', error, 'input:', isoString);
    return isoString;
  }
}

/**
 * 检查字符串是否为ISO时间格式
 */
export function isISOFormat(timeString: string): boolean {
  return timeString.includes('T') && (timeString.includes('Z') || timeString.includes('+'));
}

/**
 * 检查字符串是否为同步时间格式
 */
export function isSyncTimeFormat(timeString: string): boolean {
  return /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(timeString);
}
