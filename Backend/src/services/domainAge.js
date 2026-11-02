import net from "node:net";

import { hashIdentifier } from "../lib/identifiers.js";
import { safeFetch } from "../lib/safeFetch.js";
import { DomainAge } from "../models/index.js";

/**
 * How old a website's domain is. Used for one plain fact in a reply, so anything
 * unknown or failed just means nothing is said.
 *
 * .gh domains: only the registry answers, at whois.nic.gh. Its terms forbid
 * high-volume automated use, so this is off unless GH_WHOIS_LOOKUP=true, capped per
 * hour, cached, and only ever runs for a link someone sent.
 * Everything else: RDAP, the public registration lookup.
 */

const DAY_MS = 86_400_000;
const KNOWN_FOR_DAYS = 30;
const UNKNOWN_FOR_DAYS = 7;
const LOOKUP_TIMEOUT_MS = 4000;
const MAX_WHOIS_BYTES = 64 * 1024;
const DEFAULT_GH_PER_HOUR = 30;
const SECOND_LEVELS = new Set(["com", "co", "org", "net", "edu", "gov", "ac", "mil"]);

/** app.example.com becomes example.com, and shop.com.gh stays as it is. */
export function registrableDomain(domain) {
  const labels = String(domain || "").toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const hasSecondLevel = labels.at(-1).length === 2 && SECOND_LEVELS.has(labels.at(-2)) && labels.length >= 3;
  return labels.slice(hasSecondLevel ? -3 : -2).join(".");
}

export async function rdapRegisteredOn(domain, { fetchJson } = {}) {
  const get =
    fetchJson ||
    (async (name) => {
      const { status, body } = await safeFetch(`https://rdap.org/domain/${encodeURIComponent(name)}`, { timeoutMs: LOOKUP_TIMEOUT_MS, accept: "application/rdap+json, application/json" });
      if (status === 404) return {};
      if (status !== 200) throw new Error("RDAP lookup failed");
      return JSON.parse(body);
    });

  const data = await get(domain);
  const event = (data.events || []).find((e) => e.eventAction === "registration");
  return event?.eventDate ? new Date(event.eventDate) : null;
}

/** Reads the creation date and nothing else. The rest of the record is never kept. */
export function whoisRegisteredOn(domain, { host = "whois.nic.gh", port = 43, timeoutMs = LOOKUP_TIMEOUT_MS } = {}) {
  // Only a plain .gh name: it goes straight onto a socket.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.gh$/.test(domain)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    const socket = net.connect({ host, port });
    const finish = () => {
      socket.destroy();
      const match = Buffer.concat(chunks).toString("utf8").match(/^\s*Creation Date:\s*(\S+)/im);
      resolve(match ? new Date(match[1]) : null);
    };

    socket.setTimeout(timeoutMs, finish);
    socket.on("connect", () => socket.write(`${domain}\r\n`));
    socket.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_WHOIS_BYTES) return finish();
      return chunks.push(chunk);
    });
    socket.on("end", finish);
    socket.on("error", () => resolve(null));
  });
}

let ghWindow = { startedAt: 0, count: 0 };

function ghAllowed() {
  const limit = Number(process.env.GH_WHOIS_MAX_PER_HOUR) || DEFAULT_GH_PER_HOUR;
  if (Date.now() - ghWindow.startedAt > 3_600_000) ghWindow = { startedAt: Date.now(), count: 0 };
  if (ghWindow.count >= limit) return false;
  ghWindow.count += 1;
  return true;
}

const usable = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) && date <= new Date() ? date : null);

export async function domainAge(domain, { rdap = rdapRegisteredOn, whois = whoisRegisteredOn } = {}) {
  const name = registrableDomain(domain);
  if (!name) return null;

  const isGh = name.endsWith(".gh");
  if (isGh && process.env.GH_WHOIS_LOOKUP !== "true") return null;

  const valueHash = hashIdentifier("domain", name);
  const cached = await DomainAge.findOne({ valueHash }).lean();
  if (cached) return cached.registeredOn;

  if (isGh && !ghAllowed()) return null;

  let registeredOn;
  try {
    registeredOn = usable(await (isGh ? whois(name) : rdap(name)));
  } catch {
    // A failed lookup isn't an answer, so it isn't remembered.
    return null;
  }

  const days = registeredOn ? KNOWN_FOR_DAYS : UNKNOWN_FOR_DAYS;
  await DomainAge.updateOne(
    { valueHash },
    { $set: { registeredOn, expiresAt: new Date(Date.now() + days * DAY_MS) } },
    { upsert: true }
  ).catch(() => {});
  return registeredOn;
}
