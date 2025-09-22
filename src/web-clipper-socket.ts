import type { WebSocketServer as WsServerType, WebSocket as WsType } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import { CreateCardDto } from './ipc/card/dto/create-card.dto'
import { createCard } from './ipc/card/service/card-create.service'
import { extractPlainText } from './ipc/content-index/utils/plain-text.util'
import { htmlToTiptap, htmlToTiptapFirstContent } from './utils/html-to-tiptap'
import store from './utils/store'
import { getMainWindow } from './window-manage'

const DEFAULT_WS_PORT = 29335
const WS_PATH = '/ws'

let wss: WsServerType | null = null
let WebSocketServerRuntime: any = null
let WebSocketRuntime: any = null

function ensureWsLoaded(): void {
  if (WebSocketServerRuntime && WebSocketRuntime) return
  try {
    process.env.WS_NO_BUFFER_UTIL = '1'
    process.env.WS_NO_UTF_8_VALIDATE = '1'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wsLib = (eval('require') as NodeRequire)('ws') as typeof import('ws')
    WebSocketServerRuntime = wsLib.WebSocketServer
    WebSocketRuntime = wsLib.WebSocket
  } catch (e) {
    console.error('动态加载 ws 失败:', e)
    throw e
  }
}

function normalizeString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

async function saveClipPayload(payload: any) {
  const url = normalizeString(payload?.url)
  const title = normalizeString(payload?.title)
  const selectionText = normalizeString(payload?.selectionText)
  const selectionHtml = payload?.selectionHtml
  const fullPageText = normalizeString(payload?.fullPageText)
  const fullPageHtml = payload?.fullPageHtml


  // 生成编辑器内容：优先 HTML -> TipTap（前 5 段），否则用纯文本
  const content = htmlToTiptap(selectionHtml || fullPageHtml || '')
  const extraData = htmlToTiptapFirstContent(selectionHtml || fullPageHtml || '')
  const dto: CreateCardDto = {
    id: uuidv4(),
    cardType: 'card',
    name: title || '网页剪藏',
    url,
    text: selectionText || fullPageText || '',
    extraData: extraData ? JSON.stringify(extraData) : null,
    subType: 'web-clip',
    spaceId: store.get('spaceId'),
    content: content ? JSON.stringify(content) : null
  }

  await createCard(dto)
  // 保存成功后，通知渲染进程刷新列表
  try {
    getMainWindow()?.webContents.send('card:list:refresh', {
      source: 'web-clipper',
      id: dto.id,
      spaceId: dto.spaceId,
    })
  } catch (e) {
    console.warn('发送刷新事件到渲染进程失败:', e)
  }
}

export function startWebClipperSocket(port = DEFAULT_WS_PORT): void {
  if (wss) return
  ensureWsLoaded()
  try {
    wss = new WebSocketServerRuntime({ port, path: WS_PATH }) as WsServerType
  } catch (e) {
    console.error('WebClipper WebSocket 启动失败:', e)
    return
  }

  wss.on('connection', (ws: WsType) => {
    ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg?.type === 'clip') {
          await saveClipPayload(msg.payload)
          ws.send(JSON.stringify({ ok: true }))
        } else {
          ws.send(JSON.stringify({ ok: false, error: 'unknown_type' }))
        }
      } catch (err: unknown) {
        console.error('处理剪藏消息失败:', err)
        try { ws.send(JSON.stringify({ ok: false, error: String((err as any)?.message || err) })) } catch {}
      }
    })
  })

  wss.on('listening', () => {
    const addr = (wss as any)?.address?.()
    console.log('WebClipper WebSocket 已监听:', addr)
  })

  wss.on('error', (err: unknown) => {
    console.error('WebClipper WebSocket 错误:', err)
  })

  app.on('will-quit', () => stopWebClipperSocket())
}

export function stopWebClipperSocket(): void {
  if (!wss) return
  try {
    ;(wss as any).clients.forEach((c: WsType) => { try { c.terminate() } catch {} })
    ;(wss as any).close()
  } catch (e) {
    console.warn('关闭 WebClipper WebSocket 异常:', e)
  } finally {
    wss = null
  }
}
