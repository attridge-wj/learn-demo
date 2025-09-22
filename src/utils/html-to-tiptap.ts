export type TiptapTextMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'link'; attrs: { href: string; target?: string | null; rel?: string | null; class?: string | null; uid?: string } }

export type TiptapNode =
  | { type: 'text'; text: string; marks?: TiptapTextMark[] }
  | { type: 'paragraph'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 } & Record<string, any>; content?: TiptapNode[] }
  | { type: 'bulletList'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'orderedList'; attrs?: { start?: number } & Record<string, any>; content?: TiptapNode[] }
  | { type: 'listItem'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'blockquote'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'codeBlock'; attrs?: { language?: string | null } & Record<string, any>; content?: TiptapNode[] }
  | { type: 'hardBreak' }
  | { type: 'horizontalRule'; attrs?: Record<string, any> }
  | { type: 'image'; attrs: { src: string; alt?: string | null; title?: string | null } & Record<string, any> }
  | { type: 'table'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'tableRow'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'tableCell'; attrs?: { colspan?: number; rowspan?: number; colwidth?: number[] | null; style?: string | null } & Record<string, any>; content?: TiptapNode[] }
  | { type: 'tableHeader'; attrs?: { colspan?: number; rowspan?: number; colwidth?: number[] | null; style?: string | null } & Record<string, any>; content?: TiptapNode[] }
  | { type: 'taskList'; attrs?: Record<string, any>; content?: TiptapNode[] }
  | { type: 'taskItem'; attrs?: { checked?: boolean } & Record<string, any>; content?: TiptapNode[] }

export type TiptapDoc = { type: 'doc'; content: TiptapNode[] }

// Node.js 环境下的 DOM 节点类型常量
const NODE_TYPES = {
  TEXT_NODE: 3,
  ELEMENT_NODE: 1
}
import { v4 as uuidv4 } from 'uuid'

// 生成唯一 ID
function generateUid(): string {
  return uuidv4()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/[\t\r\n\v\f]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function hasDOM(): boolean {
  return typeof window !== 'undefined' && !!(window.document && window.document.createElement)
}

function parseHtml(html: string): Document | null {
  try {
    // 在 Node.js 环境中使用 jsdom
    if (typeof window === 'undefined' || !window.document) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { JSDOM } = require('jsdom')
        const dom = new JSDOM(html, { contentType: 'text/html' })
        return dom.window.document
      } catch (e) {
        console.warn('jsdom not available, falling back to text extraction:', e)
        return null
      }
    }
    
    // 在浏览器环境中使用 DOMParser
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser().parseFromString(html, 'text/html')
    }
    
    if (hasDOM()) {
      const d = document.implementation.createHTMLDocument('tmp')
      d.body.innerHTML = html
      return d
    }
  } catch (e) {
    console.warn('HTML parsing failed:', e)
  }
  return null
}

function pushText(buffer: TiptapNode[], text: string, marks?: TiptapTextMark[]) {
  if (!text) return
  buffer.push({ type: 'text', text, ...(marks && marks.length ? { marks } : {}) })
}

function marksFromStyle(style: string | null | undefined): TiptapTextMark[] {
  if (!style) return []
  const s = style.toLowerCase()
  const out: TiptapTextMark[] = []
  if (/font-weight\s*:\s*(bold|[6-9]00)/.test(s)) out.push({ type: 'bold' })
  if (/font-style\s*:\s*italic/.test(s)) out.push({ type: 'italic' })
  if (/text-decoration\s*:\s*[^;]*underline/.test(s)) out.push({ type: 'underline' })
  if (/text-decoration\s*:\s*[^;]*(line-through|strike)/.test(s)) out.push({ type: 'strike' })
  return out
}

function isInlineTiptapNode(n: TiptapNode): boolean {
  return n.type === 'text' || n.type === 'hardBreak'
}

