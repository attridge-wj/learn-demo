import * as fs from 'fs'
import * as crypto from 'crypto'
import { resolveFilePath } from './file-content-parse'

export function calculateFileMd5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const realPath = resolveFilePath(filePath)
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(realPath)

    stream.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        hash.update(Buffer.from(chunk))
      } else {
        hash.update(chunk)
      }
    })

    stream.on('end', () => {
      try {
        const digest = hash.digest('hex')
        resolve(digest)
      } catch (err) {
        reject(err)
      }
    })

    stream.on('error', (err) => {
      reject(err)
    })
  })
} 