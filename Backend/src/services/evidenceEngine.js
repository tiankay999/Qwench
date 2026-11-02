// QWENCH EVIDENCE ENGINE
//
// Rules decide. AI only extracts.
//
// There is no score, no verdict, no colour and no advice in anything this
// returns. A result is a legal state, an evidence tier, reason codes and the
// sources behind them. If a claim is not backed by a Record that cites a
// Source, it does not appear.

import {
  Contribution,
  Entity,
  Identifier,
  Merchant,
  PublicReport,
  Record,
  Relation,
  Signal,
} from "../models/index.js";
import { EXACT_MATCH_ONLY, hashIdentifier, normalizeIdentifier, normalizeName, slugifyEntity } from "../lib/identifiers.js";
import { verifyName } from "./nameVerifier.js";

/* ------------------------------------------------------------------ *
 * Step 1 — Extract
 * ------------------------------------------------------------------ */

/**
 * Pull the thing to look up out of whatever the user sent.
 *
 * Rules only. The AI extractor (src/services/aiExtractor.js) handles images
 * and pages, and feeds its findings back through here -- it never decides.
 */
export function extractIdentifiers(recipient, type) {
  const raw = String(recipient || "").trim();

  // A pasted link is looked up on its domain.
  if (type === "url" || type === "domain") {
    return { value: raw, lookupType: "domain" };
  }

  // A bare URL sent as a name is still a link.
  if (type === "name" && /^https?:\/\//i.test(raw)) {
    return { value: raw, lookupType: "domain" };
  }

  return { value: raw, lookupType: type };
}

/* ------------------------------------------------------------------ *
 * Step 4 — Legal state
 * ------------------------------------------------------------------ */

/** Priority order: named_in_notice wins over everything. */
export function determineState(records) {
  if (records.some((r) => ["warning", "sanction", "foreign_alert"].includes(r.type) && r.status === "active")) {
    return "named_in_notice";
  }
  if (records.some((r) => r.type === "licence" && r.status === "active")) return "licensed";
  if (records.some((r) => r.type === "sandbox" && r.status === "active")) return "sandbox";
  if (records.some((r) => r.type === "registration" && r.status === "active")) return "registered";
  return "no_record";
}

/* ------------------------------------------------------------------ *
 * Step 6 — Evidence tier
 * ------------------------------------------------------------------ */

/**
 * How well evidenced the claim is — not how bad it looks.
 *
 *   1  a regulator published it
 *   2  a member institution confirmed it, or a reviewed impersonation
 *   3  three or more confirmed independent public reports
 *   4  rising check volume only
 *   null  nothing that meets a bar
 */
export async function determineTier(entityId, records, valueHash, entitySlug) {
  if (records.some((r) => ["warning", "sanction", "foreign_alert"].includes(r.type) && r.status === "active")) {
    return 1;
  }

  const [partnerConfirmed, reviewedImpersonation] = await Promise.all([
    Contribution.countDocuments({ "identifiers.valueHash": valueHash, reviewStatus: "reviewed" }),
    Relation.countDocuments({ fromEntity: entityId, type: "impersonates", status: "active" }),
  ]);
  if (partnerConfirmed > 0 || reviewedImpersonation > 0) return 2;

  // Only reports a reviewer has confirmed count. Twenty unreviewed reports
  // from one angry sender are not three independent sources.
  const confirmedReports = await PublicReport.countDocuments({
    "identifiers.valueHash": valueHash,
    reviewStatus: "confirmed",
  });
  if (confirmedReports >= 3) return 3;

  // Signal keys are written by different producers as the entity id, the
  // entity slug, or the identifier hash. Accept any of them.
  const signalKeys = [entityId ? String(entityId) : null, entitySlug, valueHash].filter(Boolean);
  const signal = await Signal.findOne({
    key: { $in: signalKeys },
    anomalyFlag: true,
    reviewStatus: { $in: ["pending", "reviewed"] },
  });
  if (signal) return 4;

  return null;
}

