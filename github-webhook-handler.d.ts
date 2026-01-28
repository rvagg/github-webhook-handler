/// <reference types="node" />

import { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'

interface CreateHandlerOptions {
  path: string
  secret: string
  events?: string | string[]
}

interface Handler extends EventEmitter {
  (req: IncomingMessage, res: ServerResponse, callback: (err?: Error) => void): void
  sign(data: string | Buffer): string
  verify(signature: string, data: string | Buffer): boolean
}

declare function createHandler (options: CreateHandlerOptions | CreateHandlerOptions[]): Handler

export default createHandler
