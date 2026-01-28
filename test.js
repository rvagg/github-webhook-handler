import { test } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { PassThrough } from 'node:stream'
import handler from './github-webhook-handler.js'

function signBlob (key, blob) {
  return `sha1=${crypto.createHmac('sha1', key).update(blob).digest('hex')}`
}

function mkReq (url, method) {
  const req = new PassThrough()
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
    writeHead (statusCode, headers) {
      res.$statusCode = statusCode
      res.$headers = headers
    },
    end (content) {
      res.$end = content
    }
  }
  return res
}

test('handler without full options throws', () => {
  assert.strictEqual(typeof handler, 'function', 'handler exports a function')
  assert.throws(() => handler(), /must provide an options object/, 'throws if no options')
  assert.throws(() => handler({}), /must provide a 'path' option/, 'throws if no path option')
  assert.throws(() => handler({ path: '/' }), /must provide a 'secret' option/, 'throws if no secret option')
})

test('handler without full options throws in array', () => {
  assert.throws(() => handler([{}]), /must provide a 'path' option/, 'throws if no path option')
  assert.throws(() => handler([{ path: '/' }]), /must provide a 'secret' option/, 'throws if no secret option')
})

test('handler ignores invalid urls', async () => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  await new Promise((resolve) => {
    h(mkReq('/'), mkRes(), (err) => {
      assert.ifError(err)
      resolve()
    })
  })

  await new Promise((resolve) => {
    h(mkReq('/some/url/'), mkRes(), (err) => {
      assert.ifError(err)
      resolve()
    })
  })

  await new Promise((resolve) => {
    h(mkReq('/some'), mkRes(), (err) => {
      assert.ifError(err)
      resolve()
    })
  })
})

test('handler ignores non-POST requests', async () => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  await new Promise((resolve) => {
    h(mkReq('/some/url', 'GET'), mkRes(), (err) => {
      assert.ifError(err)
      resolve()
    })
  })

  await new Promise((resolve) => {
    h(mkReq('/some/url?test=param', 'GET'), mkRes(), (err) => {
      assert.ifError(err)
      resolve()
    })
  })
})

test('handler accepts valid urls', async () => {
  const options = { path: '/some/url', secret: 'bogus' }
  const h = handler(options)

  let callbackCalled = false
  h(mkReq('/some/url'), mkRes(), () => {
    callbackCalled = true
  })

  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.strictEqual(callbackCalled, false, 'callback should not be called for valid POST')
})

test('handler accepts valid urls in Array', async () => {
  const options = [{ path: '/some/url', secret: 'bogus' }, { path: '/someOther/url', secret: 'bogus' }]
  const h = handler(options)

  let callbackCalled = false
  h(mkReq('/some/url'), mkRes(), () => { callbackCalled = true })
  h(mkReq('/someOther/url'), mkRes(), () => { callbackCalled = true })

  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.strictEqual(callbackCalled, false, 'callback should not be called for valid POSTs')
})

test('handler can reject events', async () => {
  const acceptableEvents = {
    undefined,
    'a string equal to the event': 'bogus',
    'a string equal to *': '*',
    'an array containing the event': ['bogus'],
    'an array containing *': ['not-bogus', '*']
  }
  const unacceptableEvents = {
    'a string not equal to the event or *': 'not-bogus',
    'an array not containing the event or *': ['not-bogus']
  }

  for (const [desc, events] of Object.entries(acceptableEvents)) {
    const h = handler({
      path: '/some/url',
      secret: 'bogus',
      events
    })

    let callbackCalled = false
    h(mkReq('/some/url'), mkRes(), () => { callbackCalled = true })

    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.strictEqual(callbackCalled, false, `accepted because options.events was ${desc}`)
  }

  for (const [desc, events] of Object.entries(unacceptableEvents)) {
    const h = handler({
      path: '/some/url',
      secret: 'bogus',
      events
    })

    h.on('error', () => {})

    await new Promise((resolve) => {
      h(mkReq('/some/url'), mkRes(), (err) => {
        assert.ok(err, `rejected because options.events was ${desc}`)
        resolve()
      })
    })
  }
})

test('handler is an EventEmitter', () => {
  const h = handler({ path: '/', secret: 'bogus' })

  assert.strictEqual(typeof h.on, 'function', 'has h.on()')
  assert.strictEqual(typeof h.emit, 'function', 'has h.emit()')
  assert.strictEqual(typeof h.removeListener, 'function', 'has h.removeListener()')

  let received
  h.on('ping', (pong) => { received = pong })
  h.emit('ping', 'pong')
  assert.strictEqual(received, 'pong', 'got event')

  assert.throws(() => h.emit('error', new Error('threw an error')), /threw an error/, 'acts like an EE')
})

