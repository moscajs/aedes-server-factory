'use strict'

const { extractSocketDetails, protocolDecoder } = require('aedes-protocol-decoder')
const http = require('http')
const https = require('https')
const http2 = require('http2')
const net = require('net')
const tls = require('tls')
const WebSocket = require('ws')

const defaultOptions = {
  ws: null,
  http: {},
  https: null,
  http2: null,
  tls: null,
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
    server = options.serverFactory(aedes, options)
  } else if (options.tls) {
    server = tls.createServer(options.tls, (conn) => {
      bindConnection(options, aedesHandler, conn)
    })
  } else if (options.ws) {
    if (options.https) {
      if (options.http2) {
        server = http2.createSecureServer({ ...options.http2, ...options.https })
      } else {
        server = https.createServer({ ...options.http, ...options.https })
      }
    } else {
      if (options.http2) {
        server = http2.createServer(options.http2)
      } else {
        server = http.createServer(options.http)
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
    req.connDetails = options.extractSocketDetails(conn.socket || conn)
    aedesHandler(conn, req)
  }
}

const extractConnectionDetails = (options, aedesHandler, conn, req = {}) => {
  const onReadable = (err) => {
    if (err) {
      return
    }
    // buffer should contain the whole proxy header if any
    // see https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt
    const buffer = conn.read(null)
    if (buffer) {
      const protocol = options.protocolDecoder(conn, buffer, req)
      req.connDetails = protocol
      conn.removeListener('readable', onReadable)
      conn.pause()
      conn.unshift(protocol.data || buffer)
      aedesHandler(conn, req)
    }
  }

  conn.on('readable', onReadable)
}

module.exports = {
  createServer
}
