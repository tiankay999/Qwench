// QWENCH EVIDENCE ENGINE
//
// Rules decide. AI only extracts.
//
// There is no score, no verdict, no colour and no advice in anything this
// returns. A result is a legal state, an evidence tier, reason codes and the
// sources behind them. If a claim is not backed by a Record that cites a
// Source, it does not appear. All wording comes from src/engine/report.js.

import { buildReport, returnCheck } from "../engine/report.js";
import { warningSigns } from "../engine/extract.js";
import { EXACT_MATCH_ONLY, hashIdentifier, normalizeIdentifier, normalizeName } from "../lib/identifiers.js";
import {
  CASE_TRIGGERS,
  Case,
  Contribution,
  Entity,
  Identifier,
  Merchant,
  PublicReport,
  Record,
  Relation,
  Signal,
  recordAudit,
} from "../models/index.js";
import { buildNameIndex, verifyName } from "./nameVerifier.js";

const GHANA = "GH";
const NUMBER_TYPES = ["momo_number", "bank_account"];

const isLive = (record, now) => record.status === "active" && (!record.endsOn || new Date(record.endsOn) > now);
const isGhanaFinding = (r) => r.type === "sanction" || (r.type === "warning" && (r.jurisdiction || GHANA) === GHANA);
const isForeign = (r) => r.type === "foreign_alert" || (r.type === "warning" && (r.jurisdiction || GHANA) !== GHANA);

/* ------------------------------------------------------------------ *
 * Step 1 — Extract
 * ------------------------------------------------------------------ */

