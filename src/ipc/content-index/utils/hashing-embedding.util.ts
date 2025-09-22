import { ChineseSegmentUtil } from '../../../common/util/chinese-segment.util'

const DEFAULT_DIMENSION = 2048

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // 32-bit FNV-1a prime multiplication
    hash = (hash + ((hash << 1) >>> 0) + ((hash << 4) >>> 0) + ((hash << 7) >>> 0) + ((hash << 8) >>> 0) + ((hash << 24) >>> 0)) >>> 0
  }
  return hash >>> 0
}

function generateCharNGrams(text: string, minN = 2, maxN = 3): string[] {
  const s = (text || '').replace(/\s+/g, '')
  const grams: string[] = []
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= s.length; i++) {
      grams.push(s.slice(i, i + n))
    }
  }
  return grams
}

export function tokenizeForHashing(text: string): string[] {
  if (!text) return []
  const jiebaTokens = ChineseSegmentUtil.extractKeywords(text)
  const ngrams = generateCharNGrams(text)
  // 合并去重
  const set = new Set<string>()
  for (const t of jiebaTokens) {
    const trimmed = t.trim()
    if (trimmed.length > 0) set.add(trimmed)
  }
  for (const g of ngrams) set.add(g)
  return Array.from(set)
}

export function hashingEmbed(text: string, dim: number = DEFAULT_DIMENSION): Float32Array {
  const vec = new Float32Array(dim)
  if (!text) return vec

  const tokens = tokenizeForHashing(text)
  if (tokens.length === 0) return vec

  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }

  for (const [token, count] of tf) {
    const h = fnv1a32(token)
    const index = h % dim
    const sign = ((h >>> 31) & 1) === 0 ? 1 : -1
    const weight = Math.log1p(count)
    vec[index] += sign * weight
  }

  // L2 归一化
  let norm = 0
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm
  }

  return vec
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) sum += a[i] * b[i]
  return sum
} 