function serializeInline(node: ChildNode, activeMarks: TiptapTextMark[]): TiptapNode[] {
  const out: TiptapNode[] = []
  const nodeType = (node as Element).nodeType
  if (nodeType === NODE_TYPES.TEXT_NODE) {
    const text = decodeEntities((node.textContent || '').replace(/\s+/g, ' '))
    if (text.trim()) pushText(out, text, activeMarks)
    return out
  }
  if (nodeType !== NODE_TYPES.ELEMENT_NODE) return out
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') {
    out.push({ type: 'hardBreak' } as TiptapNode)
    return out
  }

  const nextMarks = [...activeMarks]
  // Tag-derived marks
  switch (tag) {
    case 'strong':
    case 'b':
      nextMarks.push({ type: 'bold' }); break
    case 'em':
    case 'i':
      nextMarks.push({ type: 'italic' }); break
    case 'u':
      nextMarks.push({ type: 'underline' }); break
    case 's':
    case 'strike':
    case 'del':
      nextMarks.push({ type: 'strike' }); break
    case 'code': {
      if (el.parentElement && el.parentElement.tagName.toLowerCase() !== 'pre') {
        nextMarks.push({ type: 'code' })
      }
      break
    }
    case 'a': {
      const hrefRaw = el.getAttribute('href') || ''
      const href = hrefRaw.trim()
      if (href) {
        const target = el.getAttribute('target')
        const rel = el.getAttribute('rel')
        const cls = el.getAttribute('class')
        nextMarks.push({ type: 'link', attrs: { href, target, rel, class: cls, uid: generateUid() } })
      }
      break
    }
    case 'kbd':
    case 'samp':
      nextMarks.push({ type: 'code' }); break
  }
  // Style-derived marks
  for (const m of marksFromStyle(el.getAttribute('style'))) nextMarks.push(m)

  for (const child of Array.from(el.childNodes)) {
    out.push(...serializeInline(child, nextMarks))
  }
  return out
}

function wrapParagraphIfNeeded(nodes: TiptapNode[]): TiptapNode[] {
  if (nodes.length === 0) return []
  if (nodes.every(isInlineTiptapNode)) {
    const content = nodes.filter(n => !(n.type === 'text' && (n as any).text.trim() === ''))
    return [{ type: 'paragraph', attrs: { uid: generateUid() }, ...(content.length ? { content } : {}) }]
  }
  return nodes
}

function ensureListItemContent(children: TiptapNode[]): TiptapNode[] {
  if (children.length === 0) return [{ type: 'paragraph', attrs: { uid: generateUid() } }]
  if (children[0].type === 'paragraph') return children
  // 提取前缀行内内容作为段落头
  const inlineHead: TiptapNode[] = []
  let idx = 0
  for (; idx < children.length; idx++) {
    const n = children[idx]
    if (isInlineTiptapNode(n)) {
      inlineHead.push(n)
      continue
    }
    if (n.type === 'paragraph') break
    // 第一个块级出现则停止
    break
  }
  const result: TiptapNode[] = []
  if (inlineHead.length > 0) result.push({ type: 'paragraph', attrs: { uid: generateUid() }, content: inlineHead } as TiptapNode)
  result.push(...children.slice(inlineHead.length))
  if (result.length === 0 || result[0].type !== 'paragraph') result.unshift({ type: 'paragraph', attrs: { uid: generateUid() } } as TiptapNode)
  return result
}

function serializeTable(tableEl: Element): TiptapNode | null {
  const rows: TiptapNode[] = []
  const trEls = Array.from(tableEl.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'))
  if (trEls.length === 0) return null
  for (const tr of trEls) {
    const cells: TiptapNode[] = []
    for (const cell of Array.from(tr.children)) {
      const tag = cell.tagName.toLowerCase()
      if (tag !== 'td' && tag !== 'th') continue
      const cellContent = wrapParagraphIfNeeded(serializeChildren(cell))
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10) || 1
      const style = cell.getAttribute('style') || null
      const attrs = { colspan, rowspan, colwidth: null as any, style }
      cells.push({ type: tag === 'th' ? 'tableHeader' : 'tableCell', attrs: { ...attrs, uid: generateUid() }, ...(cellContent.length ? { content: cellContent } : {}) })
    }
    rows.push({ type: 'tableRow', attrs: { uid: generateUid() }, content: cells })
  }
  return { type: 'table', attrs: { uid: generateUid() }, content: rows }
}

