import { AppDataSource } from '../../database/connection'
import { CustomJieba } from './custom-jieba'
import { ChipDetector } from './custom-jieba/chip-detector'

/**
 * 中文分词工具类 - 智能选择分词器
 * Intel 芯片自动降级使用自定义分词器，Apple Silicon 使用 @node-rs/jieba
 */
export class ChineseSegmentUtil {
  private static jieba: any = null
  private static customJieba: CustomJieba | null = null
  private static useCustomJieba: boolean = false
  private static initialized: boolean = false

  /**
   * 异步初始化分词器
   */
  private static async initJieba() {
    if (this.initialized) {
      return // 已初始化
    }

    try {
      // 检测是否需要使用自定义分词器
      const needsCustom = ChipDetector.needsCustomJieba()
      const archInfo = ChipDetector.getArchInfo()
      console.log(`检测到平台: ${archInfo.platform} (${archInfo.arch})`)
      console.log(`分词策略: ${archInfo.jiebaStrategy}`)

      if (needsCustom) {
        // 仅 macOS Intel 使用自定义分词器
        console.log('使用自定义分词器 (macOS Intel 兼容)')
        this.customJieba = new CustomJieba()
        this.useCustomJieba = true
      } else {
        // Windows 和 macOS M芯片使用原生 jieba
        console.log(`尝试加载 @node-rs/jieba (${archInfo.platform})`)
        try {
          // 动态导入 jieba
          const { Jieba } = await import('@node-rs/jieba')
          this.jieba = new Jieba()
          this.useCustomJieba = false
          console.log('成功加载 @node-rs/jieba')
        } catch (jiebaError) {
          console.warn('@node-rs/jieba 加载失败，降级使用自定义分词器:', jiebaError)
          this.customJieba = new CustomJieba()
          this.useCustomJieba = true
        }
      }
      
      this.initialized = true
    } catch (error) {
      console.warn('分词器初始化失败，降级使用自定义分词器:', error)
      this.customJieba = new CustomJieba()
      this.useCustomJieba = true
      this.initialized = true
    }
  }

  /**
   * 获取分词器实例
   */
  private static async getJieba(): Promise<any> {
    await this.initJieba()
    return this.useCustomJieba ? this.customJieba! : this.jieba!
  }
  
