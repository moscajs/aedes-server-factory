'use strict'

const { extractSocketDetails, protocolDecoder } = require('aedes-protocol-decoder')
const http = require('http')
const https = require('https')
const http2 = require('http2')
const net = require('net')
const { Transform, PassThrough } = require('stream')
const tls = require('tls')
const WebSocket = require('ws')

const defaultOptions = {
  ws: false,
  https: false,
  http2: false,
  tls: false,
  trustProxy: false,
  serverFactory: null,
  protocolDecoder: protocolDecoder,
  extractSocketDetails: extractSocketDetails
}

const createServer = (options, aedesHandler) => {
  if (!aedesHandler) {
    throw new Error('Missing aedes handler')
  }

  options = Object.assign({}, defaultOptions, options)

  let server = null
  if (options.serverFactory) {
    server = options.serverFactory(aedesHandler, options)
  } else if (options.tls) {
    server = tls.createServer(options, aedesHandler)
  } else if (options.ws) {
    if (options.https) {
      if (options.http2) {
        server = http2.createSecureServer(options.https)
      } else {
        server = https.createServer(options.https)
      }
    } else {
      if (options.http2) {
        server = http2.createServer()
        // server.on('session', sessionTimeout(options.http2SessionTimeout))
      } else {
        server = http.createServer()
      }
    }
    const ws = new WebSocket.Server({ server })
    ws.on('connection', (conn, req) => {
      const stream = WebSocket.createWebSocketStream(conn)
      stream._socket = conn._socket
      bindConnection(options, aedesHandler, stream, req)
    })
  } else {
    server = net.createServer((conn) => {
      bindConnection(options, aedesHandler, conn)
    })
  }
  return server
}

const bindConnection = (options, aedesHandler, conn, req = {}) => {
  if (options.trustProxy) {
    extractConnectionDetails(options, aedesHandler, conn, req)
  } else {
    const protocol = options.extractSocketDetails(conn.socket || conn)
    req.connDetails = protocol
    aedesHandler(conn, req)
  }
}

const extractConnectionDetails = (options, aedesHandler, conn, req = {}) => {
  const rewindableStream = conn.pipe(new Rewindable())

  conn.on('data', (buffer) => {
    const protocol = options.protocolDecoder(conn, buffer, req)

    let stream = null
    if (buffer && protocol.data) {
      const removeProxyHeader = removeFromStream(
        buffer.length - protocol.data.length
      )
      stream = rewindableStream.rewind().pipe(removeProxyHeader)
    } else {
      stream = rewindableStream.rewind()
    }
    req.connDetails = protocol
    aedesHandler(stream, req)
  })
}

class Rewindable extends Transform {
  constructor () {
    super()
    this.accumulator = []
  }

  _transform (chunk, encoding, callback) {
    this.accumulator.push(chunk)
    callback()
  }

  rewind () {
    const stream = new PassThrough()
    this.accumulator.forEach((chunk) => stream.write(chunk))
    return stream
  }
}

const removeFromStream = (length) => {
  let buffer = Buffer.alloc(0)
  let removed = false

  return new Transform({
    transform (chunk, encoding, callback) {
      if (!removed || buffer.length <= length) {
        buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length)
        const partChunk = buffer.slice(length)
        this.push(partChunk)
        removed = true
      } else {
        this.push(chunk)
      }
      callback()
    }
  })
}

module.exports = {
  createServer
}
