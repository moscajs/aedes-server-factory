
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint space-infix-ops: 0 */

/// <reference types="node" />

import { ProtocolDecoder, ConnectionDetails, ExtractSocketDetails } from 'aedes-protocol-decoder'
import { Duplex } from 'stream'
import { Server as HttpServer } from 'http'
import { Socket, Server as NetServer } from 'net'
import { Http2Server, Http2SecureServer } from 'http2'
import { Client } from 'aedes'

export interface ServerFactoryOptions {
  ws?: boolean
  https?: boolean
  http2?: boolean
  tls?: boolean
  serverFactory?: ServerFactory
  protocolDecoder?: ProtocolDecoder
  extractSocketDetails?: ExtractSocketDetails;
  trustProxy?: boolean
}

type Connection = Duplex | Socket
type Server = NetServer | HttpServer | Http2Server | Http2SecureServer

export type ServerFactory = (
  options: ServerFactoryOptions,
  aedesHandler: (
    stream: Connection,
    req?: any,
    protocol?: ConnectionDetails
  ) => Client
) => Server
