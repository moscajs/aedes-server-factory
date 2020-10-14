'use strict'

const { extractSocketDetails, protocolDecoder } = require('aedes-protocol-decoder')
const http = require('http')
const https = require('https')
const http2 = require('http2')
const net = require('net')
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

const createServer = (aedes, options) => {
  if (!aedes || !aedes.handle) {
    throw new Error('Missing aedes handler')
  }

  options = Object.assign({}, defaultOptions, options)
  const aedesHandler = aedes.handle

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
  const onData = (buffer) => {
    const protocol = options.protocolDecoder(conn, buffer, req)
    req.connDetails = protocol
    conn.removeListener('data', onData)
    conn.pause()
    conn.unshift(protocol.data || buffer)
    aedesHandler(conn, req)
  }

  conn.on('data', onData)
}
module.exports = {
  createServer
}
