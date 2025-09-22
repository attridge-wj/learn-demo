export function extractPlainText(input: string): string {
  if (!input) return ''

  const decodeEntities = (s: string): string =>
    s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

  const stripHtml = (s: string): string => decodeEntities(s.replace(/<[^>]+>/g, ' '))

  const toPlainFromAny = (node: any): string => {
    if (node == null) return ''
    const t = typeof node
    if (t === 'string') return stripHtml(node)
    if (Array.isArray(node)) return node.map(toPlainFromAny).filter(Boolean).join(' ')
    if (t === 'object') return Object.values(node).map(toPlainFromAny).filter(Boolean).join(' ')
    return ''
  }

  const collectAllStrings = (node: any, out: string[]) => {
    if (node == null) return
    if (typeof node === 'string') {
      const v = stripHtml(node)
      if (v) out.push(v)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) collectAllStrings(item, out)
      return
    }
    if (typeof node === 'object') {
      for (const v of Object.values(node)) collectAllStrings(v, out)
      return
    }
  }

  const allowedKeys = new Set(['text', 'name', 'content', 'description', 'marktext'])

  let text = ''
  try {
    // 仅提取指定键（text、name、content、description、markText）的值
    const obj = JSON.parse(input)
    const parts: string[] = []

    const visit = (node: any) => {
      if (node == null) return
      if (Array.isArray(node)) {
        for (const item of node) visit(item)
        return
      }
      if (typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          const k = String(key).toLowerCase()
          if (allowedKeys.has(k)) {
            const extracted = toPlainFromAny(value)
            if (extracted) parts.push(extracted)
          }
          // 继续向下递归，查找更深层的匹配键
          visit(value)
        }
      }
    }

    visit(obj)

    if (parts.length === 0) {
      // 回退到收集所有字符串字段，避免遗漏重要文本
      const all: string[] = []
      collectAllStrings(obj, all)
      text = all.join(' ')
    } else {
      text = parts.join(' ')
    }
  } catch {
    // 非 JSON，按普通字符串处理（去 HTML 标签 + 解码实体）
    text = stripHtml(input)
  }

  // 压缩空白
  text = text.replace(/[\t\r\n\v\f]+/g, ' ')
  text = text.replace(/\s{2,}/g, ' ').trim()
  return text
}

/**
 * 提取多维表 attrList 的文本内容
 * @param attrList 属性列表
 * @returns 提取的文本
 */
export function extractMultiTableAttrListText(attrList: any): string {
  if (!attrList) return ''
  
  try {
    const parsed = typeof attrList === 'string' ? JSON.parse(attrList) : attrList
    if (!Array.isArray(parsed)) return ''
    
    const texts: string[] = []
    
    parsed.forEach(attr => {
      if (attr && typeof attr === 'object') {
        // 提取 title 字段
        if (attr.title && typeof attr.title === 'string') {
          texts.push(attr.title)
        }
        
        // 提取 options 中的 label 字段
        if (attr.options && Array.isArray(attr.options)) {
          attr.options.forEach((option: any) => {
            if (option && option.label && typeof option.label === 'string') {
              texts.push(option.label)
            }
          })
        }
      }
    })
    
    return texts.join(' ')
  } catch (error) {
    console.warn('提取多维表 attrList 文本失败:', error)
    return ''
  }
}

/**
 * 提取多维表 viewList 的文本内容
 * @param viewList 视图列表
 * @returns 提取的文本
 */
export function extractMultiTableViewListText(viewList: any): string {
  if (!viewList) return ''
  
  try {
    const parsed = typeof viewList === 'string' ? JSON.parse(viewList) : viewList
    if (!Array.isArray(parsed)) return ''
    
    const texts: string[] = []
    
    parsed.forEach(view => {
      if (view && typeof view === 'object' && view.name && typeof view.name === 'string') {
        texts.push(view.name)
      }
    })
    
    return texts.join(' ')
  } catch (error) {
    console.warn('提取多维表 viewList 文本失败:', error)
    return ''
  }
}

/**
 * 提取多维表 data 的文本内容
 * @param data 数据列表
 * @returns 提取的文本
 */
export function extractMultiTableDataText(data: any): string {
  if (!data) return ''
  
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (!Array.isArray(parsed)) return ''
    
    const texts: string[] = []
    const systemFields = new Set(['id', 'createTime', 'updateTime', 'checked', 'relateCardType', 'relateCardId'])
    
    parsed.forEach(item => {
      if (item && typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => {
          // 跳过系统字段
          if (systemFields.has(key)) return
          
          // 提取字符串值
          if (typeof value === 'string' && value.trim()) {
            texts.push(value.trim())
          }
          // 提取数字值
          else if (typeof value === 'number') {
            texts.push(String(value))
          }
        })
      }
    })
    
    return texts.join(' ')
  } catch (error) {
    console.warn('提取多维表 data 文本失败:', error)
    return ''
  }
}

/**
 * 提取多维表完整文本内容
 * @param data 数据
 * @param attrList 属性列表
 * @param viewList 视图列表
 * @returns 提取的文本
 */
export function extractMultiTableText(data: any, attrList: any, viewList: any): string {
  const dataText = extractMultiTableDataText(data)
  const attrText = extractMultiTableAttrListText(attrList)
  const viewText = extractMultiTableViewListText(viewList)
  
  return [dataText, attrText, viewText].filter(Boolean).join(' ')
} 