test('handler accepts a signed blob', async () => {
  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'push'

  const eventPromise = new Promise((resolve) => {
    h.on('push', (event) => {
      assert.deepStrictEqual(event, {
        event: 'push',
        id: 'bogus',
        payload: obj,
        url: '/',
        host: undefined,
        protocol: undefined,
        path: '/'
      })
      assert.strictEqual(res.$statusCode, 200, 'correct status code')
      assert.deepStrictEqual(res.$headers, { 'content-type': 'application/json' })
      assert.strictEqual(res.$end, '{"ok":true}', 'got correct content')
      resolve()
    })
  })

  h(req, res, () => {
    assert.fail('should not get here')
  })

  process.nextTick(() => req.end(json))
  await eventPromise
})

test('handler accepts multi blob in Array', async () => {
  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler([{ path: '/', secret: 'bogus' }, { path: '/some/url', secret: 'bogus' }])
  const req = mkReq('/some/url')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'push'

  const eventPromise = new Promise((resolve) => {
    h.on('push', (event) => {
      assert.deepStrictEqual(event, {
        event: 'push',
        id: 'bogus',
        payload: obj,
        url: '/some/url',
        host: undefined,
        protocol: undefined,
        path: '/some/url'
      })
      assert.strictEqual(res.$statusCode, 200, 'correct status code')
      assert.deepStrictEqual(res.$headers, { 'content-type': 'application/json' })
      assert.strictEqual(res.$end, '{"ok":true}', 'got correct content')
      resolve()
    })
  })

  h(req, res, () => {
    assert.fail('should not get here')
  })

  process.nextTick(() => req.end(json))
  await eventPromise
})

test('handler accepts a signed blob with alt event', async () => {
  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'issue'

  h.on('push', () => assert.fail('should not get here'))

  const eventPromise = new Promise((resolve) => {
    h.on('issue', (event) => {
      assert.deepStrictEqual(event, {
        event: 'issue',
        id: 'bogus',
        payload: obj,
        url: '/',
        host: undefined,
        protocol: undefined,
        path: '/'
      })
      assert.strictEqual(res.$statusCode, 200, 'correct status code')
      assert.deepStrictEqual(res.$headers, { 'content-type': 'application/json' })
      assert.strictEqual(res.$end, '{"ok":true}', 'got correct content')
      resolve()
    })
  })

  h(req, res, () => {
    assert.fail('should not get here')
  })

  process.nextTick(() => req.end(json))
  await eventPromise
})

test('handler rejects a badly signed blob', async () => {
  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-hub-signature'] = '0' + req.headers['x-hub-signature'].substring(1)

  const errorPromise = new Promise((resolve) => {
    h.on('error', (err, _req) => {
      assert.ok(err, 'got an error')
      assert.strictEqual(_req, req, 'was given original request object')
      assert.strictEqual(res.$statusCode, 400, 'correct status code')
      assert.deepStrictEqual(res.$headers, { 'content-type': 'application/json' })
      assert.strictEqual(res.$end, '{"error":"X-Hub-Signature does not match blob signature"}', 'got correct content')
      resolve()
    })
  })

  h.on('push', () => assert.fail('should not get here'))

  h(req, res, (err) => {
    assert.ok(err, 'got error on callback')
  })

  process.nextTick(() => req.end(json))
  await errorPromise
})

test('handler responds on a stream error', async () => {
  const obj = { some: 'github', object: 'with', properties: true }
  const json = JSON.stringify(obj)
  const h = handler({ path: '/', secret: 'bogus' })
  const req = mkReq('/')
  const res = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event'] = 'issue'

  h.on('push', () => assert.fail('should not get here'))
  h.on('issue', () => assert.fail('should never get here'))

  const errorPromise = new Promise((resolve) => {
    h.on('error', (err) => {
      assert.ok(err, 'got an error')
      assert.strictEqual(res.$statusCode, 400, 'correct status code')
      resolve()
    })
  })

  h(req, res, (err) => {
    assert.ok(err)
  })

  req.write('{')
  process.nextTick(() => {
    req.destroy(new Error('simulated explosion'))
  })

  await errorPromise
})
