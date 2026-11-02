import { hashIdentifier, normalizeDomain } from "../lib/identifiers.js";
import { PageSeen } from "../models/index.js";

const KEEP_DAYS = 30;
const MIN_HOURS = 1;
const HOUR_MS = 3_600_000;

/**
 * How many hours a page's relative times have stayed exactly the same, or null. Only
 * counts once a real gap has passed, and times that move start the clock again.
 */
export async function frozenFor(url, timeSignature, now = new Date()) {
  if (!timeSignature) return null;

  const pageHash = hashIdentifier("domain", `${normalizeDomain(url)}${new URL(url).pathname}`);
  const expiresAt = new Date(now.getTime() + KEEP_DAYS * 24 * HOUR_MS);
  const seen = await PageSeen.findOne({ pageHash });

  if (!seen || seen.timeSignature !== timeSignature) {
    await PageSeen.updateOne({ pageHash }, { $set: { timeSignature, firstSeen: now, expiresAt } }, { upsert: true });
    return null;
  }

  const hours = Math.floor((now.getTime() - seen.firstSeen.getTime()) / HOUR_MS);
  return hours >= MIN_HOURS ? hours : null;
}
