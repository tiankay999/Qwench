// DEPRECATED — superseded by src/services/evidenceEngine.js, which implements
// the full 9-step evidence flow. The /v1 routes no longer import this.

// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Risk colors
// - Recommendations or advice text
// - Community boost scores
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
// Sandbox, licensed, and authority results are LEGAL STATES, never warnings.

import Fuse from "fuse.js";

import { hashIdentifier, normalizeIdentifier } from "../lib/identifiers.js";
import { Contribution, Entity, Identifier, Merchant, Record, Relation, Signal } from "../models/index.js";

/* ------------------------------------------------------------------ *
 * Legal state
 * ------------------------------------------------------------------ */

/** Priority: named_in_notice > licensed > sandbox > registered > no_record. */
export function determineState(records) {
  if (records.some((r) => r.type === "warning" || r.type === "sanction" || r.type === "foreign_alert")) {
    return "named_in_notice";
  }
  if (records.some((r) => r.type === "licence" && r.status === "active")) return "licensed";
  if (records.some((r) => r.type === "sandbox" && r.status === "active")) return "sandbox";
  if (records.some((r) => r.type === "registration" && r.status === "active")) return "registered";
  return "no_record";
}

/* ------------------------------------------------------------------ *
 * Evidence tier
 * ------------------------------------------------------------------ */

/**
 * The tier is about how well evidenced a claim is, not how bad it looks.
 *
 * 1  a regulator said it
 * 2  a partner institution confirmed it, or a reviewed impersonation link
 * 3  three or more independent corroborated reports
 * 4  rising check volume only
 * null  nothing that meets a bar
 */
