# github-webhook-handler

[![NPM](https://nodei.co/npm/github-webhook-handler.png?downloads=true&downloadRank=true)](https://nodei.co/npm/github-webhook-handler/)
[![NPM](https://nodei.co/npm-dl/github-webhook-handler.png?months=6&height=3)](https://nodei.co/npm/github-webhook-handler/)

GitHub allows you to register **[Webhooks](https://developer.github.com/webhooks/)** for your repositories. Each time an event occurs on your repository, whether it be pushing code, filling issues or creating pull requests, the webhook address you register can be configured to be pinged with details.

This library is a small handler (or "middleware" if you must) for Node.js web servers that handles all the logic of receiving and verifying webhook requests from GitHub.

## Example

```js
var http = require('http')
var createHandler = require('github-webhook-handler')
var handler = createHandler({ path: '/webhook', secret: 'myhashsecret' })

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404
    res.end('no such location')
  })
}).listen(7777)

handler.on('error', function (err) {
  console.error('Error:', err.message)
})

handler.on('push', function (event) {
  console.log('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref)
})

handler.on('issues', function (event) {
  console.log('Received an issue event for % action=%s: #%d %s',
    event.payload.repository.name,
    event.payload.action,
    event.payload.issue.number,
    event.payload.issue.title)
})
```

## API

github-webhook-handler exports a single function, use this function to *create* a webhook handler by passing in an *options* object. Your options object should contain:

 * `"path"`: the complete case sensitive path/route to match when looking at `req.url` for incoming requests. Any request not matching this path will cause the callback function to the handler to be called (sometimes called the `next` handler).
 * `"secret"`: this is a hash key used for creating the SHA-1 HMAC signature of the JSON blob sent by GitHub. You should register the same secret key with GitHub. Any request not delivering a `X-Hub-Signature` that matches the signature generated using this key against the blob will be rejected and cause an `'error'` event (also the callback will be called with an `Error` object).

The resulting **handler** function acts like a common "middleware" handler that you can insert into a processing chain. It takes `request`, `response`, and `callback` arguments. The `callback` is not called if the request is successfully handled, otherwise it is called either with an `Error` or no arguments.

The **handler** function is also an `EventEmitter` that you can register to listen to any of the GitHub event types. Note you can be specific in your GitHub configuration about which events you wish to receive, or you can send them all. Note that the `"error"` event will be liberally used, even if someone tries the end-point and they can't generate a proper signature, so you should at least register a listener for it or it will throw.

See the [GitHub Webhooks documentation](https://developer.github.com/webhooks/) for more details on the events you can receive.

Included in the distribution is an *events.json* file which maps the event names to descriptions taken from the API:

```js
var events = require('github-webhook-handler/events')
Object.keys(events).forEach(function (event) {
  console.log(event, '=', events[event])
})
```

## License

**github-webhook-handler** is Copyright (c) 2014 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licensed under the MIT License. All rights not explicitly granted in the MIT License are reserved. See the included [LICENSE.md](./LICENSE.md) file for more details.
