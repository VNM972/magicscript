import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import type { ClientRequest, IncomingMessage, ProxyEnv } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import type { RequestOptions } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { TcpSocketConnectOpts } from 'node:net';
import { Readable } from 'node:stream';
import { checkServerIdentity } from 'node:tls';
import { isRejectedHostAddress } from './evidence-integrity';

export class PainFirstUnsupportedNetwork extends Error {}
export type PainFirstConnectionOptions = RequestOptions & Pick<TcpSocketConnectOpts, 'autoSelectFamily'>;
export interface PainFirstNetworkDependencies {
  resolveHost?: (hostname: string, options: { all: true; verbatim: true }) => Promise<readonly LookupAddress[]>;
  httpRequest?: (options: PainFirstConnectionOptions, response: (message: IncomingMessage) => void) => ClientRequest;
  httpsRequest?: (options: PainFirstConnectionOptions, response: (message: IncomingMessage) => void) => ClientRequest;
}

// Complement the canonical private-address guard only at the live boundary.
// These special-use ranges are not public connection destinations. IPv6 must
// be global unicast; transition/documentation ranges fail closed as well.
const nonPublic = new BlockList();
for (const [ip, prefix] of [['0.0.0.0', 8], ['100.64.0.0', 10], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) nonPublic.addSubnet(ip, prefix, 'ipv4');
const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
for (const [ip, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
  ['3fff::', 20]] as const) nonPublic.addSubnet(ip, prefix, 'ipv6');

function publicAnswer(answer: LookupAddress): boolean {
  if (!answer || typeof answer.address !== 'string' || answer.address.includes('%') ||
      (answer.family !== 4 && answer.family !== 6) || isIP(answer.address) !== answer.family ||
      isRejectedHostAddress(answer.address)) return false;
  return answer.family === 4 ? !nonPublic.check(answer.address, 'ipv4') :
    globalIpv6.check(answer.address, 'ipv6') && !nonPublic.check(answer.address, 'ipv6');
}

/** One DNS snapshot, one pinned native request. No global fetch/dispatcher or
 * global agent is used. Dedicated agents have an explicitly empty proxyEnv,
 * including on Node versions with opt-in environment proxy support. */
export function createPainFirstBoundHomepageTransport(dependencies: PainFirstNetworkDependencies = {}) {
  const resolveHost = dependencies.resolveHost ?? lookup;
  return async (urlString: string, init: RequestInit): Promise<Response> => {
    const url = new URL(urlString);
    const port = Number(url.port || (url.protocol === 'http:' ? 80 : 443));
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
        port !== (url.protocol === 'http:' ? 80 : 443)) throw new PainFirstUnsupportedNetwork('LIVE_PORT_POLICY');
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const answers = await resolveHost(hostname, { all: true, verbatim: true });
    if (!Array.isArray(answers) || answers.length === 0 || !Array.from(answers).map(publicAnswer).every(Boolean))
      throw new PainFirstUnsupportedNetwork('NON_PUBLIC_DNS');
    // Copy the first answer after validating every result. Never retain mutable
    // resolver-owned objects or return any other address from connection lookup.
    const { address, family } = answers[0];
    init.signal?.throwIfAborted();
    const secure = url.protocol === 'https:';
    // Next requires NODE_ENV in ProcessEnv/ProxyEnv; this environment must stay empty.
    const agent = secure ? new HttpsAgent({ keepAlive: false, maxCachedSessions: 0, proxyEnv: {} as ProxyEnv }) :
      new HttpAgent({ keepAlive: false, proxyEnv: {} as ProxyEnv });
    const request = secure ? dependencies.httpsRequest ?? httpsRequest : dependencies.httpRequest ?? httpRequest;
    const options: PainFirstConnectionOptions = {
      protocol: url.protocol, hostname, port, path: url.pathname + url.search,
      method: 'GET', headers: { ...Object.fromEntries(new Headers(init.headers)), Host: url.hostname },
      agent, family, autoSelectFamily: false, signal: init.signal ?? undefined,
      lookup: (_hostname, _options, callback) => { callback(null, address, family); },
      ...(secure ? { servername: hostname, rejectUnauthorized: true, checkServerIdentity } : {}),
    };
    return new Promise<Response>((resolve, reject) => {
      let requestHandle: ClientRequest;
      try {
        requestHandle = request(options, (message) => {
          try {
            const headers = new Headers();
            for (const [key, value] of Object.entries(message.headers)) {
              if (Array.isArray(value)) for (const entry of value) headers.append(key, entry);
              else if (value !== undefined) headers.set(key, value);
            }
            // No buffering here: the unchanged R58Z reader enforces the byte cap
            // and cancels the native stream on MIME, redirect, overflow or abort.
            const status = message.statusCode ?? 0;
            const body = [204, 205, 304].includes(status) ? null :
              Readable.toWeb(message) as ReadableStream<Uint8Array>;
            if (body === null) message.destroy();
            resolve(new Response(body, { status, headers }));
          } catch (error) { message.destroy(); reject(error); }
        });
        requestHandle.once('error', reject);
        requestHandle.once('close', () => agent.destroy());
        requestHandle.end();
      } catch (error) { agent.destroy(); reject(error); }
    });
  };
}
