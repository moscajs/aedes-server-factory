'use strict'

var aedes = require('aedes')
var mqtt = require('mqtt')
var mqttPacket = require('mqtt-packet')
var net = require('net')
var proxyProtocol = require('proxy-protocol-js')
var createServer = require('./lib/server-factory')

var brokerPort = 4883
var wsBrokerPort = 4884

// from https://stackoverflow.com/questions/57077161/how-do-i-convert-hex-buffer-to-ipv6-in-javascript
function parseIpV6 (ip) {
  return ip
    .match(/.{1,4}/g)
    .map((val) => val.replace(/^0+/, ''))
    .join(':')
    .replace(/0000:/g, ':')
    .replace(/:{2,}/g, '::')
}

function sendProxyPacket (version = 1, ipFamily = 4, serverPort) {
  var packet = {
    cmd: 'connect',
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    clientId: `my-client-${version}`,
    keepalive: 0
  }
  var hostIpV4 = '0.0.0.0'
  var clientIpV4 = '192.168.1.128'
  var hostIpV6 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  var clientIpV6 = [0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 192, 168, 1, 128]
  var protocol
  if (version === 1) {
    if (ipFamily === 4) {
      protocol = new proxyProtocol.V1BinaryProxyProtocol(
        proxyProtocol.INETProtocol.TCP4,
        new proxyProtocol.Peer(clientIpV4, 12345),
        new proxyProtocol.Peer(hostIpV4, serverPort),
        mqttPacket.generate(packet)
      ).build()
    } else if (ipFamily === 6) {
      protocol = new proxyProtocol.V1BinaryProxyProtocol(
        proxyProtocol.INETProtocol.TCP6,
        new proxyProtocol.Peer(
          parseIpV6(Buffer.from(clientIpV6).toString('hex')),
          12345
        ),
        new proxyProtocol.Peer(
          parseIpV6(Buffer.from(hostIpV6).toString('hex')),
          serverPort
        ),
        mqttPacket.generate(packet)
      ).build()
    }
  } else if (version === 2) {
    if (ipFamily === 4) {
      protocol = new proxyProtocol.V2ProxyProtocol(
        proxyProtocol.Command.LOCAL,
        proxyProtocol.TransportProtocol.STREAM,
        new proxyProtocol.IPv4ProxyAddress(
          proxyProtocol.IPv4Address.createFrom(clientIpV4.split('.')),
          12346,
          proxyProtocol.IPv4Address.createFrom(hostIpV4.split('.')),
          serverPort
        ),
        mqttPacket.generate(packet)
      ).build()
    } else if (ipFamily === 6) {
      protocol = new proxyProtocol.V2ProxyProtocol(
        proxyProtocol.Command.PROXY,
        proxyProtocol.TransportProtocol.STREAM,
        new proxyProtocol.IPv6ProxyAddress(
          proxyProtocol.IPv6Address.createFrom(clientIpV6),
          12346,
          proxyProtocol.IPv6Address.createFrom(hostIpV6),
          serverPort
        ),
        mqttPacket.generate(packet)
      ).build()
    }
  }

  var parsedProto =
    version === 1
      ? proxyProtocol.V1BinaryProxyProtocol.parse(protocol)
      : proxyProtocol.V2ProxyProtocol.parse(protocol)
  // console.log(parsedProto)

  var dstPort =
    version === 1
      ? parsedProto.destination.port
      : parsedProto.proxyAddress.destinationPort

  var dstHost
  if (version === 1) {
    if (ipFamily === 4) {
      dstHost = parsedProto.destination.ipAddress
    } else if (ipFamily === 6) {
      dstHost = parsedProto.destination.ipAddress
      // console.log('ipV6 host :', parsedProto.destination.ipAddress)
    }
  } else if (version === 2) {
    if (ipFamily === 4) {
      dstHost = parsedProto.proxyAddress.destinationAddress.address.join('.')
    } else if (ipFamily === 6) {
      // console.log('ipV6 client :', parseIpV6(Buffer.from(clientIpV6).toString('hex')))
      dstHost = parseIpV6(
        Buffer.from(
          parsedProto.proxyAddress.destinationAddress.address
        ).toString('hex')
      )
    }
  }

  console.log('Connection to :', dstHost, dstPort)
  var mqttConn = net.createConnection({
    port: dstPort,
    host: dstHost,
    timeout: 150
  })

  var data = protocol

  mqttConn.on('timeout', function () {
    mqttConn.end(data)
  })
}

