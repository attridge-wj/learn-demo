/*
  MCP 服务器（基于 @modelcontextprotocol/sdk）
  - 工具：
    1) card:list     -> 查询卡片列表（QueryCardDto）
    2) card:getOne   -> 查询卡片详情（id）
  - 传输：
    - stdio（默认）：适用于由客户端以子进程方式启动
    - websocket（可选）：设置 MCP_WS_ENABLED=1，MCP_WS_PORT=33355（可选）
  - 依赖（未安装则自动降级为 no-op 并打印提示）：
      @modelcontextprotocol/sdk, zod
*/

import type { QueryCardDto } from './ipc/card/dto/query-card.dto'
import { getAllCards } from './ipc/card/service/card-get-all.service'
import { getOneCard } from './ipc/card/service/card-get-one.service'

let ServerCtor: any
let StdioServerTransportCtor: any
let WebSocketServerTransportCtor: any
let z: any

function tryLoadMcpDeps(): boolean {
  try {
    const req = (eval('require') as NodeRequire)
    ServerCtor = req('@modelcontextprotocol/sdk/server/index').Server
    StdioServerTransportCtor = req('@modelcontextprotocol/sdk/server/stdio').StdioServerTransport
    try {
      // 可选：WebSocket 传输
      WebSocketServerTransportCtor = req('@modelcontextprotocol/sdk/server/websocket').WebSocketServerTransport
    } catch {}
    z = req('zod')
    return true
  } catch (e) {
    console.warn('[MCP] 未检测到依赖 @modelcontextprotocol/sdk 或 zod，MCP 服务未启动。')
    console.warn('[MCP] 请安装：npm i -S @modelcontextprotocol/sdk zod')
    return false
  }
}

export async function startMcpServer(): Promise<void> {
  const ok = tryLoadMcpDeps()
  if (!ok) return

  const server = new ServerCtor({
    name: 'rebirth-mcp',
    version: '0.1.0',
  })

  // 工具：查询卡片列表
  server.tool(
    {
      name: 'card:list',
      description: '查询卡片列表（遵循系统的 QueryCardDto 参数）',
      inputSchema: z
        .object({
          cardType: z.string().optional(),
          subType: z.string().optional(),
          spaceId: z.string().optional(),
          boxId: z.string().optional(),
          text: z.string().optional(),
          name: z.string().optional(),
          tagIds: z.string().optional(),
          tagId: z.string().optional(),
          extraData: z.string().optional(),
          keyword: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          markNumber: z.number().optional(),
          sortType: z.string().optional(),
          isCollect: z.string().optional(),
          sourceId: z.string().optional(),
        })
        .strict(),
    },
    async ({ input }: { input: QueryCardDto }) => {
      const result = await getAllCards(input || {})
      return {
        content: [
          { type: 'text', text: JSON.stringify({ items: result }) },
        ],
      }
    }
  )

  // 工具：查询卡片详情
  server.tool(
    {
      name: 'card:getOne',
      description: '根据 id 查询卡片详情',
      inputSchema: z
        .object({ id: z.string().min(1) })
        .strict(),
    },
    async ({ input }: { input: { id: string } }) => {
      const card = await getOneCard(input.id)
      return {
        content: [
          { type: 'text', text: JSON.stringify({ card }) },
        ],
      }
    }
  )

  // 启动 stdio 传输
  try {
    const transport = new StdioServerTransportCtor()
    await server.connect(transport)
    console.log('[MCP] stdio transport started')
  } catch (e) {
    console.warn('[MCP] 无法启动 stdio 传输：', e)
  }

  // 可选：启动 WebSocket 传输，便于外部应用通过 URL 连接
  if (process.env.MCP_WS_ENABLED === '1' && WebSocketServerTransportCtor) {
    const port = Number(process.env.MCP_WS_PORT || 33355)
    try {
      const wsTransport = new WebSocketServerTransportCtor({ port })
      await server.connect(wsTransport)
      console.log(`[MCP] websocket transport started at ws://127.0.0.1:${port}`)
    } catch (e) {
      console.warn('[MCP] 无法启动 websocket 传输：', e)
    }
  }
}

export default {
  startMcpServer,
}
