
/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint space-infix-ops: 0 */

/// <reference types="node" />

import { ProtocolDecoder, ExtractSocketDetails } from 'aedes-protocol-decoder'
import { Server as HttpServer } from 'http'
import { Server as NetServer } from 'net'
import { Http2Server, Http2SecureServer } from 'http2'
import { Aedes } from 'aedes'

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

type Server = NetServer | HttpServer | Http2Server | Http2SecureServer

export type ServerFactory = (
  broker: Aedes,
  options: ServerFactoryOptions,
) => Server
