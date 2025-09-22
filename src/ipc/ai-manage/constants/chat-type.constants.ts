/**
 * AI对话类型常量
 */
export const CHAT_TYPE = {
  /** 普通对话 */
  CHAT: 'chat',
  /** 知识卡片问答 */
  CARD: 'card',
  /** 文档问答 */
  DOC: 'doc'
} as const

export type ChatType = typeof CHAT_TYPE[keyof typeof CHAT_TYPE]

/**
 * 对话类型显示名称映射
 */
export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  [CHAT_TYPE.CHAT]: '对话',
  [CHAT_TYPE.CARD]: '知识卡片问答',
  [CHAT_TYPE.DOC]: '文档问答'
}

/**
 * 验证对话类型是否有效
 */
export function isValidChatType(chatType: string): chatType is ChatType {
  return Object.values(CHAT_TYPE).includes(chatType as ChatType)
}

/**
 * 获取对话类型显示名称
 */
export function getChatTypeLabel(chatType: ChatType): string {
  return CHAT_TYPE_LABELS[chatType] || '未知类型'
} 