/** Work out what to look up. A pasted link is looked up on its domain. */
export function extractIdentifiers(recipient, type) {
  const raw = String(recipient || "").trim();
  if (type === "url" || type === "domain") return { value: raw, lookupType: "domain" };
  if (type === "name" && /^https?:\/\//i.test(raw)) return { value: raw, lookupType: "domain" };
  return { value: raw, lookupType: type };
}

/* ------------------------------------------------------------------ *
 * Step 3 — Match
 * ------------------------------------------------------------------ */

// A notice outranks a licence, which outranks sandbox, and so on. Used only to
// break a tie between entities claiming the same identifier.
const RECORD_WEIGHT = { warning: 5, sanction: 5, foreign_alert: 4, licence: 3, sandbox: 2, registration: 1 };

async function rankByRecordWeight(candidates) {
  let best = { weight: -1, identifier: candidates[0], entity: null };

  for (const identifier of candidates) {
    const [entity, records] = await Promise.all([
      Entity.findById(identifier.entityId).lean(),
      Record.find({ entityId: identifier.entityId, status: "active" }).select("type").lean(),
    ]);
    if (!entity) continue;

    const weight = records.reduce((max, r) => Math.max(max, RECORD_WEIGHT[r.type] || 0), 0);
    if (weight > best.weight) best = { weight, identifier, entity };
  }

  if (!best.entity) best.entity = await Entity.findById(candidates[0].entityId).lean();
  return best;
}

const VERIFIER_STATUS = { warning: "blacklisted", sanction: "blacklisted", licence: "licensed", sandbox: "sandbox", registration: "licensed" };

/**
 * A reviewed entity whose name is close to the query, or null.
 *
 * Only entities with allowFuzzy and a live record are considered, so nothing
 * unreviewed can ever be suggested. A close name is only ever a suggestion.
 */
async function closeName(query, now) {
  if (EXACT_MATCH_ONLY.has(normalizeName(query))) return null;

  const entities = await Entity.find({ allowFuzzy: true }).select("name aliases slug").lean();
  const named = [];
  for (const entity of entities) {
    if (EXACT_MATCH_ONLY.has(normalizeName(entity.name))) continue;
    const records = await Record.find({ entityId: entity._id, status: "active" }).select("type status endsOn").lean();
    const live = records.find((r) => isLive(r, now) && VERIFIER_STATUS[r.type]);
    if (live) named.push({ name: entity.name, aliases: entity.aliases || [], slug: entity.slug, status: VERIFIER_STATUS[live.type] });
  }
  if (!named.length) return null;

  const verdict = await verifyName(query, { index: buildNameIndex(named, { threshold: 0.3 }), strict: true });
  const close =
    ["exact", "blacklist_variant", "spoofing_alert", "legit_lookalike"].includes(verdict.decision) ||
    (verdict.decision === "soft_warning" && verdict.isSameEntity);
  return close ? verdict.match?.name || null : null;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ *
 * Step 4 — Legal state
 * ------------------------------------------------------------------ */

/** First match wins. Pass live records only. */
export function determineState(records, entity) {
  if (records.some(isGhanaFinding)) return "named_in_notice";
  if (entity?.kind === "authority") return "authority";
  if (records.some((r) => r.type === "licence")) return "licensed";
  if (records.some((r) => r.type === "sandbox")) return "sandbox";
  if (records.some((r) => r.type === "registration")) return "registered";
  return "no_record";
}

/* ------------------------------------------------------------------ *
 * Step 5 — Merchant registry
 * ------------------------------------------------------------------ */

/** Who registered this number, if anyone. Absence is never a claim. */
async function merchantForNumber(valueHash) {
  const ids = await Identifier.find({ valueHash, status: "active" }).select("_id").lean();
  if (!ids.length) return null;
  return Merchant.findOne({ officialIdentifiers: { $in: ids.map((i) => i._id) }, status: "verified" })
    .select("legalName verifiedAt isDemo")
    .lean();
}

/**
 * A number advertised under a registered business's name that isn't one of its
 * numbers goes to a person. It changes no result until someone has reviewed it.
 */
async function flagAdvertisedNumber(advertisedAs, type, valueHash) {
  if (!advertisedAs || !NUMBER_TYPES.includes(type)) return;

  const merchant = await Merchant.findOne({
    legalName: new RegExp(`^${escapeRegex(String(advertisedAs).trim())}$`, "i"),
    status: "verified",
  })
    .select("officialIdentifiers isDemo")
    .lean();
  if (!merchant) return;

  const isTheirs = await Identifier.exists({ _id: { $in: merchant.officialIdentifiers }, valueHash });
  if (isTheirs) return;

  const open = await Case.exists({ type: "impersonation", "identifiers.valueHash": valueHash, status: { $in: ["open", "under_review"] } });
  if (open) return;

  try {
    const created = await Case.create({
      caseNumber: await Case.nextCaseNumber(),
      type: "impersonation",
      trigger: CASE_TRIGGERS.REGISTERED_NAME_MISUSE,
      identifiers: [{ type, valueHash }],
      isDemo: Boolean(merchant.isDemo),
    });
    await recordAudit({ actor: "engine", action: "case.open", target: `Case:${created._id}`, after: { trigger: created.trigger } });
  } catch (err) {
    // A check must not fail because a review couldn't open.
    console.error(`[evidence] could not open a review: ${err.name}`);
  }
}

/* ------------------------------------------------------------------ *
 * Step 6 — Evidence tier
 * ------------------------------------------------------------------ */

const LEGAL_STATES_WITHOUT_TIER = new Set(["licensed", "sandbox", "registered", "authority"]);
const MIN_INDEPENDENT_SOURCES = 3;

/**
 * How well evidenced a finding is, not how bad it looks. Licensed, sandbox,
 * registered and authority are legal states and never carry a tier.
 */
async function determineTier({ state, records, hashes, entity }) {
  if (LEGAL_STATES_WITHOUT_TIER.has(state)) return { tier: null, codes: [] };

  const live = records.filter(isGhanaFinding);
  if (live.length) {
    const codes = [];
    if (live.some((r) => r.type === "warning")) codes.push("REGULATOR_NOTICE");
    if (live.some((r) => r.type === "sanction")) codes.push("SANCTIONS_LIST");
    return { tier: 1, codes };
  }

  const [partner, impersonation] = await Promise.all([
    Contribution.exists({ "identifiers.valueHash": { $in: hashes }, reviewStatus: "reviewed" }),
    entity ? Relation.exists({ fromEntity: entity._id, type: "impersonates", status: "active" }) : null,
  ]);
  if (partner || impersonation) {
    return {
      tier: 2,
      codes: [...(partner ? ["PARTNER_CONFIRMED"] : []), ...(impersonation ? ["ADVERTISED_AS_BUSINESS_NOT_REGISTERED"] : [])],
    };
  }

  // Independent channels, not volume. Twenty reports from one place are one source.
  const sources = await PublicReport.distinct("source", {
    "identifiers.valueHash": { $in: hashes },
    reviewStatus: "confirmed",
    "evidenceRefs.0": { $exists: true },
  });
  if (sources.length >= MIN_INDEPENDENT_SOURCES) return { tier: 3, codes: ["CORROBORATED_REPORTS"] };

  const signalKeys = [...hashes, entity?.slug, entity ? String(entity._id) : null].filter(Boolean);
  if (await Signal.exists({ key: { $in: signalKeys }, anomalyFlag: true, reviewStatus: "reviewed" })) {
    return { tier: 4, codes: ["CHECK_SPIKE"] };
  }

  return { tier: null, codes: [] };
}

/* ------------------------------------------------------------------ *
 * Step 7 — Permitted use and suggested action
 * ------------------------------------------------------------------ */

export function determineAllowedUse(tier, org) {
  if (tier === 1) return "customer_warning";
  if (tier === 2) return org?.warnsOnPartnerData ? "customer_warning" : "internal_review";
  if (tier === 3) return "internal_review";
  if (tier === 4) return "watch";
  return null;
}

export function determineSuggestedAction(tier, { allowedUse, newPayee, amountGhs, org }) {
  if (tier === 1) {
    const limit = org?.confirmationCallLimitGhs;
    const atLimit = limit !== null && limit !== undefined && amountGhs !== undefined && amountGhs !== null && Number(amountGhs) >= limit;
    return newPayee === true && atLimit ? "warn_or_confirmation_call" : "warn";
  }
  if (tier === 2) return allowedUse === "customer_warning" ? "warn" : "internal_review";
  if (tier === 3) return "internal_review";
  if (tier === 4) return "watch";
  return "none";
}

/* ------------------------------------------------------------------ *
 * The flow
 * ------------------------------------------------------------------ */

async function dataDate() {
  const latest = await Record.findOne({ status: "active" }).sort({ updatedAt: -1 }).select("updatedAt").lean();
  return latest ? latest.updatedAt.toISOString().split("T")[0] : null;
}

function sourceOf(record) {
  const s = record.sourceId || {};
  return {
    publisher: s.publisher,
    title: s.title,
    date: s.publishedOn ? new Date(s.publishedOn).toISOString().split("T")[0] : null,
    url: s.url || null,
    archive_url: s.archiveUrl || null,
    quote: record.quote || null,
    record_type: record.type,
    license_type: record.licenseType || null,
    jurisdiction: record.jurisdiction,
    effective_on: record.effectiveOn || null,
    ends_on: record.endsOn || null,
  };
}

/** Rule 5 and rule 4: only a Ghana finding or a legal state reaches the public. */
function maskForPublic(result) {
  if (result.tier !== 1) {
    result.tier = null;
    result.reason_codes = [];
  }
  result.allowed_use = null;
  result.suggested_action = "none";

  if (result.state === "no_record" && !result.foreign_context.length) {
    result.match = false;
    result.entity = null;
    result.entity_id = null;
    result.entity_slug = null;
    // Nothing is shown, so nothing may hint that a hidden record exists.
    result.is_demo = false;
  }
}

async function finish(result, { audience, text, extraText }) {
  if (audience !== "institution") maskForPublic(result);

  const reportText = text || extraText || "";
  result.return_check = returnCheck(reportText);
  result.warning_signs = warningSigns(text || "");
  result.report = buildReport({
    state: result.state,
    entity: result.entity,
    sources: result.state === "no_record" ? [] : result.sources,
    foreignContext: result.foreign_context,
    merchantClaim: result.merchant_claim,
    didYouMean: result.did_you_mean,
    text: reportText,
    dataDate: await dataDate(),
    isDemo: result.is_demo,
  });
  result.questions_to_ask = result.report.questions_to_ask;
  return result;
}

/**
 * Check one identifier.
 *
 * audience is "public" (the default, for bots and the web app) or "institution".
 * org is the calling organisation's document. text is the message it came in, if
 * any, used only for the return check and warning signs.
 */
export async function evaluate(input) {
  const {
    recipient,
    type,
    text,
    amount_ghs: amountGhs,
    new_payee: newPayee = false,
    skip_confirmation: skipConfirmation = false,
    advertised_as: advertisedAs,
    audience = "public",
    org = null,
  } = input;

  const now = new Date();
  const result = {
    match: false,
    entity: null,
    entity_id: null,
    entity_slug: null,
    state: "no_record",
    tier: null,
    reason_codes: [],
    sources: [],
    foreign_context: [],
    allowed_use: null,
    suggested_action: "none",
    warning_signs: [],
    return_check: null,
    questions_to_ask: [],
    is_demo: false,
    checked_at: now.toISOString(),
  };
  const context = { audience, text };

  /* --- 1. Extract and 2. Normalise --------------------------------- */
  const { value, lookupType } = extractIdentifiers(recipient, type);
  const normalized = normalizeIdentifier(lookupType, value);
  const valueHash = normalized ? hashIdentifier(lookupType, normalized) : "";
  result.value_hash = valueHash;
  if (!normalized) return finish(result, context);

  await flagAdvertisedNumber(advertisedAs, lookupType, valueHash);

  /* --- 3. Match: identifier hashes first, then names ---------------- */
  let entity = null;
  const candidates = await Identifier.find({ valueHash, status: "active" }).lean();
  if (candidates.length > 1) entity = (await rankByRecordWeight(candidates)).entity;
  else if (candidates.length) entity = await Entity.findById(candidates[0].entityId).lean();

  if (!entity && lookupType === "name") {
    const pattern = new RegExp(`^${escapeRegex(normalized)}$`, "i");
    entity = await Entity.findOne({ $or: [{ name: pattern }, { aliases: pattern }] }).lean();

    if (!entity && !skipConfirmation) {
      const suggested = await closeName(value, now);
      if (suggested) {
        result.needs_confirmation = true;
        result.did_you_mean = { suggested_entity: suggested };
      }
    }
  }

  const records = entity
    ? await Record.find({ entityId: entity._id }).populate("sourceId").lean()
    : [];
  const live = records.filter((r) => isLive(r, now));

  // A record nobody has reviewed, or one that has ended or been withdrawn, must
  // never reach a caller. Only a regulator's own entry answers without one.
  if (entity && records.length && !live.length && entity.kind !== "authority") entity = null;

  /* --- 4. Legal state ----------------------------------------------- */
  const merchant = NUMBER_TYPES.includes(lookupType) ? await merchantForNumber(valueHash) : null;
  result.state = determineState(live, entity);
  if (merchant && result.state === "no_record") result.state = "registered";
  if (merchant) {
    result.merchant_claim = { registered: true, business: merchant.legalName, since: merchant.verifiedAt };
  }

  /* --- 6. Tier ------------------------------------------------------ */
  const hashes = entity
    ? [...new Set([valueHash, ...(await Identifier.find({ entityId: entity._id }).select("valueHash").lean()).map((i) => i.valueHash)])]
    : [valueHash];
  const { tier, codes } = await determineTier({ state: result.state, records: live, hashes, entity });
  result.tier = tier;
  result.reason_codes = codes;

  /* --- Partner numbers have no entity of their own ------------------ */
  const contributions = await Contribution.find({ "identifiers.valueHash": { $in: hashes }, reviewStatus: "reviewed" })
    .select("schemeName terms isDemo")
    .lean();
  if (!entity && !merchant && !contributions.length && tier === null) return finish(result, context);

  /* --- Found ---------------------------------------------------------- */
  result.match = true;
  result.entity = entity?.name || merchant?.legalName || contributions[0]?.schemeName || null;
  result.entity_id = entity?._id || null;
  result.entity_slug = entity?.slug || null;
  result.sources = live.filter((r) => !isForeign(r) && r.sourceId).map(sourceOf);
  result.foreign_context = live
    .filter(isForeign)
    .map((r) => ({ jurisdiction: r.jurisdiction, publisher: r.sourceId?.publisher, date: sourceOf(r).date, url: r.sourceId?.url || null }));
  result.is_demo = Boolean(
    entity?.isDemo || merchant?.isDemo || live.some((r) => r.isDemo || r.sourceId?.isDemo) || contributions.some((c) => c.isDemo)
  );

  /* --- 7. Permitted use and action ---------------------------------- */
  result.allowed_use = determineAllowedUse(tier, org);
  result.suggested_action = determineSuggestedAction(tier, { allowedUse: result.allowed_use, newPayee, amountGhs, org });

  /* --- 8. Report. 9. Logging is the route's job. --------------------- */
  return finish(result, { ...context, extraText: contributions.find((c) => c.terms)?.terms });
}

export default { evaluate };