  // 停用词列表
  private static stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'
  ])

  private static isAsciiAlnum(word: string): boolean {
    return /^[A-Za-z0-9]+$/.test(word)
  }

  private static isAllCjk(word: string): boolean {
    return /^[\u4E00-\u9FFF]+$/.test(word)
  }

  private static cjkBigrams(word: string): string[] {
    const result: string[] = []
    if (!this.isAllCjk(word)) return result
    for (let i = 0; i < word.length - 1; i++) {
      const bg = word.slice(i, i + 2)
      result.push(bg)
    }
    return result
  }

  private static cjkBigramsFromText(text: string): string[] {
    const out: string[] = []
    let buf = ''
    const flush = () => {
      if (buf.length >= 2) {
        // 对连续 CJK 片段做双字切分
        for (let i = 0; i < Math.min(buf.length, 64) - 1; i++) {
          out.push(buf.slice(i, i + 2))
        }
      }
      buf = ''
    }
    for (const ch of text) {
      if (/^[\u4E00-\u9FFF]$/.test(ch)) buf += ch
      else flush()
    }
    flush()
    return out
  }

  /**
   * 使用 jieba 进行分词（精确模式）
   */
  static async segment(text: string): Promise<string[]> {
    if (!text || typeof text !== 'string') {
      return []
    }
    try {
      const jieba = await this.getJieba()
      const words = jieba.cut(text, true)
      return words.filter((word: string) => word.trim().length > 0)
    } catch (error) {
      console.error('分词失败:', error)
      return []
    }
  }

  /**
   * 智能分词（搜索模式，产生重叠词，利于召回如"节点/子节点"）
   */
  static async smartSegment(text: string): Promise<string[]> {
    if (!text || typeof text !== 'string') {
      return []
    }
    try {
      const jieba = await this.getJieba()
      const words = jieba.cutForSearch(text)
      const filtered = words
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
        .filter((w: string) => !this.stopWords.has(w))
        .filter((w: string) => !this.isPunctuation(w))
        // ASCII/数字要求长度>=2；中文/其他脚本要求长度>=2（避免大量单字噪音）
        .filter((w: string) => (this.isAsciiAlnum(w) ? w.length >= 2 : w.length >= 2))

      // 结合 CJK 双字词（仅针对纯中文 token 生成，控制规模）
      const withBigrams: string[] = [...filtered]
      for (const w of filtered) {
        if (this.isAllCjk(w) && w.length <= 12) {
          const bgs = this.cjkBigrams(w)
          for (const bg of bgs) {
            if (!this.stopWords.has(bg)) withBigrams.push(bg)
          }
        }
      }
      // 从原始文本生成 CJK 双字词，确保“子节”等跨词边界片段也被保留
      for (const bg of this.cjkBigramsFromText(text)) {
        if (!this.stopWords.has(bg)) withBigrams.push(bg)
      }

      // 去重，保持顺序
      const seen = new Set<string>()
      const deduped: string[] = []
      for (const w of withBigrams) {
        if (!seen.has(w)) { seen.add(w); deduped.push(w) }
      }
      return deduped
    } catch (error) {
      console.error('智能分词失败:', error)
      return []
    }
  }

  /**
   * 提取关键词（用于索引/搜索）
   */
  static async extractKeywords(text: string): Promise<string[]> {
    if (!text || typeof text !== 'string') {
      return []
    }
    try {
      // 使用搜索模式，保留"节点/子节点"等重叠词
      const jieba = await this.getJieba()
      const words = jieba.cutForSearch(text)
      const filtered = words
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
        .filter((w: string) => !this.stopWords.has(w))
        .filter((w: string) => !this.isPunctuation(w))
        .filter((w: string) => (this.isAsciiAlnum(w) ? w.length >= 2 : w.length >= 2))

      // 补充 CJK 双字词，避免“子节/节点”缺失
      const withBigrams: string[] = [...filtered]
      for (const w of filtered) {
        if (this.isAllCjk(w) && w.length <= 12) {
          const bgs = this.cjkBigrams(w)
          for (const bg of bgs) {
            if (!this.stopWords.has(bg)) withBigrams.push(bg)
          }
        }
      }
      for (const bg of this.cjkBigramsFromText(text)) {
        if (!this.stopWords.has(bg)) withBigrams.push(bg)
      }

      const seen = new Set<string>()
      const deduped: string[] = []
      for (const w of withBigrams) {
        if (!seen.has(w)) { seen.add(w); deduped.push(w) }
      }
      return deduped
    } catch (error) {
      console.error('关键词提取失败:', error)
      return []
    }
  }

  /**
   * 将分词结果转换为搜索关键词
   * @param text 原始文本
   * @returns 搜索关键词字符串
   */
  static async toSearchKeywords(text: string): Promise<string> {
    const keywords = await this.extractKeywords(text)
    return keywords.join(' ')
  }

  /**
   * 检查文本是否包含关键词
   * @param text 文本
   * @param keyword 关键词
   * @returns 是否包含
   */
  static async containsKeyword(text: string, keyword: string): Promise<boolean> {
    const textKeywords = await this.extractKeywords(text)
    const searchKeywords = await this.extractKeywords(keyword)
    return searchKeywords.some(searchWord => 
      textKeywords.some(textWord => textWord.includes(searchWord) || searchWord.includes(textWord))
    )
  }

  /**
   * 同步版本的分词方法（仅使用自定义分词器，用于兼容旧代码）
   * @deprecated 推荐使用异步版本的 segment() 方法
   */
  static segmentSync(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return []
    }
    try {
      // 强制使用自定义分词器，避免异步问题
      if (!this.customJieba) {
        this.customJieba = new CustomJieba()
      }
      const words = this.customJieba.cut(text, true)
      return words.filter((word: string) => word.trim().length > 0)
    } catch (error) {
      console.error('同步分词失败:', error)
      return []
    }
  }

  /**
   * 同步版本的搜索关键词方法（仅使用自定义分词器，用于兼容旧代码）
   * @deprecated 推荐使用异步版本的 toSearchKeywords() 方法
   */
  static toSearchKeywordsSync(text: string): string {
    if (!text || typeof text !== 'string') {
      return ''
    }
    try {
      // 强制使用自定义分词器，避免异步问题
      if (!this.customJieba) {
        this.customJieba = new CustomJieba()
      }
      const words = this.customJieba.cutForSearch(text)
      const filtered = words
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
        .filter((w: string) => !this.stopWords.has(w))
        .filter((w: string) => !this.isPunctuation(w))
        .filter((w: string) => (this.isAsciiAlnum(w) ? w.length >= 2 : w.length >= 2))

      return filtered.join(' ')
    } catch (error) {
      console.error('同步搜索关键词提取失败:', error)
      return ''
    }
  }

  /**
   * 判断是否为标点符号
   */
  private static isPunctuation(word: string): boolean {
    return /^[^\w\u4e00-\u9fa5]+$/.test(word)
  }

  /**
   * 更新指定文档的分词
   */
  static async updateDocumentSegmentation(documentId: string): Promise<void> {
    try {
      // 获取文档内容
      const document = await AppDataSource.query(`
        SELECT * FROM document_page_content WHERE document_id = ?
      `, [documentId])

      if (document.length === 0) {
        return
      }

      const content = document[0].content || ''
      
      // 进行分词
      const segmentedContent = await this.toSearchKeywords(content)
      
      // 更新FTS表中的分词字段
      await AppDataSource.query(`
        UPDATE document_page_content_fts 
        SET content_segmented = ? 
        WHERE document_id = ?
      `, [segmentedContent, documentId])
      
      console.log('文档分词更新完成:', documentId)
    } catch (error) {
      console.error('更新文档分词失败:', error)
    }
  }

  /**
   * 批量更新所有文档的分词字段
   */
  static async updateAllDocumentSegmentation(): Promise<void> {
    try {
      console.log('开始批量更新文档分词...')
      
      const documents = await AppDataSource.query(`
        SELECT document_id, content FROM document_page_content
      `)
      
      let updatedCount = 0
      for (const doc of documents) {
        const content = doc.content || ''
        const segmentedContent = await this.toSearchKeywords(content)
        
        await AppDataSource.query(`
          UPDATE document_page_content_fts 
          SET content_segmented = ? 
          WHERE document_id = ?
        `, [segmentedContent, doc.document_id])
        
        updatedCount++
      }
      
      console.log(`批量更新完成，共更新 ${updatedCount} 个文档`)
    } catch (error) {
      console.error('批量更新文档分词失败:', error)
    }
  }
} 