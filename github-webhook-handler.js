const EventEmitter = require('events')
const crypto = require('crypto')
const bl = require('bl')

function findHandler(url, arr) {
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

function checkType(options) {
    if (typeof options !== 'object') {
        throw new TypeError('must provide an options object')
    }

    if (typeof options.path !== 'string') {
        throw new TypeError('must provide a \'path\' option')
    }

    if (typeof options.secret !== 'string') {
        throw new TypeError('must provide a \'secret\' option')
    }
}

function create(initOptions) {
    let options
        // validate type of options
    if (Array.isArray(initOptions)) {
        for (let i = 0; i < initOptions.length; i++) {
            checkType(initOptions[i])
        }
    } else {
        checkType(initOptions)
    }

    // make it an EventEmitter
    Object.setPrototypeOf(handler, EventEmitter.prototype)
    EventEmitter.call(handler)

    handler.sign = sign
    handler.verify = verify

    return handler

    function sign(data) {
        return `sha1=${crypto.createHmac('sha1', options.secret).update(data).digest('hex')}`
    }

    function verify(signature, data) {
        const sig = Buffer.from(signature)
        const signed = Buffer.from(sign(data))
        if (sig.length !== signed.length) {
            return false
        }
        return crypto.timingSafeEqual(sig, signed)
    }

    function verifyGitee(signature, data, json) {
        if (json.sign) {
            const sig = Buffer.from(signature)
            const signed = Buffer.from(crypto.createHmac('sha256', options.secret).update(`${json.timestamp}\n${options.secret}`).digest('base64'))
            if (sig.length !== signed.length) {
                return false
            }
            return crypto.timingSafeEqual(sig, signed)
        } else {
            return signature === options.secret
        }
    }

    function verifyGitlab(signature) {
        return signature === options.secret
    }

    function verifyGiteaGogs(signature, data, json) {
        const expected = crypto.createHmac('sha256', options.secret).update(JSON.stringify(json, null, 2)).digest('hex')
        return Buffer.from(expected).equals(Buffer.from(signature))
    }

    function verifyCodeup(signature) {
        return signature === options.secret
    }

    function handler(req, res, callback) {
        let events

        options = findHandler(req.url, initOptions)

        if (typeof options.events === 'string' && options.events !== '*') {
            events = [options.events]
        } else if (Array.isArray(options.events) && options.events.indexOf('*') === -1) {
            events = options.events
        }

        if (req.url !== options.path || req.method !== 'POST') {
            return callback()
        }

        function hasError(msg) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: msg }))

            const err = new Error(msg)

            handler.emit('error', err, req)
            callback(err)
        }

        const ua = req.headers['user-agent']
        const keyMap = {
            sig: 'x-hub-signature',
            event: 'x-github-event',
            id: 'x-github-delivery',
            verify
        }

        // gitee
        if (ua === 'git-oschina-hook') {
            keyMap.sig = 'x-gitee-token'
            keyMap.event = 'x-gitee-event'
            keyMap.id = 'x-gitee-timestamp'
            keyMap.verify = verifyGitee
        } else if (req.headers['x-gitlab-token']) {
            // gitlab
            keyMap.sig = 'x-gitlab-token'
            keyMap.event = 'x-gitlab-event'
            keyMap.id = 'x-gitlab-token'
            keyMap.verify = verifyGitlab
        } else if (req.headers['x-gitea-signature']) {
            // gitea
            keyMap.sig = 'x-gitea-signature'
            keyMap.event = 'x-gitea-event'
            keyMap.id = 'x-gitea-delivery'
            keyMap.verify = verifyGiteaGogs
        } else if (req.headers['x-gogs-signature']) {
            // gogs
            keyMap.sig = 'x-gogs-signature'
            keyMap.event = 'x-gogs-event'
            keyMap.id = 'x-gogs-delivery'
            keyMap.verify = verifyGiteaGogs
        } else if (req.headers['x-codeup-token']) {
            keyMap.sig = 'x-codeup-token'
            keyMap.event = 'x-codeup-event'
            keyMap.id = 'x-codeup-delivery'
            keyMap.verify = verifyCodeup
        }

        const sig = req.headers[keyMap.sig]
        const event = req.headers[keyMap.event]
        const id = req.headers[keyMap.id]

        if (!sig) {
            return hasError('No X-Hub-Signature found on request')
        }

        if (!event) {
            return hasError('No X-Github-Event found on request')
        }

        if (!id) {
            return hasError('No X-Github-Delivery found on request')
        }

        if (events && events.indexOf(event) === -1) {
            return hasError('X-Github-Event is not acceptable')
        }

        req.pipe(bl((err, data) => {
            if (err) {
                return hasError(err.message)
            }

            let obj

            if (!keyMap.verify(sig, data, obj)) {
                return hasError(`${keyMap.sig} does not match blob signature`)
            }

            try {
                obj = JSON.parse(data.toString())
            } catch (e) {
                return hasError(e)
            }

            res.writeHead(200, { 'content-type': 'application/json' })
            res.end('{"ok":true}')

            const emitData = {
                event: event,
                id: id,
                payload: obj,
                protocol: req.protocol,
                host: req.headers.host,
                url: req.url,
                path: options.path
            }

            // set common event
            function commonEvent(event) {
                if (event === 'Push Hook') {
                    return 'push'
                }
                if (event === 'Issue Hook') {
                    return 'issues'
                }
                if (event === 'Merge Request Hook') {
                    return 'merge'
                }
                return event
            }

            handler.emit(commonEvent(event), emitData)
            handler.emit('*', emitData)
        }))
    }
}

module.exports = create