
// 检测关键词是否在内容中
export const isKeywordInContent = (content: string, keyword: string): boolean => {
  if (!content || !keyword) return false
  
  const lowerContent = content.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  
  // 分词处理
  const words = lowerKeyword.split(/\s+/).filter(word => word.length > 0)
  
  // 检查是否所有词都在内容中
  return words.every(word => lowerContent.includes(word))
}

  // 提取包含关键词的文本片段
export const extractSnippet = (content: string, keyword: string, maxLength: number = 200): string => {
  if (!content || !keyword) return ''
    
  const lowerContent = content.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const index = lowerContent.indexOf(lowerKeyword)
    
  if (index === -1) {
    // 如果找不到完整关键词，返回开头片段
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '')
  }
    
  // 计算片段起始和结束位置
  const start = Math.max(0, index - maxLength / 2)
  const end = Math.min(content.length, index + keyword.length + maxLength / 2)
    
  let snippet = content.substring(start, end)
    
  // 添加省略号
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'
    
  // 高亮关键词
  const regex = new RegExp(`(${keyword})`, 'gi')
  snippet = snippet.replace(regex, '**$1**')
    
  return snippet
}


// 计算相关性分数
export const calculateRelevanceScore = (content: string, keyword: string): number => {
  if (!content || !keyword) return 0
    
  const lowerContent = content.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
    
  // 计算关键词出现次数
  const matches = lowerContent.match(new RegExp(lowerKeyword, 'g'))
  const count = matches ? matches.length : 0
    
  // 计算关键词密度
  const density = count / content.length
    
  // 计算位置权重（关键词越靠前分数越高）
  const firstIndex = lowerContent.indexOf(lowerKeyword)
  const positionWeight = firstIndex >= 0 ? 1 / (firstIndex + 1) : 0
    
  // 综合分数
  return count * 10 + density * 1000 + positionWeight * 100
}