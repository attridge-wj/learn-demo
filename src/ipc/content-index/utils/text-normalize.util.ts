export function normalizeForIndexing(text: string): string {
  if (!text) return ''
  let s = text
  // 修复英文断词：将单词末尾的连字符 + 空白 + 单词首字母 连接起来
  // 例如: TraceMon- key -> TraceMonkey
  // 应用多次直到不再变化，防止多处断词
  let prev: string
  const hyphenation = /([A-Za-z])-[\s\u00A0]+([A-Za-z])/g
  do {
    prev = s
    s = s.replace(hyphenation, '$1$2')
  } while (s !== prev)

  // 统一空白为单个空格
  s = s.replace(/[\t\r\n\v\f]+/g, ' ')
  s = s.replace(/\s{2,}/g, ' ')

  return s
} 