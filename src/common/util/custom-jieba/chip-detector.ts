/**
 * 芯片检测工具
 * 用于判断当前运行的芯片架构
 */

import { execSync } from 'child_process'
import * as os from 'os'

export class ChipDetector {
  private static _isIntel: boolean | null = null

  /**
   * 检测是否需要使用自定义分词器（仅 macOS Intel 芯片需要）
   */
  static needsCustomJieba(): boolean {
    if (this._isIntel !== null) {
      return this._isIntel
    }

    try {
      // 只有 macOS Intel 芯片需要使用自定义分词器
      if (process.platform === 'darwin') {
        try {
          const result = execSync('uname -m', { encoding: 'utf8', timeout: 1000 }).trim()
          this._isIntel = result === 'x86_64' // macOS Intel
          return this._isIntel
        } catch (error) {
          console.warn('无法执行 uname -m 命令:', error)
          // 如果无法检测，保守地使用自定义分词器
          this._isIntel = true
          return true
        }
      }

      // Windows、Linux 等其他平台都使用 @node-rs/jieba
      this._isIntel = false
      return false

    } catch (error) {
      console.error('芯片检测失败:', error)
      // 发生错误时，保守地假设需要自定义分词器
      this._isIntel = true
      return true
    }
  }

  /**
   * 检测是否为 Intel 芯片（保持向后兼容）
   * @deprecated 请使用 needsCustomJieba()
   */
  static isIntel(): boolean {
    return this.needsCustomJieba()
  }

  /**
   * 检测是否为 Apple Silicon (M1/M2)
   */
  static isAppleSilicon(): boolean {
    if (process.platform !== 'darwin') {
      return false
    }

    try {
      const result = execSync('uname -m', { encoding: 'utf8', timeout: 1000 }).trim()
      return result === 'arm64'
    } catch (error) {
      return false
    }
  }

  /**
   * 获取芯片架构信息
   */
  static getArchInfo(): {
    arch: string
    platform: string
    isIntel: boolean
    isAppleSilicon: boolean
    needsCustomJieba: boolean
    jiebaStrategy: string
  } {
    const needsCustom = this.needsCustomJieba()
    const isAppleSilicon = this.isAppleSilicon()
    
    let strategy = ''
    if (process.platform === 'darwin') {
      strategy = isAppleSilicon ? '@node-rs/jieba (macOS M芯片)' : '自定义分词器 (macOS Intel)'
    } else if (process.platform === 'win32') {
      strategy = '@node-rs/jieba (Windows)'
    } else {
      strategy = '@node-rs/jieba (Linux)'
    }
    
    return {
      arch: os.arch(),
      platform: process.platform,
      isIntel: this.isIntel(), // 保持向后兼容
      isAppleSilicon: isAppleSilicon,
      needsCustomJieba: needsCustom,
      jiebaStrategy: strategy
    }
  }

  /**
   * 重置检测缓存（用于测试）
   */
  static resetCache(): void {
    this._isIntel = null
  }
}

