const EventEmitter = require('events').EventEmitter
    , inherits     = require('util').inherits
    , crypto       = require('crypto')
    , bl           = require('bl')


function signBlob (key, blob) {
  return 'sha1=' + crypto.createHmac('sha1', key).update(blob).digest('hex')
}


function create (options) {
  if (typeof options != 'object')
    throw new TypeError('must provide an options object')

  if (typeof options.path != 'string')
    throw new TypeError('must provide a \'path\' option')

  if (typeof options.secret != 'string')
    throw new TypeError('must provide a \'secret\' option')

  // make it an EventEmitter, sort of
  handler.__proto__ = EventEmitter.prototype
  EventEmitter.call(handler)

  return handler


  function handler (req, res, callback) {
    if (req.url.split('?').shift() !== options.path)
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

    req.pipe(bl(function (err, data) {
      if (err) {
        return hasError(err.message)
      }

      var obj

      if (sig !== signBlob(options.secret, data))
        return hasError('X-Hub-Signature does not match blob signature')

      try {
        obj = JSON.parse(data.toString())
      } catch (e) {
        return hasError(e)
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')

      handler.emit(event, {
          event   : event
        , id      : id
        , payload : obj
        , url     : req.url
      })
    }))
  }
}


module.exports = create
