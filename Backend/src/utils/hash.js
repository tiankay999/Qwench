/**
 * Hashing helpers, at the path the API contract specifies.
 *
 * Two deliberate differences from the contract's sketch, both load-bearing:
 *
 * 1. `hmacHash` takes the identifier TYPE as well as the value. Every
 *    identifier already stored was hashed as HMAC(key, `${type}:${normalized}`).
 *    A type-less hash would produce a different digest, so no lookup would ever
 *    match the migrated data — and the same digits as a MoMo number and as a
 *    bank account would collide.
 *
 * 2. `hashApiKey` uses HMAC with HMAC_SECRET_KEY, not a bare SHA-256. An API
 *    key is high-entropy but a plain digest is still brute-forceable offline
 *    from a stolen dump; a keyed hash is not without the server key. Keys were
 *    minted this way, so the auth middleware must verify them this way.
 */

export {
  hashIdentifier as hmacHash,
  hashSender as dailySenderHash,
  buildIdentifier,
  hourBucket,
  encryptContact,
  decryptContact,
} from "../lib/identifiers.js";

export { hashApiKey, generateApiKey } from "../models/ApiKey.js";
