// 架构检测和原生模块加载辅助工具
import { arch } from 'os';

export function getCurrentArch(): string {
  return arch();
}

export function loadJiebaWithFallback() {
  try {
    const jieba = require('@node-rs/jieba');
    console.log(`@node-rs/jieba loaded successfully on ${getCurrentArch()}`);
    return jieba;
  } catch (error) {
    console.error(`Failed to load @node-rs/jieba on ${getCurrentArch()}:`, error.message);
    throw error;
  }
}
