'use strict'

var test = require('tape').test
var aedes = require('aedes')
var mqtt = require('mqtt')
var mqttPacket = require('mqtt-packet')
var net = require('net')
var proxyProtocol = require('proxy-protocol-js')
var { createServer } = require('./index')

test('tcp clients have access to the connection details from the socket', function (t) {
  t.plan(3)

  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (client && client.connDetails && client.connDetails.ipAddress) {
        client.ip = client.connDetails.ipAddress
        t.equal('::ffff:127.0.0.1', client.ip)
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer(broker, { trustProxy: false })
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
  t.plan(3)

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
      if (client.connDetails && client.connDetails.ipAddress) {
        client.ip = client.connDetails.ipAddress
        t.equal(clientIp, client.ip)
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer(broker, { trustProxy: true })
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
  t.plan(3)

  var clientIp = '::ffff:127.0.0.1'
  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (client.connDetails && client.connDetails.ipAddress) {
        client.ip = client.connDetails.ipAddress
        t.equal(clientIp, client.ip)
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer(broker, { trustProxy: false, ws: true })
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
  t.plan(3)

  var clientIp = '192.168.0.140'
  var port = 4883
  var broker = aedes({
    preConnect: function (client, packet, done) {
      if (client.connDetails && client.connDetails.ipAddress) {
        client.ip = client.connDetails.ipAddress
        t.equal(clientIp, client.ip)
        t.equal(packet.cmd, 'connect')
      } else {
        t.fail('no ip address present')
      }
      done(null, true)
      setImmediate(finish)
    }
  })

  var server = createServer(broker, { trustProxy: true, ws: true })
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
