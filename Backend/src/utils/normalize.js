/**
 * Identifier normalisation, at the path the API contract specifies.
 *
 * This deliberately re-exports `src/lib/identifiers.js` rather than carrying a
 * second implementation. The 262 identifiers already in MongoDB were
 * normalised and hashed by that module; a parallel normaliser that differed by
 * even a trailing slash would hash to a different value and every lookup would
 * silently miss.
 */

export {
  normalizeIdentifier as normalize,
  normalizeAccount,
  normalizeDomain,
  normalizeHandle,
  normalizeName,
  normalizePhone,
  normalizeWallet,
  slugifyEntity,
  IDENTIFIER_TYPES,
  SENSITIVE_TYPES,
} from "../lib/identifiers.js";