function sendTcpPacket (serverPort) {
  var packet = {
    cmd: 'connect',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: true,
    clientId: 'my-client',
    keepalive: 0
  }

  console.log('Connection to :', '0.0.0.0', serverPort)

  var tcpConn = net.createConnection({
    port: serverPort,
    host: '0.0.0.0',
    timeout: 150
  })

  tcpConn.on('timeout', function () {
    tcpConn.end(mqttPacket.generate(packet))
  })
}

function sendWsPacket (serverPort) {
  var clientIpV4 = '192.168.1.128'
  var client = mqtt.connect(`ws://localhost:${serverPort}`, {
    wsOptions: {
      headers: {
        'X-Real-Ip': clientIpV4
      }
    }
  })

  setTimeout(() => client.end(true), 150)
}

function startAedes () {
  var broker = aedes({
    preConnect: function (client, packet, done) {
      console.log('Aedes preConnect check packet:', packet)
      client.close()
      return done(null, true)
    }
  })

  var server = createServer({ trustProxy: true }, broker.handle)
  var httpServer = createServer({ trustProxy: true, ws: true }, broker.handle)

  server.listen(brokerPort, function () {
    console.log('Aedes listening on TCP :', server.address())
    setTimeout(() => sendProxyPacket(1, 4, brokerPort), 250)
    setTimeout(() => sendProxyPacket(1, 6, brokerPort), 500)
    setTimeout(() => sendProxyPacket(2, 4, brokerPort), 750)
    setTimeout(() => sendProxyPacket(2, 6, brokerPort), 1000)
    setTimeout(() => sendTcpPacket(brokerPort), 1250)
  })

  httpServer.listen(wsBrokerPort, function () {
    console.log('Aedes listening on HTTP :', httpServer.address())
    setTimeout(() => sendWsPacket(wsBrokerPort), 1500)
  })

  broker.on('subscribe', function (subscriptions, client) {
    console.log(
      'MQTT client \x1b[32m' +
        (client ? client.id : client) +
        '\x1b[0m subscribed to topics: ' +
        subscriptions.map((s) => s.topic).join('\n'),
      'from broker',
      broker.id
    )
  })

  broker.on('unsubscribe', function (subscriptions, client) {
    console.log(
      'MQTT client \x1b[32m' +
        (client ? client.id : client) +
        '\x1b[0m unsubscribed to topics: ' +
        subscriptions.join('\n'),
      'from broker',
      broker.id
    )
  })

  // fired when a client connects
  broker.on('client', function (client) {
    console.log(
      'Client Connected: \x1b[33m' +
        (client ? client.id : client) +
        ' ip  ' +
        (client ? client.ip : null) +
        '\x1b[0m',
      'to broker',
      broker.id
    )
  })

  // fired when a client disconnects
  broker.on('clientDisconnect', function (client) {
    console.log(
      'Client Disconnected: \x1b[31m' +
        (client ? client.id : client) +
        '\x1b[0m',
      'to broker',
      broker.id
    )
  })

  // fired when a message is published
  broker.on('publish', function (packet, client) {
    console.log(
      'Client \x1b[31m' +
        (client ? client.id : 'BROKER_' + broker.id) +
        '\x1b[0m has published',
      packet.payload.toString(),
      'on',
      packet.topic,
      'to broker',
      broker.id
    )
  })
}

(function () {
  startAedes()
})()
