import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

import { isPublicAddress, safeFetch } from "../src/lib/safeFetch.js";

let server;
let port;
const hits = [];

before(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url);
    const send = (status, headers = {}, body = "") => {
      res.writeHead(status, { "content-type": "text/html", ...headers });
      res.end(body);
    };
    if (req.url === "/ok") return send(200, {}, "<title>Fixture</title>hello");
    if (req.url === "/to-ok") return send(302, { location: "/ok" });
    if (req.url === "/to-private") return send(302, { location: `http://private.test:${port}/ok` });
    if (req.url === "/to-literal") return send(302, { location: `http://127.0.0.2:${port}/ok` });
    if (req.url === "/to-metadata") return send(302, { location: "http://169.254.169.254/latest/meta-data/" });
    if (req.url === "/to-file") return send(302, { location: "file:///etc/passwd" });
    if (req.url === "/to-rebind") return send(302, { location: `http://rebind.test:${port}/ok` });
    if (req.url === "/loop") return send(302, { location: "/loop" });
    if (req.url === "/big") return send(200, {}, "x".repeat(50_000));
    if (req.url === "/binary") return send(200, { "content-type": "application/zip" }, "PK");
    if (req.url === "/slow-head") return undefined; // never answers
    if (req.url === "/slow-body") {
      res.writeHead(200, { "content-type": "text/html" });
      res.write("start");
      return undefined; // never finishes
    }
    return send(404);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

// Fake DNS, so the tests need no network. Only 127.0.0.1 counts as allowed here.
const DNS = {
  "public.test": ["127.0.0.1"],
  "private.test": ["10.0.0.1"],
  "mixed.test": ["127.0.0.1", "10.0.0.1"],
  "none.test": [],
};
const options = (extra = {}) => ({
  resolve: async (host) => DNS[host] || ["127.0.0.1"],
  isAllowedAddress: (ip) => ip === "127.0.0.1",
  allowedPorts: [port],
  ...extra,
});
const url = (path, host = "public.test") => `http://${host}:${port}${path}`;
const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code);

test("fetches a public page", async () => {
  const page = await safeFetch(url("/ok"), options());
  assert.equal(page.status, 200);
  assert.match(page.body, /hello/);
  assert.equal(page.finalUrl, url("/ok"));
});

test("follows a redirect to a public page", async () => {
  const page = await safeFetch(url("/to-ok"), options());
  assert.match(page.body, /hello/);
  assert.equal(page.finalUrl, url("/ok"));
});

test("blocks a name that resolves to a private address", () => rejects(safeFetch(url("/ok", "private.test"), options()), "BLOCKED_ADDRESS"));
test("blocks when any resolved address is private", () => rejects(safeFetch(url("/ok", "mixed.test"), options()), "BLOCKED_ADDRESS"));
test("blocks a name with no addresses", () => rejects(safeFetch(url("/ok", "none.test"), options()), "BLOCKED_ADDRESS"));
test("blocks a private literal address", () => rejects(safeFetch(url("/ok", "127.0.0.2"), options()), "BLOCKED_ADDRESS"));
test("blocks a redirect to a name on a private address", () => rejects(safeFetch(url("/to-private"), options()), "BLOCKED_ADDRESS"));
test("blocks a redirect to a private literal address", () => rejects(safeFetch(url("/to-literal"), options()), "BLOCKED_ADDRESS"));
test("blocks a redirect to the cloud metadata address", () => rejects(safeFetch(url("/to-metadata"), options({ allowedPorts: [port, 80] })), "BLOCKED_ADDRESS"));
test("blocks a redirect to another protocol", () => rejects(safeFetch(url("/to-file"), options()), "BAD_URL"));
test("stops a redirect loop", () => rejects(safeFetch(url("/loop"), options()), "TOO_MANY_REDIRECTS"));

test("a DNS change between hops can't get around the check", async () => {
  let calls = 0;
  const rebinding = options({
    resolve: async (host) => {
      if (host !== "rebind.test") return ["127.0.0.1"];
      calls += 1;
      return calls === 1 ? ["127.0.0.1"] : ["10.0.0.1"];
    },
  });
  await safeFetch(url("/to-rebind", "rebind.test"), rebinding).catch((err) => assert.equal(err.code, "BLOCKED_ADDRESS"));
  assert.ok(calls >= 2, "every hop resolves again");
});

test("connects to the address it validated", async () => {
  // DNS answers once per connection, so there's no second lookup to swap.
  let calls = 0;
  const before = hits.length;
  await safeFetch(url("/ok", "once.test"), options({
    resolve: async () => {
      calls += 1;
      return calls === 1 ? ["127.0.0.1"] : ["10.0.0.1"];
    },
  }));
  assert.equal(calls, 1);
  assert.equal(hits.length, before + 1);
});

test("caps the response size", () => rejects(safeFetch(url("/big"), options({ maxBytes: 1000 })), "TOO_LARGE"));
test("caps the time waiting for an answer", () => rejects(safeFetch(url("/slow-head"), options({ timeoutMs: 200 })), "TIMEOUT"));
test("caps the time reading the body", () => rejects(safeFetch(url("/slow-body"), options({ timeoutMs: 200 })), "TIMEOUT"));
test("refuses content that isn't text", () => rejects(safeFetch(url("/binary"), options()), "NOT_TEXT"));

test("refuses other ports by default", () => rejects(safeFetch("http://example.test:8080/", { resolve: async () => ["93.184.216.34"] }), "BAD_URL"));
test("refuses other protocols", () => rejects(safeFetch("ftp://example.test/"), "BAD_URL"));
test("refuses a link with a username or password", () => rejects(safeFetch("http://user:pass@example.test/"), "BAD_URL"));
test("refuses something that isn't a link", () => rejects(safeFetch("not a link"), "BAD_URL"));

for (const literal of ["http://2130706433/", "http://0x7f.0.0.1/", "http://127.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://0.0.0.0/", "http://localhost/"]) {
  test(`blocks the disguised address ${literal}`, () =>
    rejects(safeFetch(literal, { resolve: async () => ["127.0.0.1"] }), "BLOCKED_ADDRESS"));
}

for (const address of [
  "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
  "224.0.0.1", "240.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1",
  "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "0:0:0:0:0:ffff:7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::",
  "not an ip",
]) {
  test(`${address} is not a public address`, () => assert.equal(isPublicAddress(address), false));
}

for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111"]) {
  test(`${address} is a public address`, () => assert.equal(isPublicAddress(address), true));
}
