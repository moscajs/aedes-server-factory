# aedes-server-factory

Aedes server factory. Supports tcp, http, http2, ws, and proxy decoders

Work In Progress: tls, https, http2, wss

## Install

To install aedes-server-factory :

```sh
npm install aedes-server-factory
```

# Options

## ws

boolean used to wrap a http | http2 | https server in a websocket server.

`createServer` will return the http server if not http options is defined.

## http2

boolean used to create http2 server.

## https

boolean used to create http | http2 secure server.

## tls

boolean used to create tls server.

## trustProxy 

boolean to indicates that aedes-server-factory should retrieve information from the Proxy

## extractSocketDetails (socket)

- socket: [`<Duplex | Socket>`]

Invoked when `options.trustProxy` is `false` | `undefined`.

[aedes-protocol-decoder] `extractSocketDetails` function is used as default value.

```js
const aedes = require('aedes')()
const {createServer} = require('aedes-server-factory')
const yourDecoder = require('./path-to-your-decoder')

const options = { trustProxy: false }
options.extractSocketDetails = function(conn, buffer) {
  return yourDecoder(conn, buffer)
}

const server = createServer(aedes, options)
```

## protocolDecoder (conn, buffer, req)

- conn: `<Duplex | Socket>`
- buffer: `<Buffer>`
- req?: `<IncomingMessage>`

Invoked when `options.trustProxy` is `true`.

[aedes-protocol-decoder] `protocolDecoder` function is used as default value.

```js
const aedes = require('aedes')()
const {createServer} = require('aedes-server-factory')
const yourDecoder = require('./path-to-your-decoder')

const options = { trustProxy: true }
options.protocolDecoder = function(conn, buffer) {
  return yourDecoder(conn, buffer)
}

const server = createServer(aedes, options)
```

## serverFactory (aedes, options)

- aedes: [`<Aedes>`](https://github.com/moscajs/aedes/blob/master/docs/Aedes.md)
- options: `<object>`

Use to override `createServer` behavior and create your own server instance.

```js
const aedes = require('aedes')()
const {createServer} = require('aedes-server-factory')

const options = { trustProxy: false }
options.serverFactory = function(aedes, options) {
  return net.createServer((conn) => {
    aedes.handle(conn)
  })
}

const server = createServer(aedes, options)
```

# Examples

## TCP server

```js
const aedes = require('aedes')()
const server = require('aedes-server-factory').createServer(aedes)

const port = 1883

server.listen(port, function () {
  console.log('server started and listening on port ', port)
})
```

## TCP server behind proxy

```js
const aedes = require('aedes')()
const server = require('aedes-server-factory').createServer(aedes, { trustProxy: true })

const port = 1883

server.listen(port, function () {
  console.log('server started and listening on port ', port)
})
```

## HTTP server for WS

```js
const aedes = require('aedes')()
const server = require('aedes-server-factory').createServer(aedes, { ws: true })
const port = 1883

server.listen(port, function () {
  console.log('server started and listening on port ', port)
})
```


[aedes]: https://www.npmjs.com/aedes
[aedes-protocol-decoder]: https://www.npmjs.com/aedes-protocol-decoder
