const test     = require('tape')
    , crypto   = require('crypto')
    , handler  = require('./')
    , through2 = require('through2')
    , series   = require('run-series');

var processwebhook = require('./processwebhooks.js');

function signBlob (key, blob) {
  return 'sha1=' +
  crypto.createHmac('sha1', key).update(blob).digest('hex')
}


function mkReq (url, method) {
  var req = through2()
  req.method = method || 'POST'
  req.url = url
  req.headers = {
      'x-hub-signature'   : 'bogus'
    , 'x-github-event'    : 'bogus'
    , 'x-github-delivery' : 'bogus'
  }
  return req
}


function mkRes () {
  var res = {
      writeHead : function (statusCode, headers) {
        res.$statusCode = statusCode
        res.$headers = headers
      }

    , end       : function (content) {
        res.$end = content
      }
  }

  return res
}

test('bash command executed', function (t) {
  t.plan(1)

  var obj  = require('./github_push.json')
    , json = JSON.stringify(obj)
    , h    = handler({ path: '/', secret: 'bogus' })
    , req  = mkReq('/')
    , res  = mkRes()

  req.headers['x-hub-signature'] = signBlob('bogus', json)
  req.headers['x-github-event']  = 'push'

  h.on('push', function (event) {
    
    t.deepEqual(event, { event: 'push', id: 'bogus', payload: obj, url: '/', host: undefined, protocol: undefined })
    t.equal(res.$statusCode, 200, 'correct status code')
    t.deepEqual(res.$headers, { 'content-type': 'application/json' })
    
    try {        

      console.log('Received a %s event for %s', event.event, (event.payload.repository||{}).name||"unknown");
      //console.log(event, event.payload);
      processwebhook.push(event);

    } catch (e) {
      return console.error(e);
    }
    
    
    t.equal(res.$end, '{"ok":true}', 'got correct content')
    
  })

  h(req, res, function (err) {
    t.error(err)
    t.fail(true, 'should not get here!')
  })

  process.nextTick(function () {
    req.end(json)
  })
})
