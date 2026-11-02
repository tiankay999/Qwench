import crypto from "node:crypto";

/**
 * Per-sender conversation state, in memory only.
 *
 * Keyed on a local hash of the sender, never the raw number, so a heap dump or
 * a log line cannot be turned back into someone's phone number. Nothing here
 * is persisted; restarting the bot forgets everyone, which is the right
 * trade-off for a service that promises not to keep your messages.
 */

export const STEP = {
  IDLE: "IDLE",
  REPORT_NAME: "REPORT_NAME",
  REPORT_DETAILS: "REPORT_DETAILS",
  REPORT_CONFIRM: "REPORT_CONFIRM",
  DID_YOU_MEAN: "DID_YOU_MEAN",
};

const TTL = {
  [STEP.REPORT_NAME]: 10 * 60 * 1000,
  [STEP.REPORT_DETAILS]: 10 * 60 * 1000,
  [STEP.REPORT_CONFIRM]: 10 * 60 * 1000,
  [STEP.DID_YOU_MEAN]: 5 * 60 * 1000,
};

const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000;

/** Opaque, stable per sender for this process. Not reversible to a number. */
export function senderKey(rawId) {
  return crypto.createHash("sha256").update(`bot:${String(rawId)}`).digest("hex").slice(0, 32);
}

export function getSession(rawId) {
  const key = senderKey(rawId);
  const existing = sessions.get(key);
  const now = Date.now();

  if (existing && now - existing.lastSeen < SESSION_TTL_MS) {
    existing.lastSeen = now;
    // A flow the user walked away from must not swallow their next question.
    const ttl = TTL[existing.step];
    if (ttl && now - existing.stepSince > ttl) reset(existing);
    return existing;
  }

  const session = { key, step: STEP.IDLE, stepSince: now, draft: {}, greeted: false, lastSeen: now };
  sessions.set(key, session);
  return session;
}

export function setStep(session, step) {
  session.step = step;
  session.stepSince = Date.now();
}

export function reset(session) {
  session.step = STEP.IDLE;
  session.stepSince = Date.now();
  session.draft = {};
}

/** True the first time this sender is seen, so the privacy line shows once. */
export function markGreeted(session) {
  if (session.greeted) return false;
  session.greeted = true;
  return true;
}

// Drop idle sessions so memory does not grow with every number that ever
// messaged the bot.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.lastSeen > SESSION_TTL_MS) sessions.delete(key);
  }
}, 60 * 1000);
sweep.unref?.();

export function sessionCount() {
  return sessions.size;
}