export async function determineTier(records, entityId) {
  if (records.some((r) => ["warning", "sanction", "foreign_alert"].includes(r.type))) return 1;

  const entity = entityId ? await Entity.findById(entityId).select("slug name").lean() : null;

  // Tier 2 — a member organisation confirmed it, or a reviewed impersonation.
  const [reviewedContribution, confirmedImpersonation] = await Promise.all([
    entity
      ? Contribution.findOne({ schemeName: new RegExp(`^${escapeRegex(entity.name)}$`, "i"), reviewStatus: "reviewed" })
          .select("_id")
          .lean()
      : null,
    entityId
      ? Relation.findOne({ fromEntity: entityId, type: { $in: ["impersonates", "claims_affiliation"] }, status: "active" })
          .select("_id")
          .lean()
      : null,
  ]);
  if (reviewedContribution || confirmedImpersonation) return 2;

  // Tier 3 — several independent member reports, each carrying evidence.
  if (entity) {
    const corroborating = await Contribution.countDocuments({
      schemeName: new RegExp(`^${escapeRegex(entity.name)}$`, "i"),
      reviewStatus: { $ne: "rejected" },
      "evidenceRefs.0": { $exists: true },
    });
    if (corroborating >= 3) return 3;
  }

  // Tier 4 — a reviewed spike in checks. Watch only.
  if (entity) {
    const spike = await Signal.findOne({ key: entity.slug, anomalyFlag: true, reviewStatus: "reviewed" })
      .select("_id")
      .lean();
    if (spike) return 4;
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Reason codes
 * ------------------------------------------------------------------ */

/** Entities that already hold legal standing are not "unregistered businesses". */
const HAS_STANDING = new Set(["licensed", "sandbox", "registered"]);

export async function buildReasonCodes({ records, tier, entityId, merchantClaim, state, identifierType }) {
  const codes = new Set();

  if (records.some((r) => r.type === "warning" || r.type === "foreign_alert")) codes.add("REGULATOR_NOTICE");
  if (records.some((r) => r.type === "sanction")) codes.add("SANCTIONS_LIST");

  if (tier === 2) {
    const impersonation = entityId
      ? await Relation.findOne({ fromEntity: entityId, type: { $in: ["impersonates", "claims_affiliation"] }, status: "active" })
          .select("_id")
          .lean()
      : null;
    codes.add(impersonation ? "ADVERTISED_AS_BUSINESS_NOT_REGISTERED" : "PARTNER_CONFIRMED");
  }

  if (tier === 3) codes.add("CORROBORATED_REPORTS");
  if (tier === 4) codes.add("CHECK_SPIKE");

  // A NUMBER presented as a business till that holds no merchant registration.
  //
  // Scoped tightly on purpose. The merchant registry covers MoMo and bank
  // numbers, so this never applies to a name or domain lookup, and it never
  // applies to an entity that already holds a licence, sandbox place or
  // registration — telling a bank that an SEC-licensed fund manager is an
  // unregistered business would be plainly false.
  const isNumber = identifierType === "momo_number" || identifierType === "bank_account";
  if (isNumber && !HAS_STANDING.has(state) && merchantClaim?.advertisedAsBusiness && !merchantClaim.registered) {
    codes.add("ADVERTISED_AS_BUSINESS_NOT_REGISTERED");
  }

  return [...codes];
}

/* ------------------------------------------------------------------ *
 * Suggested action
 * ------------------------------------------------------------------ */

export function determineSuggestedAction(tier, newPayee) {
  if (tier === 1) return "warn";
  if (tier === 2) return newPayee ? "warn_or_confirmation_call" : "warn";
  if (tier === 3) return "internal_review";
  if (tier === 4) return "watch";
  return "none";
}

/**
 * Only a regulator-grade finding may be shown to an end customer. Everything
 * else is for the institution to act on internally -- telling a customer their
 * payee is suspected on thinner evidence would be an accusation Qwench cannot
 * stand behind.
 */
export function allowedUse(tier) {
  return tier === 1 ? "customer_warning" : "internal_only";
}

/* ------------------------------------------------------------------ *
 * Merchant registry
 * ------------------------------------------------------------------ */

/**
 * "Registered by X" or no claim. Never "safe": registration proves who
 * controls a number, not that a deal is sound. And absence is not a negative --
 * most legitimate traders will never register.
 */
export async function checkMerchantRegistry(identifier) {
  if (!identifier) return { registered: false, advertisedAsBusiness: false };

  const merchant = await Merchant.findOne({ officialIdentifiers: identifier._id, status: "verified" })
    .select("legalName verifiedAt")
    .lean();

  if (merchant) {
    return {
      registered: true,
      business: merchant.legalName,
      verifiedAt: merchant.verifiedAt,
      advertisedAsBusiness: true,
    };
  }

  // The identifier is linked to an entity that presents itself as a business
  // (a merchant or company) but holds no verified registration.
  const entity = await Entity.findById(identifier.entityId).select("kind").lean();
  return {
    registered: false,
    advertisedAsBusiness: ["merchant", "company", "platform"].includes(entity?.kind),
  };
}

/* ------------------------------------------------------------------ *
 * Identifier lookup
 * ------------------------------------------------------------------ */

// Fuzzy index over name identifiers that are allowed to be fuzzy-matched.
// `allowFuzzy` is false for numbers and for real brands that collide with
// names in SEC notices (Dallmayr, Daraz, Hut 8), so those are exact-only.
let fuzzyCache = null;
const FUZZY_TTL_MS = 5 * 60 * 1000;

export function invalidateFuzzyIndex() {
  fuzzyCache = null;
}

async function fuzzyIndex() {
  if (fuzzyCache && Date.now() - fuzzyCache.builtAt < FUZZY_TTL_MS) return fuzzyCache;

  const rows = await Identifier.find({ type: "name", allowFuzzy: true, status: "active" })
    .select("normalized entityId valueHash type")
    .lean();

  fuzzyCache = {
    builtAt: Date.now(),
    rows,
    fuse: new Fuse(rows, { includeScore: true, threshold: 0.3, keys: ["normalized"], minMatchCharLength: 3 }),
  };
  console.log(`[check] fuzzy name index built: ${rows.length} entries`);
  return fuzzyCache;
}

/**
 * Resolve an input to a stored identifier. Exact hash match first; for names
 * only, a tight fuzzy pass as a fallback.
 */
export async function resolveIdentifier(recipient, type) {
  // "url" is an input shape, not a stored identifier type: a pasted link is
  // matched on its domain.
  const lookupType = type === "url" ? "domain" : type;
  const normalized = normalizeIdentifier(lookupType, recipient);
  if (!normalized) return { normalized: "", valueHash: "", identifier: null, matchType: "none" };

  const valueHash = hashIdentifier(lookupType, normalized);
  const exact = await Identifier.findOne({ valueHash, status: "active" }).lean();
  if (exact) return { normalized, valueHash, identifier: exact, matchType: "exact" };

  if (lookupType !== "name") return { normalized, valueHash, identifier: null, matchType: "none" };

  const { fuse } = await fuzzyIndex();
  const hit = fuse.search(normalized)[0];
  if (!hit || hit.score > 0.3) return { normalized, valueHash, identifier: null, matchType: "none" };

  const full = await Identifier.findById(hit.item._id).lean();
  return { normalized, valueHash, identifier: full, matchType: "fuzzy", fuzzyScore: Number(hit.score.toFixed(3)) };
}

/* ------------------------------------------------------------------ *
 * The check itself
 * ------------------------------------------------------------------ */

/**
 * Everything both layers share. The route decides how much of it to serialise:
 * the public shape is deliberately thinner than the institutional one.
 */
export async function performCheck({ recipient, type, newPayee = false }) {
  const { normalized, valueHash, identifier, matchType, fuzzyScore } = await resolveIdentifier(recipient, type);

  if (!identifier) {
    return { match: false, valueHash, normalized, state: "no_record", tier: null, suggestedAction: "none" };
  }

  const entity = await Entity.findById(identifier.entityId).lean();
  if (!entity) {
    return { match: false, valueHash, normalized, state: "no_record", tier: null, suggestedAction: "none" };
  }

  const records = await Record.find({ entityId: entity._id, status: "active" }).populate("sourceId").lean();

  const state = determineState(records);
  const tier = await determineTier(records, entity._id);
  const merchantClaim = await checkMerchantRegistry(identifier);
  const reasonCodes = await buildReasonCodes({
    records,
    tier,
    entityId: entity._id,
    merchantClaim,
    state,
    identifierType: identifier.type,
  });
  const suggestedAction = determineSuggestedAction(tier, newPayee);

  return {
    match: true,
    valueHash,
    normalized,
    matchType,
    fuzzyScore,
    identifier,
    entity,
    records,
    state,
    tier,
    reasonCodes,
    merchantClaim,
    suggestedAction,
  };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
