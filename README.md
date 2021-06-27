# aedes-server-factory

Aedes server factory. Supports TCP, HTTP, HTTP2, WS, and PROXY decoders.

Work In Progress: TLS, HTTPS, HTTP2, WSS.

## Install

To install aedes-server-factory :

```sh
npm install aedes-server-factory
```

## Usage

1 - Per default, if no options are set, `createServer` will return a TCP server instance, from which the stream will be bound to [aedes] (via `aedes.handle`).

2 - To bind a Websocket stream to Aedes, set `ws` to true, and eventually configure the HTTP server instance by using one of `http` or `http2` options.

Additionaly, you can add `https` option to create a secure HTTP | HTTP2 server.

`createServer` will then return an HTTP | HTTP2 server instance.

## Options

### tcp

[`Object`](https://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener) used to create and configure a TCP server.

### tls

[`Object`](https://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener) used to create and configure a TCP over TLS server.

Default to null, if defined, will be used to create TCP secure server.

### ws

boolean used to wrap a http | http2 | https server in a websocket server.

### http

[`Object`](https://nodejs.org/api/http.html#http_http_createserver_options_requestlistener) used to create and configure HTTP server.

`createServer` will return the HTTP server if no HTTP options is defined.

### customWSErrorHandler

function used to handle errors thrown by WS server.

`customWSErrorHandler` will be called with [`Error`](https://github.com/websockets/ws/blob/master/doc/ws.md#event-error).

### http2

[`Object`](https://nodejs.org/api/http2.html#http2_http2_createserver_options_onrequesthandler) used to create and configure HTTP2 server.

Default to null, if defined, will be used to create HTTP2 server instance.

### https

https://nodejs.org/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler

[`Object`](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener) used to create and configure HTTPS server, can be used in combination of HTTP | HTTP2 option.

Default to null, if defined, will be used to create HTTP | HTTP2 secure server.

### trustProxy

`boolean` to indicates that `aedes-server-factory` should retrieve information from the Proxy server ( HTTP headers and/or Proxy protocol header ).

Default to false.


### extractSocketDetails (socket)

- socket: [`<Duplex | Socket>`]

Invoked when `options.trustProxy` is `false` | `undefined`.

[aedes-protocol-decoder] `extractSocketDetails` function is used as default value.

```js
const aedes = require('aedes')();
const { createServer } = require('aedes-server-factory');
const yourDecoder = require('./path-to-your-decoder');

const options = { trustProxy: false };
options.extractSocketDetails = function (socket) {
  return yourDecoder(socket);
};

const server = createServer(aedes, options);
```

### protocolDecoder (conn, buffer, req)

- conn: `<Duplex | Socket>`
- buffer: `<Buffer>`
- req?: `<IncomingMessage>`

Invoked when `options.trustProxy` is `true`.

[aedes-protocol-decoder] `protocolDecoder` function is used as default value.

```js
const aedes = require('aedes')();
const { createServer } = require('aedes-server-factory');
const yourDecoder = require('./path-to-your-decoder');

const options = { trustProxy: true };
options.protocolDecoder = function (conn, buffer) {
  return yourDecoder(conn, buffer);
};

const server = createServer(aedes, options);
```

### serverFactory (aedes, options)

- aedes: [`<Aedes>`](https://github.com/moscajs/aedes/blob/master/docs/Aedes.md)
- options: `<object>`

Use to override `createServer` behavior and create your own server instance.

```js
const aedes = require('aedes')();
const { createServer } = require('aedes-server-factory');

const options = { trustProxy: false };
options.serverFactory = function (aedes, options) {
  return net.createServer((conn) => {
    aedes.handle(conn);
  });
};

const server = createServer(aedes, options);
```

## Examples

### TCP server

```js
const aedes = require('aedes')();
const server = require('aedes-server-factory').createServer(aedes);

const port = 1883;

server.listen(port, function () {
  console.log('server started and listening on port ', port);
});
```

### TCP server behind proxy

```js
const aedes = require('aedes')();
const server = require('aedes-server-factory').createServer(aedes, {
  trustProxy: true,
});

const port = 1883;

server.listen(port, function () {
  console.log('server started and listening on port ', port);
});
```

### HTTP server for WS

```js
const aedes = require('aedes')();
const server = require('aedes-server-factory').createServer(aedes, {
  ws: true,
});
const port = 1883;

server.listen(port, function () {
  console.log('server started and listening on port ', port);
});
```

[aedes]: https://www.npmjs.com/aedes
[aedes-protocol-decoder]: https://www.npmjs.com/aedes-protocol-decoder
