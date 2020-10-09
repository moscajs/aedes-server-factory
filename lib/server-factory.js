const assert = require('assert')
const WebSocket = require('ws')
const tls = require('tls')
const http = require('http')
const https = require('https')
const http2 = require('http2')
const net = require('net')

function createServer (options, aedesHandler) {
  assert(options, 'Missing options')
  assert(aedesHandler, 'Missing aedes handler')

  var server = null
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
    const ws = new WebSocket.Server({ server: server })
    ws.on('connection', function (conn, req) {
      const stream = WebSocket.createWebSocketStream(conn)
      aedesHandler(stream, req)
    })
  } else {
    server = net.createServer(options, aedesHandler)
  }
  return server
}

module.exports = createServer
