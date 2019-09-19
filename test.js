const test = require('tape')
const crypto = require('crypto')
const handler = require('./')
const through2 = require('through2')
const series = require('run-series')

function signBlob (key, blob) {
  return `sha1=${crypto.createHmac('sha1', key).update(blob).digest('hex')}`
}

function mkReq (url, method) {
  const req = through2()
  req.method = method || 'POST'
  req.url = url
  req.headers = {
    'x-hub-signature': 'bogus',
    'x-github-event': 'bogus',
    'x-github-delivery': 'bogus'
  }
  return req
}

function mkRes () {
  const res = {
    writeHead: function (statusCode, headers) {
      res.$statusCode = statusCode
      res.$headers = headers
    },

    end: function (content) {
      res.$end = content
    }
  }

  return res
}

test('handler without full options throws', (t) => {
  t.plan(4)

  t.equal(typeof handler, 'function', 'handler exports a function')

  t.throws(handler, /must provide an options object/, 'throws if no options')

  t.throws(handler.bind(null, {}), /must provide a 'path' option/, 'throws if no path option')

  t.throws(handler.bind(null, { path: '/' }), /must provide a 'secret' option/, 'throws if no secret option')
})

test('handler without full options throws in array', (t) => {
  t.plan(2)

  t.throws(handler.bind(null, [{}]), /must provide a 'path' option/, 'throws if no path option')

  t.throws(handler.bind(null, [{ path: '/' }]), /must provide a 'secret' option/, 'throws if no secret option')
})

test('handler ignores invalid urls', (t) => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  t.plan(6)

  h(mkReq('/'), mkRes(), (err) => {
    t.error(err)
    t.ok(true, 'request was ignored')
  })

  // near match
  h(mkReq('/some/url/'), mkRes(), (err) => {
    t.error(err)
    t.ok(true, 'request was ignored')
  })

  // partial match
  h(mkReq('/some'), mkRes(), (err) => {
    t.error(err)
    t.ok(true, 'request was ignored')
  })
})

test('handler ingores non-POST requests', (t) => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  t.plan(4)

  h(mkReq('/some/url', 'GET'), mkRes(), (err) => {
    t.error(err)
    t.ok(true, 'request was ignored')
  })

  h(mkReq('/some/url?test=param', 'GET'), mkRes(), (err) => {
    t.error(err)
    t.ok(true, 'request was ignored')
  })
})

test('handler accepts valid urls', (t) => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  t.plan(1)

  h(mkReq('/some/url'), mkRes(), (err) => {
    t.error(err)
    t.fail(false, 'should not call')
  })

  setTimeout(t.ok.bind(t, true, 'done'))
})

test('handler accepts valid urls in Array', (t) => {
  const options = [{ path: '/some/url', secret: 'bogus' }, { path: '/someOther/url', secret: 'bogus' }]
  const h = handler(options)

  t.plan(1)

  h(mkReq('/some/url'), mkRes(), (err) => {
    t.error(err)
    t.fail(false, 'should not call')
  })

  h(mkReq('/someOther/url'), mkRes(), (err) => {
    t.error(err)
    t.fail(false, 'should not call')
  })

  setTimeout(t.ok.bind(t, true, 'done'))
})

test('handler can reject events', (t) => {
  const acceptableEvents = {
    undefined: undefined,
    'a string equal to the event': 'bogus',
    'a string equal to *': '*',
    'an array containing the event': ['bogus'],
    'an array containing *': ['not-bogus', '*']
  }
  const unacceptableEvents = {
    'a string not equal to the event or *': 'not-bogus',
    'an array not containing the event or *': ['not-bogus']
  }
  const acceptable = Object.keys(acceptableEvents)
  const unacceptable = Object.keys(unacceptableEvents)
  const acceptableTests = acceptable.map((events) => {
    return acceptableReq.bind(null, events)
  })
  const unacceptableTests = unacceptable.map((events) => {
    return unacceptableReq.bind(null, events)
  })

  t.plan(acceptable.length + unacceptable.length)
  series(acceptableTests.concat(unacceptableTests))

  function acceptableReq (events, callback) {
    const h = handler({
      path: '/some/url',
      secret: 'bogus',
      events: acceptableEvents[events]
    })

    h(mkReq('/some/url'), mkRes(), (err) => {
      t.error(err)
      t.fail(false, 'should not call')
    })

    setTimeout(() => {
      t.ok(true, 'accepted because options.events was ' + events)
      callback()
    })
  }

  function unacceptableReq (events, callback) {
    const h = handler({
      path: '/some/url',
      secret: 'bogus',
      events: unacceptableEvents[events]
    })

    h.on('error', () => {})

    h(mkReq('/some/url'), mkRes(), (err) => {
      t.ok(err, 'rejected because options.events was ' + events)
      callback()
    })
  }
})

