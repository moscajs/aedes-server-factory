'use strict'

var test = require('tape').test
var aedes = require('aedes')
var mqtt = require('mqtt')
var mqttPacket = require('mqtt-packet')
var net = require('net')
var proxyProtocol = require('proxy-protocol-js')
var { createServer } = require('./index')

// This test suite will be really effective after updating aedes and protocol-decoder module,
// to retrieve conn details in the client @preConnect

test('tcp clients have access to the connection details from the socket', function (t) {
  t.plan(2)

  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (packet) {
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer({ trustProxy: false }, broker.handle)

  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  var client = mqtt.connect({
    port,
    keepalive: 0,
    clientId: 'mqtt-client',
    clean: false
  })

  function finish () {
    client.end()
    broker.close()
    server.close()
    t.end()
  }
})

test('tcp proxied clients have access to the connection details from the proxy header', function (t) {
  t.plan(2)

  var port = 4883
  var clientIp = '192.168.0.140'
  var connectPacket = {
    cmd: 'connect',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: true,
    clientId: 'my-client-proxyV1',
    keepalive: 0
  }

  var buf = mqttPacket.generate(connectPacket)
  var src = new proxyProtocol.Peer(clientIp, 12345)
  var dst = new proxyProtocol.Peer('127.0.0.1', port)
  var protocol = new proxyProtocol.V1BinaryProxyProtocol(
    proxyProtocol.INETProtocol.TCP4,
    src,
    dst,
    buf
  ).build()

  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (packet) {
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer({ trustProxy: true }, broker.handle)

  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  var client = net.connect(
    {
      port,
      timeout: 0
    },
    function () {
      client.write(protocol)
    }
  )

  function finish () {
    client.end()
    broker.close()
    server.close()
    t.end()
  }
})

test('websocket clients have access to the connection details from the socket', function (t) {
  t.plan(2)

  // var clientIp = '::ffff:127.0.0.1'
  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (packet) {
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer({ trustProxy: false, ws: true }, broker.handle)

  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  var client = mqtt.connect(`ws://localhost:${port}`)

  function finish () {
    broker.close()
    server.close()
    client.end()
    t.end()
  }
})

test('websocket proxied clients have access to the connection details', function (t) {
  t.plan(2)

  var clientIp = '192.168.0.140'
  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (packet) {
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer({ trustProxy: true, ws: true }, broker.handle)

  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  var client = mqtt.connect(`ws://localhost:${port}`, {
    wsOptions: {
      headers: {
        'X-Real-Ip': clientIp
      }
    }
  })

  function finish () {
    broker.close()
    server.close()
    client.end()
    t.end()
  }
})
