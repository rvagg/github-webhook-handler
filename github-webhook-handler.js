import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'
import bl from 'bl'

/**
 * @typedef {Object} CreateHandlerOptions
 * @property {string} path
 * @property {string} secret
 * @property {string | string[]} [events]
 */

/**
 * @typedef {Object} WebhookEvent
 * @property {string} event - The event type (e.g. 'push', 'issues')
 * @property {string} id - The delivery ID from X-Github-Delivery header
 * @property {any} payload - The parsed JSON payload
 * @property {string} [protocol] - The request protocol
 * @property {string} [host] - The request host header
 * @property {string} url - The request URL
 * @property {string} path - The matched handler path
 */

/**
 * @param {string} url
 * @param {CreateHandlerOptions | CreateHandlerOptions[]} arr
 * @returns {CreateHandlerOptions}
 */
function findHandler (url, arr) {
  if (!Array.isArray(arr)) {
    return arr
  }

  let ret = arr[0]
  for (let i = 0; i < arr.length; i++) {
    if (url === arr[i].path) {
      ret = arr[i]
    }
  }

  return ret
}

/**
 * @param {CreateHandlerOptions} options
 */
function checkType (options) {
  if (typeof options !== 'object') {
    throw new TypeError('must provide an options object')
  }

  if (typeof options.path !== 'string') {
    throw new TypeError("must provide a 'path' option")
  }

  if (typeof options.secret !== 'string') {
    throw new TypeError("must provide a 'secret' option")
  }
}

/**
 * @param {CreateHandlerOptions | CreateHandlerOptions[]} initOptions
 * @returns {EventEmitter & {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, callback: (err?: Error) => void): void, sign(data: string | Buffer): string, verify(signature: string, data: string | Buffer): boolean}}
 */
function create (initOptions) {
  /** @type {CreateHandlerOptions} */
  let options
  if (Array.isArray(initOptions)) {
    for (let i = 0; i < initOptions.length; i++) {
      checkType(initOptions[i])
    }
  } else {
    checkType(initOptions)
  }

  // @ts-ignore - handler is a callable EventEmitter via setPrototypeOf
  Object.setPrototypeOf(handler, EventEmitter.prototype)
  // @ts-ignore
  EventEmitter.call(handler)

  handler.sign = sign
  handler.verify = verify

  // @ts-ignore
  return handler

  /**
   * @param {string | Buffer} data
   * @returns {string}
   */
  function sign (data) {
    return `sha1=${crypto.createHmac('sha1', options.secret).update(data).digest('hex')}`
  }

  /**
   * @param {string} signature
   * @param {string | Buffer} data
   * @returns {boolean}
   */
  function verify (signature, data) {
    const sig = Buffer.from(signature)
    const signed = Buffer.from(sign(data))
    if (sig.length !== signed.length) {
      return false
    }
    return crypto.timingSafeEqual(sig, signed)
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {(err?: Error) => void} callback
   */
  function handler (req, res, callback) {
    /** @type {string[] | undefined} */
    let events

    options = findHandler(/** @type {string} */ (req.url), initOptions)

    if (typeof options.events === 'string' && options.events !== '*') {
      events = [options.events]
    } else if (Array.isArray(options.events) && options.events.indexOf('*') === -1) {
      events = options.events
    }

    if (req.url !== options.path || req.method !== 'POST') {
      return callback()
    }

    /**
     * @param {string} msg
     */
    function hasError (msg) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: msg }))

      const err = new Error(msg)

      // @ts-ignore - handler has EventEmitter prototype
      handler.emit('error', err, req)
      callback(err)
    }

    const sig = req.headers['x-hub-signature']
    const event = req.headers['x-github-event']
    const id = req.headers['x-github-delivery']

    if (!sig) {
      return hasError('No X-Hub-Signature found on request')
    }

    if (!event) {
      return hasError('No X-Github-Event found on request')
    }

    if (!id) {
      return hasError('No X-Github-Delivery found on request')
    }

    if (events && events.indexOf(/** @type {string} */ (event)) === -1) {
      return hasError('X-Github-Event is not acceptable')
    }

    req.pipe(bl((err, data) => {
      if (err) {
        return hasError(err.message)
      }

      let obj

      if (!verify(/** @type {string} */ (sig), data)) {
        return hasError('X-Hub-Signature does not match blob signature')
      }

      try {
        obj = JSON.parse(data.toString())
      } catch (e) {
        return hasError(/** @type {Error} */ (e).message)
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')

      const emitData = {
        event,
        id,
        payload: obj,
        protocol: /** @type {any} */ (req).protocol,
        host: req.headers.host,
        url: req.url,
        path: options.path
      }

      // @ts-ignore - handler has EventEmitter prototype
      handler.emit(event, emitData)
      // @ts-ignore - handler has EventEmitter prototype
      handler.emit('*', emitData)
    }))
  }
}

export default create
