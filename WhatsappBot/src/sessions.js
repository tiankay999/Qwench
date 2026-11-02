/**
 * Per-user conversation state, kept in memory.
 * Good enough for a hackathon demo -- restarting the bot just resets everyone
 * to the welcome flow. Swap for Redis or a Mongo collection later.
 */

export const STATE = {
  IDLE: "IDLE",
  AWAITING_CHECK_QUERY: "AWAITING_CHECK_QUERY",
  AWAITING_SCHEME_NAME: "AWAITING_SCHEME_NAME",
  // The API suggested a close name; a "yes" checks that name.
  AWAITING_SUGGESTION_REPLY: "AWAITING_SUGGESTION_REPLY",
};

// Short-lived flows expire faster than the session itself, so a stale prompt
// never swallows a fresh question.
const STATE_TTL_MS = {
  [STATE.AWAITING_SUGGESTION_REPLY]: 5 * 60 * 1000,
};

const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000; // an hour of silence resets the flow

export function getSession(jid) {
  const existing = sessions.get(jid);

  if (existing && Date.now() - existing.lastSeen < SESSION_TTL_MS) {
    existing.lastSeen = Date.now();
    return existing;
  }

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
  session.state = state;
  session.stateSince = Date.now();
}

/**
 * Has the current flow been waiting too long? A user who asked about a spoofed
 * name ten minutes ago and now types a new company name should get a fresh
 * check, not have "1" interpreted as a menu choice.
 */
export function stateExpired(session) {
  const ttl = STATE_TTL_MS[session.state];
  if (!ttl || !session.stateSince) return false;

  if (Date.now() - session.stateSince > ttl) {
    return true;
  }
  return false;
}

export function resetSession(session) {
  session.state = STATE.IDLE;
  session.draft = {};
}
