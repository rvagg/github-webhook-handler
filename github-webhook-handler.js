const EventEmitter = require('events').EventEmitter
    , inherits     = require('util').inherits
    , crypto       = require('crypto')
    , bl           = require('bl')
    , bufferEq     = require('buffer-equal-constant-time')

function create (options) {
  if (typeof options != 'object')
    throw new TypeError('must provide an options object')

  if (typeof options.path != 'string')
    throw new TypeError('must provide a \'path\' option')

  if (typeof options.secret != 'string')
    throw new TypeError('must provide a \'secret\' option')

  var events

  if (typeof options.events == 'string' && options.events != '*')
    events = [ options.events ]

  else if (Array.isArray(options.events) && options.events.indexOf('*') == -1)
    events = options.events

  // make it an EventEmitter, sort of
  handler.__proto__ = EventEmitter.prototype
  EventEmitter.call(handler)

  handler.sign = sign
  handler.verify = verify

  return handler


  function sign (data) {
    return 'sha1=' + crypto.createHmac('sha1', options.secret).update(data).digest('hex')
  }

  function verify (signature, data) {
    return bufferEq(Buffer.from(signature), Buffer.from(sign(data)))
  }

  function handler (req, res, callback) {
    if (req.url.split('?').shift() !== options.path || req.method !== 'POST')
      return callback()

    function hasError (msg) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: msg }))

      var err = new Error(msg)

      handler.emit('error', err, req)
      callback(err)
    }

    var sig   = req.headers['x-hub-signature']
      , event = req.headers['x-github-event']
      , id    = req.headers['x-github-delivery']

    if (!sig)
      return hasError('No X-Hub-Signature found on request')

    if (!event)
      return hasError('No X-Github-Event found on request')

    if (!id)
      return hasError('No X-Github-Delivery found on request')

    if (events && events.indexOf(event) == -1)
      return hasError('X-Github-Event is not acceptable')

    req.pipe(bl(function (err, data) {
      if (err) {
        return hasError(err.message)
      }

      var obj

      if (!verify(sig, data))
        return hasError('X-Hub-Signature does not match blob signature')

      try {
        obj = JSON.parse(data.toString())
      } catch (e) {
        return hasError(e)
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')

      var emitData = {
          event   : event
        , id      : id
        , payload : obj
        , protocol: req.protocol
        , host    : req.headers['host']
        , url     : req.url
      }

      handler.emit(event, emitData)
      handler.emit('*', emitData)
    }))
  }
}


module.exports = create