function serializeFigure(el: Element): TiptapNode | null {
  const img = el.querySelector('img')
  if (!img) return null
  const src = img.getAttribute('src') || ''
  if (!src) return null
  const alt = img.getAttribute('alt')
  const title = img.getAttribute('title')
  const caption = el.querySelector('figcaption')?.textContent?.trim()
  const titleFinal = title ?? (caption ? caption : null)
  return { type: 'image', attrs: { src, alt: alt ?? null, title: titleFinal, uid: generateUid() } }
}

function serializeBlock(el: Element): TiptapNode | null {
  const tag = el.tagName.toLowerCase()
  switch (tag) {
    case 'p': {
      const content = Array.from(el.childNodes).flatMap(n => serializeInline(n, []))
      return { type: 'paragraph', attrs: { textAlign: null, indent: 0, uid: generateUid() }, ...(content.length ? { content } : {}) }
    }
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const level = Number(tag.slice(1)) as 1|2|3|4|5|6
      const content = Array.from(el.childNodes).flatMap(n => serializeInline(n, []))
      return { type: 'heading', attrs: { level, folded: false, textAlign: null, uid: generateUid() }, ...(content.length ? { content } : {}) }
    }
    case 'ul': {
      // 识别任务列表（包含 checkbox）
      const liEls = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li') as Element[]
      const isTask = liEls.some(li => !!li.querySelector('input[type="checkbox"]'))
      if (isTask) {
        const items: TiptapNode[] = []
        for (const li of liEls) {
          const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null
          const checked = !!(checkbox && checkbox.checked)
          if (checkbox) checkbox.remove()
          const liChildren = serializeChildren(li)
          const liContent = ensureListItemContent(wrapParagraphIfNeeded(liChildren))
          items.push({ type: 'taskItem', attrs: { checked }, content: liContent })
        }
        return { type: 'taskList', attrs: { uid: generateUid() }, content: items }
      }
      const items: TiptapNode[] = []
      for (const li of liEls) {
        const liChildren = serializeChildren(li)
        const liContent = ensureListItemContent(wrapParagraphIfNeeded(liChildren))
        items.push({ type: 'listItem', content: liContent })
      }
      return { type: 'bulletList', attrs: { tight: true, uid: generateUid() }, content: items }
    }
    case 'ol': {
      const startAttr = el.getAttribute('start')
      const start = startAttr ? parseInt(startAttr, 10) : 1
      const items: TiptapNode[] = []
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        const liChildren = serializeChildren(li)
        const liContent = ensureListItemContent(wrapParagraphIfNeeded(liChildren))
        items.push({ type: 'listItem', content: liContent })
      }
      return { type: 'orderedList', attrs: { start, tight: true, uid: generateUid() }, content: items }
    }
    case 'li': {
      const liChildren = serializeChildren(el)
      return { type: 'listItem', attrs: { uid: generateUid() }, content: wrapParagraphIfNeeded(liChildren) }
    }
    case 'blockquote': {
      const inner = serializeChildren(el)
      const content: TiptapNode[] = inner.length
        ? (inner.every(isInlineTiptapNode) ? ([{ type: 'paragraph', attrs: { uid: generateUid() }, content: inner } as TiptapNode]) : inner)
        : ([{ type: 'paragraph', attrs: { uid: generateUid() } } as TiptapNode])
      return { type: 'blockquote', attrs: { uid: generateUid() }, content }
    }
    case 'pre': {
      const codeEl = el.querySelector('code')
      const text = (codeEl?.textContent ?? el.textContent ?? '').replace(/\r\n/g, '\n')
      const content: TiptapNode[] = text ? [{ type: 'text', text } as TiptapNode] : []
      const cls = (codeEl?.getAttribute('class') || '') + ' ' + (el.getAttribute('class') || '')
      const m = cls.match(/(?:^|\s)language-([a-z0-9+#-]+)/i)
      const language = m ? m[1].toLowerCase() : null
      return { type: 'codeBlock', attrs: { language, uid: generateUid() }, ...(content.length ? { content } : {}) }
    }
    case 'hr': return { type: 'horizontalRule', attrs: { uid: generateUid() } }
    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt')
      const title = el.getAttribute('title')
      if (!src) return null
      return { type: 'image', attrs: { src, alt: alt ?? null, title: title ?? null, uid: generateUid() } }
    }
    case 'figure': {
      return serializeFigure(el)
    }
    case 'table': {
      return serializeTable(el)
    }
    case 'br': {
      const content: TiptapNode[] = [{ type: 'hardBreak' } as TiptapNode]
      return { type: 'paragraph', attrs: { uid: generateUid() }, content }
    }
    // 常见容器标签，直接透传其子内容，避免错误包裹
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
    case 'aside': {
      const children = serializeChildren(el)
      if (children.length > 0) {
        if (children.every(isInlineTiptapNode)) {
          return { type: 'paragraph', attrs: { uid: generateUid() }, content: children }
        }
        const firstBlock = children.find(c => !isInlineTiptapNode(c))
        return firstBlock || null
      }
      return null
    }
    default: {
      const children = serializeChildren(el)
      if (children.length === 0) return null
      // 仅保留行内内容生成段落，避免将块级节点塞进段落
      const inline: TiptapNode[] = []
      for (const n of children) {
        if (n.type === 'paragraph' && Array.isArray(n.content) && n.content.every(isInlineTiptapNode)) {
          inline.push(...(n.content || []))
        } else if (isInlineTiptapNode(n)) {
          inline.push(n)
        }
      }
      if (inline.length > 0) {
        return { type: 'paragraph', attrs: { uid: generateUid() }, content: inline }
      }
      // 找到第一个非段落且非行内的块级节点返回
      const block = children.find(n => n.type !== 'paragraph' && !isInlineTiptapNode(n))
      return block || null
    }
  }
}

