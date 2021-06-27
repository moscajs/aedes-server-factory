'use strict'

const test = require('tape').test
const aedes = require('aedes')
const mqtt = require('mqtt')
const mqttPacket = require('mqtt-packet')
const net = require('net')
const proxyProtocol = require('proxy-protocol-js')
const { createServer } = require('./index')

test('tcp clients have access to the connection details from the socket', function (t) {
  t.plan(3)

  const port = 4883
  const broker = aedes({
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

  const server = createServer(broker, { trustProxy: false })
  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  const client = mqtt.connect({
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

  const port = 4883
  const clientIp = '192.168.0.140'
  const connectPacket = {
    cmd: 'connect',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: true,
    clientId: 'my-client-proxyV1',
    keepalive: 0
  }

  const buf = mqttPacket.generate(connectPacket)
  const src = new proxyProtocol.Peer(clientIp, 12345)
  const dst = new proxyProtocol.Peer('127.0.0.1', port)
  const protocol = new proxyProtocol.V1BinaryProxyProtocol(
    proxyProtocol.INETProtocol.TCP4,
    src,
    dst,
    buf
  ).build()

  const broker = aedes({
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

  const server = createServer(broker, { trustProxy: true })
  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  const client = net.connect(
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

  const clientIp = '::ffff:127.0.0.1'
  const port = 4883
  const broker = aedes({
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

  const server = createServer(broker, { trustProxy: false, ws: true })
  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  const client = mqtt.connect(`ws://localhost:${port}`)

  function finish () {
    client.end(true)
    broker.close()
    server.close()
    t.end()
  }
})

test('websocket proxied clients have access to the connection details', function (t) {
  t.plan(3)

  const clientIp = '192.168.0.140'
  const port = 4883
  const broker = aedes({
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

  const server = createServer(broker, { trustProxy: true, ws: true })
  server.listen(port, function (err) {
    t.error(err, 'no error')
  })

  const client = mqtt.connect(`ws://localhost:${port}`, {
    wsOptions: {
      headers: {
        'X-Real-Ip': clientIp
      }
    }
  })

  function finish () {
    client.end(true)
    broker.close()
    server.close()
    t.end()
  }
})