/* ------------------------------------------------------------------ *
 * Step 8 — Action and permitted use
 * ------------------------------------------------------------------ */

export function determineSuggestedAction(tier, newPayee, amountGhs) {
  if (tier === 1) return "warn";
  if (tier === 2 && (newPayee || (amountGhs && amountGhs > 500))) return "warn_or_confirmation_call";
  if (tier === 2) return "warn";
  if (tier === 3) return "internal_review";
  if (tier === 4) return "watch";
  return "none";
}

/**
 * Only a regulator-grade finding may be repeated to an end customer.
 * Everything thinner is for the institution to act on internally.
 */
export function determineAllowedUse(state, tier) {
  if (tier === 1) return "customer_warning";
  if (tier === 2) return "internal_only";
  if (tier === 3 || tier === 4) return "internal_only";
  return null;
}

/* ------------------------------------------------------------------ *
 * Return promises
 * ------------------------------------------------------------------ */

/**
 * SEC Ghana cited these rates as fraud indicators in Notice
 * SEC/PN/002/07/2025. This reports what was claimed against that published
 * threshold; it does not judge the scheme.
 */
export function analyzeReturnPromise(terms) {
  if (!terms) return null;
  const lower = String(terms).toLowerCase();

  const dailyMatch = lower.match(/(\d+(?:\.\d+)?)\s*%?\s*(daily|per day|a day)/);
  if (dailyMatch) {
    const dailyRate = parseFloat(dailyMatch[1]);
    const monthlyEquiv = dailyRate * 30;
    return {
      claimed: `${dailyRate}% daily`,
      monthly_equivalent: `${monthlyEquiv.toFixed(0)}% monthly`,
      warning: `Claims ${dailyRate}% daily returns (${monthlyEquiv.toFixed(0)}% monthly) — SEC Ghana cites returns above 6% monthly as a fraud indicator`,
    };
  }

  const monthlyMatch = lower.match(/(\d+(?:\.\d+)?)\s*%?\s*(monthly|per month|a month|\/month)/);
  if (monthlyMatch) {
    const monthlyRate = parseFloat(monthlyMatch[1]);
    if (monthlyRate >= 6) {
      let severity = "fraud indicator";
      if (monthlyRate >= 70) severity = "maximum fraud indicator";
      else if (monthlyRate >= 40) severity = "very high fraud indicator";
      else if (monthlyRate >= 20) severity = "high fraud indicator";
      else if (monthlyRate >= 10) severity = "significant fraud indicator";

      return {
        claimed: `${monthlyRate}% monthly`,
        warning: `Claims ${monthlyRate}% monthly returns — SEC Ghana cites this as a ${severity} (Notice SEC/PN/002/07/2025)`,
      };
    }
  }

  if (/\b(guaranteed|fixed|assured|certain|risk.?free)\b/i.test(terms)) {
    return {
      claimed: String(terms).slice(0, 200),
      warning: "Claims guaranteed or fixed returns — no legitimate investment guarantees a return",
    };
  }

  if (/\b(complete tasks?|watch videos?|click|earn per task)\b/i.test(terms)) {
    return {
      claimed: String(terms).slice(0, 200),
      warning: "Task-based earning scheme — a common pattern in fraudulent platforms",
    };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Questions — fixed templates, never generated
 * ------------------------------------------------------------------ */

export function buildQuestionsToAsk(state, warningSignCount = 0) {
  const questions = [];

  if (state === "named_in_notice") {
    questions.push("Has anyone asked you to recruit others or pay to join?");
    questions.push("Were you contacted through WhatsApp, Telegram, or social media?");
  }

  if (state === "no_record") {
    questions.push("Can you find their SEC Ghana licence number on their website?");
    questions.push("Do they have a physical office you can visit?");
    questions.push("Have they promised specific returns or guaranteed profits?");
  }

  if (state === "sandbox") {
    questions.push("Are they asking you to invest directly, or through their regulated platform?");
    questions.push("Sandbox approval is provisional (12 months) — are they presenting it as a full licence?");
  }

  if (warningSignCount > 2) {
    questions.push("Have you already sent money? If so, contact CSA Ghana (292) and your bank immediately.");
  }

  return questions;
}

/* ------------------------------------------------------------------ *
 * The 9-step flow
 * ------------------------------------------------------------------ */

export async function evaluate(input) {
  // `skip_confirmation` is set once the caller has already asked the user which
  // name they meant. Asking again would loop them through the same question.
  const { recipient, type, amount_ghs: amountGhs, new_payee: newPayee = false, skip_confirmation: skipConfirmation = false } = input;

  const result = {
    match: false,
    entity: null,
    entity_id: null,
    entity_slug: null,
    state: "no_record",
    tier: null,
    reason_codes: [],
    sources: [],
    allowed_use: null,
    suggested_action: "none",
    warning_signs: [],
    return_check: null,
    questions_to_ask: [],
    checked_at: new Date().toISOString(),
  };

  /* --- 1. Extract ------------------------------------------------- */
  const extracted = extractIdentifiers(recipient, type);

  /* --- 2. Normalise ----------------------------------------------- */
  const normalized = normalizeIdentifier(extracted.lookupType, extracted.value);
  const valueHash = normalized ? hashIdentifier(extracted.lookupType, normalized) : "";
  result.value_hash = valueHash;
  result.normalized = normalized;

  if (!normalized) {
    result.questions_to_ask = buildQuestionsToAsk("no_record", 0);
    return result;
  }

  /* --- 3. Match --------------------------------------------------- */
  let matchedEntity = null;
  // More than one entity can claim the same identifier -- a scheme and the
  // business it is impersonating, or a duplicate import. Picking whichever row
  // Mongo returns first can silently resolve to the one with nothing on file,
  // so choose the entity carrying the most significant active record.
  const candidates = await Identifier.find({ valueHash, status: "active" }).lean();
  let matchedIdentifier = candidates[0] || null;

  if (candidates.length > 1) {
    const ranked = await rankByRecordWeight(candidates);
    matchedIdentifier = ranked.identifier;
    matchedEntity = ranked.entity;
    console.log(`[evidence] ${candidates.length} entities claim this identifier — resolved to "${matchedEntity?.name}"`);
  } else if (matchedIdentifier) {
    matchedEntity = await Entity.findById(matchedIdentifier.entityId).lean();
  }

  if (!matchedEntity && extracted.lookupType === "name") {
    // 3b. Exact, case-insensitive, on the entity's own name or aliases.
    matchedEntity = await Entity.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(normalized)}$`, "i") },
        { aliases: new RegExp(`^${escapeRegex(normalized)}$`, "i") },
      ],
    }).lean();

    if (!matchedEntity) {
      // A name on the protected list is matched exactly or not at all, so a
      // real global brand is never pulled into a Ghanaian notice by a near
      // miss ("Darazz" must not resolve to "Daraz").
      if (EXACT_MATCH_ONLY.has(normalizeName(normalized))) {
        result.questions_to_ask = buildQuestionsToAsk("no_record", 0);
        return result;
      }

      const fuzzy = await verifyName(recipient).catch(() => null);

      if (fuzzy?.decision === "exact") {
        matchedEntity = await entityFromVerifierMatch(fuzzy.match);
      } else if (fuzzy?.isSameEntity && fuzzy.match) {
        // Only ordinary corporate furniture was added ("Databank Ghana Ltd"),
        // so this is that company. Treating it as unknown would send someone
        // asking about a licensed firm down the unknown-entity path.
        matchedEntity = await entityFromVerifierMatch(fuzzy.match);
      } else if (fuzzy?.autoFlagged) {
        // A dressed-up version of a name already in a notice. No question is
        // asked: adding a word does not make it a different scheme.
        matchedEntity = await entityFromVerifierMatch(fuzzy.match);
        if (matchedEntity) {
          result.warning_signs.push(
            `Name variant of "${fuzzy.match.name}" — ${(fuzzy.spoofIndicators || []).join(", ")}`
          );
        }
      } else if (fuzzy?.needsConfirmation && !skipConfirmation) {
        // Close to something registered, but not it. Ask before judging.
        return {
          ...result,
          needs_confirmation: true,
          did_you_mean: {
            original_query: recipient,
            suggested_entity: fuzzy.match?.name || null,
            suggested_entity_status: fuzzy.match?.status || null,
            similarity_score: fuzzy.similarity ?? null,
          },
        };
      }
    }
  }

  /* --- 3c. Nothing matched ---------------------------------------- */
  if (!matchedEntity) {
    const [reportCount, signal] = await Promise.all([
      PublicReport.countDocuments({ "identifiers.valueHash": valueHash, reviewStatus: { $ne: "dismissed" } }),
      Signal.findOne({ key: valueHash, anomalyFlag: true }).lean(),
    ]);

    if (signal) {
      result.tier = 4;
      result.reason_codes.push("CHECK_SPIKE");
      result.suggested_action = "watch";
      result.allowed_use = determineAllowedUse("no_record", 4);
    }

    // Unreviewed public reports open a review and change nothing publicly.
    // A single report, or twenty from one place, is not evidence.
    result.pending_reports = reportCount;
    result.questions_to_ask = buildQuestionsToAsk("no_record", result.warning_signs.length);
    return result;
  }

  /* --- 4. Legal state --------------------------------------------- */
  result.match = true;
  result.entity = matchedEntity.name;
  result.entity_id = matchedEntity._id;
  result.entity_slug = matchedEntity.slug;

  const records = await Record.find({ entityId: matchedEntity._id, status: "active" }).populate("sourceId").lean();

  // Records waiting on four-eyes review are deliberately not used for a
  // verdict, but their existence has to be reported. Otherwise an entity we
  // demonstrably hold a notice for reads as "nothing known", and Qwench ends
  // up asking for SEC Ghana's own licence number.
  result.pending_records = await Record.countDocuments({
    entityId: matchedEntity._id,
    status: "pending",
  });

  result.state = determineState(records);
  result.sources = records
    .filter((r) => r.sourceId)
    .map((r) => ({
      publisher: r.sourceId.publisher,
      date: r.sourceId.publishedOn ? new Date(r.sourceId.publishedOn).toISOString().split("T")[0] : null,
      url: r.sourceId.url || null,
    }));

  /* --- 5. Merchant registry --------------------------------------- */
  const impersonations = await Relation.find({
    fromEntity: matchedEntity._id,
    type: "impersonates",
    status: "active",
  })
    .populate("toEntity")
    .lean();

  for (const rel of impersonations) {
    if (!rel.toEntity) continue;
    const merchant = await Merchant.findOne({ entityId: rel.toEntity._id, status: "verified" }).select("_id").lean();
    if (merchant) {
      result.warning_signs.push(`Impersonates registered business "${rel.toEntity.name}"`);
      pushCode(result, "ADVERTISED_AS_BUSINESS_NOT_REGISTERED");
    }
  }

  if (matchedIdentifier && ["momo_number", "bank_account"].includes(extracted.lookupType)) {
    const merchantOwner = await Merchant.findOne({
      officialIdentifiers: matchedIdentifier._id,
      status: "verified",
    })
      .select("_id")
      .lean();

    if (!merchantOwner) {
      const claims = await Relation.countDocuments({
        fromEntity: matchedEntity._id,
        type: "claims_affiliation",
        status: "active",
      });
      if (claims > 0) {
        pushCode(result, "ADVERTISED_AS_BUSINESS_NOT_REGISTERED");
        result.warning_signs.push("Advertises as a registered business but the number is not in the merchant registry");
      }
    }
  }

  /* --- 6. Evidence tier ------------------------------------------- */
  result.tier = await determineTier(matchedEntity._id, records, valueHash, matchedEntity.slug);

  if (result.tier === 1) {
    if (records.some((r) => r.type === "warning" || r.type === "foreign_alert")) pushCode(result, "REGULATOR_NOTICE");
    if (records.some((r) => r.type === "sanction")) pushCode(result, "SANCTIONS_LIST");
  } else if (result.tier === 2) {
    const partnerConfirmed = await Contribution.countDocuments({
      "identifiers.valueHash": valueHash,
      reviewStatus: "reviewed",
    });
    if (partnerConfirmed > 0) pushCode(result, "PARTNER_CONFIRMED");

    const impersonation = await Relation.countDocuments({
      fromEntity: matchedEntity._id,
      type: "impersonates",
      status: "active",
    });
    if (impersonation > 0) pushCode(result, "ADVERTISED_AS_BUSINESS_NOT_REGISTERED");
  } else if (result.tier === 3) {
    pushCode(result, "CORROBORATED_REPORTS");
  } else if (result.tier === 4) {
    pushCode(result, "CHECK_SPIKE");
  }

  /* --- 7. Context -------------------------------------------------- */
  const foreign = records.filter((r) => r.type === "foreign_alert");
  for (const r of foreign) {
    result.warning_signs.push(`Found abroad: ${r.jurisdiction} — ${r.sourceId?.publisher || "unknown publisher"}`);
  }

  // Return promises come from what members contributed about this identifier.
  const contributions = await Contribution.find({ "identifiers.valueHash": valueHash }).select("terms").lean();
  for (const contrib of contributions) {
    const returnCheck = analyzeReturnPromise(contrib.terms);
    if (returnCheck) {
      result.return_check = returnCheck;
      result.warning_signs.push(returnCheck.warning);
      break;
    }
  }

  const renamedFrom = await Relation.find({ toEntity: matchedEntity._id, type: "renamed_from", status: "active" })
    .populate("fromEntity")
    .lean();
  for (const r of renamedFrom) {
    if (r.fromEntity) result.warning_signs.push(`Previously known as "${r.fromEntity.name}"`);
  }

  const sameOperator = await Relation.countDocuments({
    $or: [{ fromEntity: matchedEntity._id }, { toEntity: matchedEntity._id }],
    type: "same_operator",
    status: "active",
  });
  if (sameOperator > 0) result.warning_signs.push("Linked to other flagged entities under the same operator");

  /* --- 8. Build the reply (templates only) ------------------------- */
  result.suggested_action = determineSuggestedAction(result.tier, newPayee, amountGhs);
  result.allowed_use = determineAllowedUse(result.state, result.tier);
  // Questions that assume we know nothing are wrong when a record is simply
  // awaiting sign-off, so they are withheld in that case.
  result.questions_to_ask =
    result.state === "no_record" && result.pending_records > 0
      ? []
      : buildQuestionsToAsk(result.state, result.warning_signs.length);

  /* --- 9. Logging is the route's job (logCheck) -------------------- */
  return result;
}

/* ------------------------------------------------------------------ */

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

/** The name verifier works over the curated register; map its hit to an Entity. */
async function entityFromVerifierMatch(match) {
  if (!match?.name) return null;
  const slug = slugifyEntity(match.name);
  return (
    (await Entity.findOne({ slug }).lean()) ||
    (await Entity.findOne({ name: new RegExp(`^${escapeRegex(match.name)}$`, "i") }).lean())
  );
}

function pushCode(result, code) {
  if (!result.reason_codes.includes(code)) result.reason_codes.push(code);
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default { evaluate };
