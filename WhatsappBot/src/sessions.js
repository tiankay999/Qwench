/**
 * Per-user conversation state, kept in memory.
 * Good enough for a hackathon demo -- restarting the bot just resets everyone
 * to the welcome flow. Swap for Redis or a Mongo collection later.
 */

export const STATE = {
  IDLE: "IDLE",
  AWAITING_CHECK_QUERY: "AWAITING_CHECK_QUERY",
  AWAITING_SCHEME_NAME: "AWAITING_SCHEME_NAME",
  AWAITING_SCHEME_SOURCE: "AWAITING_SCHEME_SOURCE",
};

const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000; // an hour of silence resets the flow

export function getSession(jid) {
  const existing = sessions.get(jid);

  if (existing && Date.now() - existing.lastSeen < SESSION_TTL_MS) {
    existing.lastSeen = Date.now();
    return existing;
  }

  if (existing) console.log(`[session] ${jid} expired, starting fresh`);

  const session = {
    jid,
    state: STATE.IDLE,
    isNew: !existing,
    draft: {},
    lastSeen: Date.now(),
  };
  sessions.set(jid, session);
  return session;
}

export function setState(session, state) {
  console.log(`[session] ${session.jid}: ${session.state} -> ${state}`);
  session.state = state;
}

export function resetSession(session) {
  session.state = STATE.IDLE;
  session.draft = {};
}
