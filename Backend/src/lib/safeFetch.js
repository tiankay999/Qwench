import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Fetches a link someone sent, without letting it reach anything internal.
 *
 * Every hop is checked: the protocol, the port, and every address its name resolves
 * to. The check happens inside the connection's own DNS lookup, so the socket
 * connects to the address that was validated, and a DNS change can't get around it.
 * Size and total time are capped.
 */

const DEFAULTS = {
  timeoutMs: 10_000,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 3,
  allowedPorts: [80, 443],
};

const USER_AGENT = "Mozilla/5.0 (compatible; QwenchBot/1.0)";
const TEXT_TYPES = /^(text\/|application\/(xhtml\+xml|xml)\b)/i;

const blocked = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, including cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, including broadcast
]) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64: can wrap any IPv4 address
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: can wrap any IPv4 address
  ["fc00::", 7], // private
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
]) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address) {
  const version = net.isIP(address);
  if (!version) return false;
  // An IPv4-mapped address can wrap anything. It's checked here because BlockList
  // would match every IPv4 address against a rule for it. The URL parser puts any
  // spelling of an IPv6 address into one form first.
  if (version === 6 && new URL(`http://[${address}]`).hostname.startsWith("[::ffff:")) return false;
  return !blocked.check(address, version === 4 ? "ipv4" : "ipv6");
}

export class SafeFetchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

async function defaultResolve(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

function parseLink(link, allowedPorts) {
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new SafeFetchError("BAD_URL", "That isn't a valid link.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new SafeFetchError("BAD_URL", "Only http and https links can be opened.");
  if (url.username || url.password) throw new SafeFetchError("BAD_URL", "Links with a username or password can't be opened.");

  const port = Number(url.port) || (url.protocol === "https:" ? 443 : 80);
  if (!allowedPorts.includes(port)) throw new SafeFetchError("BAD_URL", "That port can't be opened.");
  return url;
}

function fetchOnce(url, { resolve, isAllowedAddress, maxBytes, signal }) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const blockedError = () => new SafeFetchError("BLOCKED_ADDRESS", "That address can't be opened.");

  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw blockedError();
  // The URL parser has already turned forms like 2130706433 and 0x7f.0.0.1 into dotted form.
  if (net.isIP(hostname) && !isAllowedAddress(hostname)) throw blockedError();

  // Called by the socket itself, so what's validated here is what it connects to.
  const lookup = (host, opts, callback) => {
    resolve(host).then(
      (addresses) => {
        if (!addresses.length || !addresses.every((a) => isAllowedAddress(a))) return callback(blockedError());
        const records = addresses.map((address) => ({ address, family: net.isIP(address) }));
        if (opts.all) return callback(null, records);
        return callback(null, records[0].address, records[0].family);
      },
      () => callback(new SafeFetchError("NETWORK", "That address couldn't be found."))
    );
  };

  return new Promise((done, fail) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      // No shared agent: a reused socket would skip the lookup above.
      { method: "GET", headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain;q=0.9" }, lookup, agent: false, signal },
      (response) => {
        const status = response.statusCode;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.destroy();
          return done({ redirect: response.headers.location });
        }

        const type = response.headers["content-type"];
        if (type && !TEXT_TYPES.test(type)) {
          response.destroy();
          return fail(new SafeFetchError("NOT_TEXT", "That link isn't a page that can be read."));
        }

        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            return fail(new SafeFetchError("TOO_LARGE", "That page is too large to read."));
          }
          return chunks.push(chunk);
        });
        response.on("end", () => done({ status, body: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", fail);
        return undefined;
      }
    );
    request.on("error", fail);
    request.end();
  });
}

export async function safeFetch(link, overrides = {}) {
  const { timeoutMs, maxBytes, maxRedirects, allowedPorts } = { ...DEFAULTS, ...overrides };
  const resolve = overrides.resolve || defaultResolve;
  const isAllowedAddress = overrides.isAllowedAddress || isPublicAddress;

  // One budget for the whole fetch, across every hop and the body.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = parseLink(link, allowedPorts);

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const result = await fetchOnce(url, { resolve, isAllowedAddress, maxBytes, signal: controller.signal });
      if (!result.redirect) return { status: result.status, body: result.body, finalUrl: url.toString() };
      url = parseLink(new URL(result.redirect, url).toString(), allowedPorts);
    }
    throw new SafeFetchError("TOO_MANY_REDIRECTS", "That link redirects too many times.");
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (controller.signal.aborted) throw new SafeFetchError("TIMEOUT", "That link took too long to open.");
    if (err.cause instanceof SafeFetchError) throw err.cause;
    throw new SafeFetchError("NETWORK", "That link couldn't be opened.");
  } finally {
    clearTimeout(timer);
  }
}
