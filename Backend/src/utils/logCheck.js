import { Check } from "../models/index.js";
import { hashSender, hourBucket } from "../lib/identifiers.js";

/**
 * Record one lookup for the Signal and Case pipelines.
 *
 * Never throws into the request path: a failure to log must not turn a working
 * check into a 500 for the person asking whether they are about to be
 * defrauded.
 */
export async function logCheck({
  channel = "api",
  inputType,
  identifierHashes = [],
  matchedEntityIds = [],
  state = "no_record",
  tier = null,
  flags = [],
  sender,
  outcome = "none",
}) {
  try {
    await Check.create({
      hourBucket: hourBucket(),
      channel,
      inputType,
      identifierHashes: identifierHashes.filter(Boolean),
      matchedEntityIds,
      state,
      tier,
      flags,
      // Hashed here, never passed in raw. Rotates daily and is cleared after
      // 24h by src/scripts/pruneSenderHashes.js.
      senderHash: sender ? hashSender(sender) : null,
      outcome,
    });
  } catch (err) {
    console.error(`[check-log] could not record check: ${err.message}`);
  }
}