function serializeChildren(el: Element | ParentNode): TiptapNode[] {
  const nodes: TiptapNode[] = []
  const containerTags = new Set(['div','section','article','main','header','footer','nav','aside'])
  const inlineTags = new Set(['strong','b','em','i','u','s','strike','del','code','span','a','kbd','samp','br'])

  let inlineBuf: TiptapNode[] = []
  const flushInlineToParagraph = () => {
    if (inlineBuf.length === 0) return
    nodes.push({ type: 'paragraph', attrs: { uid: generateUid() }, content: inlineBuf } as TiptapNode)
    inlineBuf = []
  }

  const serializeContainerChildren = (container: Element) => {
    let containerInlineBuf: TiptapNode[] = []
    const pushInline = () => {
      if (containerInlineBuf.length > 0) {
        nodes.push({ type: 'paragraph', attrs: { uid: generateUid() }, content: containerInlineBuf } as TiptapNode)
        containerInlineBuf = []
      }
    }
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === NODE_TYPES.TEXT_NODE) {
        const text = decodeEntities((child.textContent || '').replace(/\s+/g, ' '))
        if (text.trim()) containerInlineBuf.push({ type: 'text', text } as TiptapNode)
        continue
      }
      if (child.nodeType !== NODE_TYPES.ELEMENT_NODE) continue
      const childEl = child as Element
      const tag = childEl.tagName.toLowerCase()
      if (containerTags.has(tag)) {
        pushInline()
        serializeContainerChildren(childEl)
        continue
      }
      if (inlineTags.has(tag)) {
        const inline = serializeInline(childEl as unknown as ChildNode, [])
        if (inline.length) containerInlineBuf.push(...inline)
        continue
      }
      // 尝试当作块级元素序列化
      const block = serializeBlock(childEl)
      if (block) {
        pushInline()
        nodes.push(block)
        continue
      }
      // 否则当作行内内容
      const inline = Array.from(childEl.childNodes).flatMap(n => serializeInline(n, []))
      if (inline.length) containerInlineBuf.push(...inline)
    }
    pushInline()
  }

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === NODE_TYPES.TEXT_NODE) {
      const text = decodeEntities((child.textContent || '').replace(/\s+/g, ' '))
      if (text.trim()) inlineBuf.push({ type: 'text', text } as TiptapNode)
      continue
    }
    if (child.nodeType !== NODE_TYPES.ELEMENT_NODE) continue
    const elem = child as Element
    const tag = elem.tagName.toLowerCase()
    if (containerTags.has(tag)) {
      flushInlineToParagraph()
      serializeContainerChildren(elem)
      continue
    }
    if (inlineTags.has(tag)) {
      const inline = serializeInline(elem as unknown as ChildNode, [])
      if (inline.length) inlineBuf.push(...inline)
      continue
    }
    const n = serializeBlock(elem)
    if (n) {
      flushInlineToParagraph()
      nodes.push(n)
      continue
    }
    // Fallback：将其子节点当作行内内容
    const inline = Array.from(elem.childNodes).flatMap(n => serializeInline(n, []))
    if (inline.length) inlineBuf.push(...inline)
  }
  flushInlineToParagraph()
  return nodes
}

