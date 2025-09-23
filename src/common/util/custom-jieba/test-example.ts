/**
 * 自定义分词器测试示例
 * 用于验证分词效果
 */

import { CustomJieba } from './index'
import { ChipDetector } from './chip-detector'

// 测试函数
async function testCustomJieba() {
  console.log('=== 自定义分词器测试 ===')
  
  // 显示芯片信息
  const archInfo = ChipDetector.getArchInfo()
  console.log('芯片架构信息:', archInfo)
  console.log(`分词策略: ${archInfo.jiebaStrategy}`)
  
  const jieba = new CustomJieba()
  
  // 测试文本
  const testTexts = [
    '中文分词是自然语言处理的基础',
    '计算机科学与技术专业',
    '人工智能和机器学习算法',
    '软件开发工程师需要掌握编程语言',
    '数据库管理系统的设计与实现',
    'JavaScript和TypeScript开发',
    '前端框架Vue.js和React',
    '后端服务器Node.js应用'
  ]
  
  console.log('\n=== 精确模式分词测试 ===')
  testTexts.forEach(text => {
    const result = jieba.cut(text, true)
    console.log(`原文: ${text}`)
    console.log(`分词: [${result.join(', ')}]`)
    console.log('---')
  })
  
  console.log('\n=== 搜索模式分词测试 ===')
  testTexts.forEach(text => {
    const result = jieba.cutForSearch(text)
    console.log(`原文: ${text}`)
    console.log(`分词: [${result.join(', ')}]`)
    console.log('---')
  })
}

// 导出测试函数
export { testCustomJieba }
