import { Check } from "../models/index.js";
import { hourBucket } from "../lib/identifiers.js";

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
      outcome,
    });
  } catch (err) {
    // The name only: a database error message can quote the values it rejected.
    console.error(`[check-log] could not record check: ${err.name}`);
  }
}