function normalizeTopLevelBlocks(blocks: TiptapNode[]): TiptapNode[] {
  const result: TiptapNode[] = []
  let inlineBuf: TiptapNode[] = []
  const flushInline = () => {
    if (inlineBuf.length > 0) {
      result.push({ type: 'paragraph', attrs: { uid: generateUid() }, content: inlineBuf } as TiptapNode)
      inlineBuf = []
    }
  }
  for (const node of blocks) {
    if (isInlineTiptapNode(node)) {
      inlineBuf.push(node)
    } else {
      flushInline()
      result.push(node)
    }
  }
  flushInline()
  return result
}

function sanitizeNode(node: TiptapNode): TiptapNode {
  switch (node.type) {
    case 'paragraph': {
      const content = Array.isArray(node.content) ? node.content.filter(isInlineTiptapNode) : undefined
      return { type: 'paragraph', attrs: { uid: generateUid() }, ...(content && content.length ? { content } : {}) }
    }
    case 'heading': {
      const level = (node as any).attrs?.level as 1|2|3|4|5|6
      const content = Array.isArray(node.content) ? node.content.filter(isInlineTiptapNode) : undefined
      return { type: 'heading', attrs: { level, uid: generateUid() }, ...(content && content.length ? { content } : {}) }
    }
    case 'blockquote': {
      const content = Array.isArray(node.content) ? node.content.map(sanitizeNode) : []
      return { type: 'blockquote', attrs: { uid: generateUid() }, content: content.length ? content : ([{ type: 'paragraph' } as TiptapNode]) }
    }
    case 'listItem': {
      const children = Array.isArray(node.content) ? node.content.map(sanitizeNode) : []
      const ensured = ensureListItemContent(children)
      return { type: 'listItem', attrs: { uid: generateUid() }, content: ensured }
    }
    case 'bulletList':
    case 'orderedList': {
      const items = Array.isArray(node.content) ? node.content.map(sanitizeNode) : []
      return { type: node.type as any, attrs: { ...(node.type === 'orderedList' ? (node as any).attrs : {}), uid: generateUid() }, content: items }
    }
    default:
      return node
  }
}

function sanitizeDoc(doc: TiptapDoc): TiptapDoc {
  const content = (doc.content || []).map(sanitizeNode)
  return { type: 'doc', content }
}

export function htmlToTiptap(html: string): TiptapDoc {
  if (!html || html.trim() === '') {
    return { type: 'doc', content: [{ type: 'paragraph', attrs: { uid: generateUid() } }] }
  }
  
  const doc = parseHtml(html)
  if (!doc) {
    console.warn('HTML parsing failed, falling back to text extraction')
    const text = stripHtmlToText(html)
    const content: TiptapNode[] = text ? [{ type: 'text', text } as TiptapNode] : []
    return { type: 'doc', content: [{ type: 'paragraph', attrs: { uid: generateUid() }, ...(content.length ? { content } : {}) }] }
  }
  
  const blocks = serializeChildren(doc.body)
  const normalized = normalizeTopLevelBlocks(blocks)
  const content: TiptapNode[] = normalized.length ? normalized : [{ type: 'paragraph', attrs: { uid: generateUid() } }]
  return sanitizeDoc({ type: 'doc', content })
}

export function htmlToTiptapFirstContent(html: string, maxItems = 5): TiptapDoc {
  const full = htmlToTiptap(html)
  const n = Math.max(0, Math.min(maxItems, full.content.length))
  return { type: 'doc', content: full.content.slice(0, n) }
}