// because we don't inherit in a traditional way
test('handler is an EventEmitter', (t) => {
  t.plan(5)

  const h = handler({ path: '/', secret: 'bogus' })

  t.equal(typeof h.on, 'function', 'has h.on()')
  t.equal(typeof h.emit, 'function', 'has h.emit()')
  t.equal(typeof h.removeListener, 'function', 'has h.removeListener()')

  h.on('ping', (pong) => {
    t.equal(pong, 'pong', 'got event')
  })

  h.emit('ping', 'pong')

  t.throws(h.emit.bind(h, 'error', new Error('threw an error')), /threw an error/, 'acts like an EE')
})

test('handler accepts a signed blob', (t) => {
  t.plan(4)

  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'push'

  h.on('push', (event) => {
    t.deepEqual(event, { event: 'push', id: 'bogus', payload: obj, url: '/', host: undefined, protocol: undefined, path: '/' })
    t.equal(res.$statusCode, 200, 'correct status code')
    t.deepEqual(res.$headers, { 'content-type': 'application/json' })
    t.equal(res.$end, '{"ok":true}', 'got correct content')
  })

  h(req, res, (err) => {
    t.error(err)
    t.fail(true, 'should not get here!')
  })

  process.nextTick(() => {
    req.end(json)
  })
})

test('handler accepts multi blob in Array', (t) => {
  t.plan(4)

  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler([{ path: '/', secret: 'bogus' }, { path: '/some/url', secret: 'bogus' }])
  const req = mkReq('/some/url')
  const res = mkRes()
  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'push'

  h.on('push', (event) => {
    t.deepEqual(event, { event: 'push', id: 'bogus', payload: obj, url: '/some/url', host: undefined, protocol: undefined, path: '/some/url' })
    t.equal(res.$statusCode, 200, 'correct status code')
    t.deepEqual(res.$headers, { 'content-type': 'application/json' })
    t.equal(res.$end, '{"ok":true}', 'got correct content')
  })

  h(req, res, (err) => {
    t.error(err)
    t.fail(true, 'should not get here!')
  })

  process.nextTick(() => {
    req.end(json)
  })
})

test('handler accepts a signed blob with alt event', (t) => {
  t.plan(4)

  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'issue'

  h.on('push', (event) => {
    t.fail(true, 'should not get here!')
  })

  h.on('issue', (event) => {
    t.deepEqual(event, { event: 'issue', id: 'bogus', payload: obj, url: '/', host: undefined, protocol: undefined, path: '/' })
    t.equal(res.$statusCode, 200, 'correct status code')
    t.deepEqual(res.$headers, { 'content-type': 'application/json' })
    t.equal(res.$end, '{"ok":true}', 'got correct content')
  })

  h(req, res, (err) => {
    t.error(err)
    t.fail(true, 'should not get here!')
  })

  process.nextTick(() => {
    req.end(json)
  })
})

test('handler rejects a badly signed blob', (t) => {
  t.plan(6)

  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  // break signage by a tiny bit
  req.headers['x-hub-signature'] = '0' + req.headers['x-hub-signature'].substring(1)

  h.on('error', (err, _req) => {
    t.ok(err, 'got an error')
    t.strictEqual(_req, req, 'was given original request object')
    t.equal(res.$statusCode, 400, 'correct status code')
    t.deepEqual(res.$headers, { 'content-type': 'application/json' })
    t.equal(res.$end, '{"error":"X-Hub-Signature does not match blob signature"}', 'got correct content')
  })

  h.on('push', (event) => {
    t.fail(true, 'should not get here!')
  })

  h(req, res, (err) => {
    t.ok(err, 'got error on callback')
  })

  process.nextTick(() => {
    req.end(json)
  })
})

test('handler responds on a bl error', (t) => {
  t.plan(4)

  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'issue'

  h.on('push', (event) => {
    t.fail(true, 'should not get here!')
  })

  h.on('issue', (event) => {
    t.fail(true, 'should never get here!')
  })

  h.on('error', (err) => {
    t.ok(err, 'got an error')
    t.equal(res.$statusCode, 400, 'correct status code')
  })

  h(req, res, (err) => {
    t.ok(err)
  })

  res.end = () => {
    t.equal(res.$statusCode, 400, 'correct status code')
  }

  req.write('{')
  process.nextTick(() => {
    req.emit('error', new Error('simulated explosion'))
  })
})
