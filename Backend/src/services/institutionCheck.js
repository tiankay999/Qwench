import { hashIdentifier, normalizeIdentifier } from "../lib/identifiers.js";
import { Contribution, Entity, Relation, Signal } from "../models/index.js";
import { logCheck } from "../utils/logCheck.js";
import { evaluate, extractIdentifiers } from "./evidenceEngine.js";

function inputTypeFor(type) {
  if (type === "momo_number" || type === "bank_account") return "number";
  if (type === "domain" || type === "wallet") return type;
  if (type === "url" || type === "telegram_link") return "url";
  return "name";
}

/**
 * One payment or lookup for an institution. /v1/check and the console's payment
 * check both use this, so they can't drift apart.
 */
export async function institutionCheck({ recipient, type, amount_ghs: amountGhs, new_payee: newPayee = false, org }) {
  const result = await evaluate({ recipient, type, amount_ghs: amountGhs, new_payee: newPayee, audience: "institution", org });

  // Never awaited, and never throws: a log write must not hold up the reply.
  logCheck({
    channel: "api",
    inputType: inputTypeFor(type),
    identifierHashes: [result.value_hash],
    matchedEntityIds: result.entity_id ? [result.entity_id] : [],
    state: result.state,
    tier: result.tier,
    flags: result.reason_codes,
    outcome: result.suggested_action,
    isDemo: result.is_demo,
  });

  const shared = {
    match: result.match,
    entity: result.entity,
    state: result.state,
    tier: result.tier,
    reason_codes: result.reason_codes,
    sources: result.sources,
    foreign_context: result.foreign_context,
    allowed_use: result.allowed_use,
    suggested_action: result.suggested_action,
    report: result.report,
    is_demo: result.is_demo,
    checked_at: result.checked_at,
  };

  if (!result.match) return { ...shared, did_you_mean: result.did_you_mean || null };

  const [entity, relations, signal] = await Promise.all([
    result.entity_id ? Entity.findById(result.entity_id).select("kind").lean() : null,
    result.entity_id ? Relation.find({ fromEntity: result.entity_id, status: "active" }).populate("toEntity", "name slug kind").lean() : [],
    result.entity_slug
      ? Signal.findOne({ key: { $in: [String(result.entity_id), result.entity_slug] }, anomalyFlag: true, reviewStatus: "reviewed" })
          .sort({ weekStart: -1 })
          .lean()
      : null,
  ]);

  return {
    ...shared,
    entity_slug: result.entity_slug,
    entity_kind: entity?.kind || null,
    relations: relations.map((rel) => ({
      type: rel.type,
      to_entity: rel.toEntity?.name || null,
      to_entity_slug: rel.toEntity?.slug || null,
    })),
    merchant_claim: result.merchant_claim || { registered: false },
    signal: signal
      ? {
          checks_this_week: signal.checksThisWeek,
          checks_last_week: signal.checksLastWeek,
          distinct_sources: signal.distinctSources,
          week_start: signal.weekStart,
        }
      : null,
  };
}

function hashFor(recipient, type) {
  const { value, lookupType } = extractIdentifiers(recipient, type);
  const normalized = normalizeIdentifier(lookupType, value);
  return normalized ? hashIdentifier(lookupType, normalized) : "";
}

/** The console's lookup: the same result, plus how many members reported it. */
export async function consoleLookup({ recipient, type, org }) {
  const reply = await institutionCheck({ recipient, type, org });
  const valueHash = hashFor(recipient, type);

  // Independent organisations, never their names.
  const members = valueHash
    ? await Contribution.distinct("orgId", { "identifiers.valueHash": valueHash, reviewStatus: "reviewed" })
    : [];

  return { ...reply, member_report_count: members.length, signal: reply.signal ?? null };
}
