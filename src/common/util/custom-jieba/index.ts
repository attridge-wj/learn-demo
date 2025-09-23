/**
 * 自定义中文分词器 - Intel 芯片兼容方案
 * 提供与 @node-rs/jieba 相同的接口
 */

import { Dictionary } from './dictionary'

export class CustomJieba {
  private dictionary: Dictionary

  constructor() {
    this.dictionary = new Dictionary()
  }

  /**
   * 精确模式分词 - 对应 jieba.cut(text, true)
   */
  cut(text: string, hmm: boolean = true): string[] {
    if (!text || typeof text !== 'string') {
      return []
    }

    return this.cutInternal(text, false)
  }

  /**
   * 搜索模式分词 - 对应 jieba.cutForSearch(text)
   */
  cutForSearch(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return []
    }

    return this.cutInternal(text, true)
  }

  /**
   * 内部分词实现
   */
  private cutInternal(text: string, forSearch: boolean): string[] {
    const result: string[] = []
    let i = 0

    while (i < text.length) {
      const char = text[i]

      // 处理英文和数字
      if (this.isAscii(char)) {
        const word = this.extractAsciiWord(text, i)
        if (word.length > 0) {
          result.push(word)
          i += word.length
        } else {
          i++
        }
        continue
      }

      // 处理标点符号
      if (this.isPunctuation(char)) {
        if (!this.isWhitespace(char)) {
          result.push(char)
        }
        i++
        continue
      }

      // 处理中文字符
      if (this.isChinese(char)) {
        const word = this.extractChineseWord(text, i, forSearch)
        if (word.length > 0) {
          if (forSearch && word.length > 2) {
            // 搜索模式：长词切分为子词
            result.push(...this.splitLongWord(word))
          } else {
            result.push(word)
          }
          i += word.length
        } else {
          result.push(char)
          i++
        }
        continue
      }

      // 其他字符
      result.push(char)
      i++
    }

    return result.filter(word => word.trim().length > 0)
  }

  /**
   * 提取ASCII词汇（英文、数字）
   */
  private extractAsciiWord(text: string, start: number): string {
    let end = start
    while (end < text.length && this.isAscii(text[end]) && !this.isWhitespace(text[end])) {
      end++
    }
    return text.substring(start, end)
  }

  /**
   * 提取中文词汇
   */
  private extractChineseWord(text: string, start: number, forSearch: boolean): string {
    // 简单的最大匹配算法
    let maxWord = ''
    let maxLen = 0

    // 尝试不同长度的词汇匹配
    const maxWordLen = Math.min(8, text.length - start) // 最大词长度限制为8
    
    for (let len = 1; len <= maxWordLen; len++) {
      const word = text.substring(start, start + len)
      
      // 检查是否为有效中文词汇
      if (this.isValidChineseWord(word)) {
        if (this.dictionary.contains(word) || len === 1) {
          maxWord = word
          maxLen = len
        }
      }
    }

    return maxWord || text[start]
  }

  /**
   * 长词切分（搜索模式）
   */
  private splitLongWord(word: string): string[] {
    const result: string[] = [word] // 保留完整词

    // 生成子词
    if (word.length >= 3) {
      for (let i = 0; i < word.length - 1; i++) {
        for (let len = 2; len <= Math.min(4, word.length - i); len++) {
          if (i + len <= word.length) {
            const subWord = word.substring(i, i + len)
            if (this.dictionary.contains(subWord)) {
              result.push(subWord)
            }
          }
        }
      }
    }

    // 去重
    return [...new Set(result)]
  }

  /**
   * 检查是否为ASCII字符
   */
  private isAscii(char: string): boolean {
    return /[A-Za-z0-9]/.test(char)
  }

  /**
   * 检查是否为中文字符
   */
  private isChinese(char: string): boolean {
    return /[\u4e00-\u9fa5]/.test(char)
  }

  /**
   * 检查是否为标点符号
   */
  private isPunctuation(char: string): boolean {
    return /[^\w\u4e00-\u9fa5]/.test(char)
  }

  /**
   * 检查是否为空白字符
   */
  private isWhitespace(char: string): boolean {
    return /\s/.test(char)
  }

  /**
   * 检查是否为有效的中文词汇
   */
  private isValidChineseWord(word: string): boolean {
    return /^[\u4e00-\u9fa5]+$/.test(word)
  }
}
