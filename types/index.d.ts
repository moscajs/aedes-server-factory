/* eslint no-unused-vars: 0 */
/* eslint no-undef: 0 */
/* eslint space-infix-ops: 0 */
/* eslint no-use-before-define: 0 */

/// <reference types="node" />

import { ProtocolDecoder, ExtractSocketDetails } from 'aedes-protocol-decoder'
import { Server as HttpServer, ServerOptions as HttpServerOptions } from 'http'
import { ServerOptions as HttpSecureServerOptions } from 'https'
import { Server as NetServer } from 'net'
import {
  Http2Server,
  Http2SecureServer,
  ServerOptions as Http2ServerOptions,
  SecureServerOptions as Http2SecureServerOptions
} from 'http2'
import { Aedes } from 'aedes'
import { TlsOptions } from 'tls'

export interface ServerFactoryOptions {
  ws?: boolean;
  customWSErrorHandler?: (error: Error) => void | Promise<void>;
  http?: HttpServerOptions;
  https?: HttpSecureServerOptions | Http2SecureServerOptions;
  http2?: Http2ServerOptions;
  tls?: TlsOptions;
  tcp?: { allowHalfOpen?: boolean; pauseOnConnect?: boolean };
  serverFactory?: ServerFactory;
  protocolDecoder?: ProtocolDecoder;
  extractSocketDetails?: ExtractSocketDetails;
  trustProxy?: boolean;
}

type Server = NetServer | HttpServer | Http2Server | Http2SecureServer;

export type ServerFactory = (
  broker: Aedes,
  options?: ServerFactoryOptions
) => Server;

export declare const createServer: ServerFactory
