'use strict'

const aedes = require('aedes')
const mqtt = require('mqtt')
const mqttPacket = require('mqtt-packet')
const net = require('net')
const proxyProtocol = require('proxy-protocol-js')
const { createServer } = require('./index')

const brokerPort = 4883
const wsBrokerPort = 4884
let messageId = 1

// from https://stackoverflow.com/questions/57077161/how-do-i-convert-hex-buffer-to-ipv6-in-javascript
function parseIpV6 (ip) {
  return ip
    .match(/.{1,4}/g)
    .map((val) => val.replace(/^0+/, ''))
    .join(':')
    .replace(/0000:/g, ':')
    .replace(/:{2,}/g, '::')
}

function generateProxyPacket (version = 1, ipFamily = 4, serverPort, packet) {
  const hostIpV4 = '0.0.0.0'
  const clientIpV4 = '192.168.1.128'
  const hostIpV6 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const clientIpV6 = [0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 192, 168, 1, 128]

  let proxyPacket
  if (version === 1) {
    if (ipFamily === 4) {
      proxyPacket = new proxyProtocol.V1BinaryProxyProtocol(
        proxyProtocol.INETProtocol.TCP4,
        new proxyProtocol.Peer(clientIpV4, 12345),
        new proxyProtocol.Peer(hostIpV4, serverPort),
        mqttPacket.generate(packet)
      ).build()
    } else if (ipFamily === 6) {
      proxyPacket = new proxyProtocol.V1BinaryProxyProtocol(
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
      proxyPacket = new proxyProtocol.V2ProxyProtocol(
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
      proxyPacket = new proxyProtocol.V2ProxyProtocol(
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
  return proxyPacket
}

function sendPackets (conn) {
  setTimeout(function () {
    conn.write(mqttPacket.generate({
      cmd: 'subscribe',
      messageId: messageId += 1,
      subscriptions: [{
        topic: 'test',
        qos: 0
      }]
    }))
  }, 150)

  setTimeout(function () {
    conn.write(mqttPacket.generate({
      cmd: 'publish',
      messageId: messageId += 1,
      retain: false,
      qos: 0,
      dup: false,
      length: 10,
      topic: 'test',
      payload: 'test'
    }))
  }, 300)

  setTimeout(function () {
    conn.end(mqttPacket.generate({
      cmd: 'disconnect',
      protocolId: 'MQTT',
      protocolVersion: 4
    }))
  }, 450)
}

function sendProxyPacket (version = 1, ipFamily = 4, serverPort) {
  const packet = {
    cmd: 'connect',
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    clientId: `tcp-proxy-client-${version}-${ipFamily}`,
    keepalive: 0
  }

  const proxyPacket = generateProxyPacket(version, ipFamily, serverPort, packet)
  const parsedProto =
    version === 1
      ? proxyProtocol.V1BinaryProxyProtocol.parse(proxyPacket)
      : proxyProtocol.V2ProxyProtocol.parse(proxyPacket)
  // console.log(parsedProto)

  const dstPort =
    version === 1
      ? parsedProto.destination.port
      : parsedProto.proxyAddress.destinationPort

  let dstHost
  if (version === 1) {
    if (ipFamily === 4) {
      dstHost = parsedProto.destination.ipAddress
    } else if (ipFamily === 6) {
      dstHost = parsedProto.destination.ipAddress
    }
  } else if (version === 2) {
    if (ipFamily === 4) {
      dstHost = parsedProto.proxyAddress.destinationAddress.address.join('.')
    } else if (ipFamily === 6) {
      dstHost = parseIpV6(
        Buffer.from(
          parsedProto.proxyAddress.destinationAddress.address
        ).toString('hex')
      )
    }
  }

  console.log('Connection to :', dstHost, dstPort)
  const mqttConn = net.createConnection({
    port: dstPort,
    host: dstHost
  }, function () {
    this.write(proxyPacket)
  })

  sendPackets(mqttConn)
}

function sendTcpPacket (serverPort) {
  const packet = {
    cmd: 'connect',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: true,
    clientId: 'tcp-client',
    keepalive: 0
  }

  console.log('Connection to :', '0.0.0.0', serverPort)

  const tcpConn = net.createConnection({
    port: serverPort,
    host: '0.0.0.0'
  }, function () {
    this.write(mqttPacket.generate(packet))
  })

  sendPackets(tcpConn)
}

function sendWsPacket (serverPort) {
  const clientIpV4 = '192.168.1.128'
  const client = mqtt.connect(`ws://localhost:${serverPort}`, {
    clientId: 'ws-client',
    wsOptions: {
      headers: {
        'X-Real-Ip': clientIpV4
      }
    }
  })

  setTimeout(() => client.subscribe('test'), 150)
  setTimeout(() => client.publish('test', 'test'), 300)
  setTimeout(() => client.end(true), 450)
}

function startAedes () {
  const delay = 500

  const broker = aedes({
    preConnect: function (client, packet, done) {
      // console.log('Aedes preConnect : ', { connDetails: client.connDetails, packet })
      client.ip = client.connDetails.ipAddress
      done(null, true)
    }
  })

  const server = createServer(broker, { trustProxy: true })
  const httpServer = createServer(broker, { trustProxy: true, ws: true, http: null })

  server.listen(brokerPort, function () {
    console.log('Aedes listening on TCP :', server.address())
    setTimeout(() => sendProxyPacket(1, 4, brokerPort), delay)
    setTimeout(() => sendProxyPacket(1, 6, brokerPort), delay * 2)
    setTimeout(() => sendProxyPacket(2, 4, brokerPort), delay * 3)
    setTimeout(() => sendProxyPacket(2, 6, brokerPort), delay * 4)
    setTimeout(() => sendTcpPacket(brokerPort), delay * 5)
  })

  httpServer.listen(wsBrokerPort, function () {
    console.log('Aedes listening on HTTP :', httpServer.address())
    setTimeout(() => sendWsPacket(wsBrokerPort), delay * 6)
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
