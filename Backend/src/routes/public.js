// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Risk colors
// - Recommendations or advice text
// - Community boost scores
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
// Sandbox, licensed, and authority results are LEGAL STATES, never warnings.

import { Router } from "express";

import { checkRules } from "../middleware/validate.js";
import { evaluate } from "../services/evidenceEngine.js";
import { logCheck } from "../utils/logCheck.js";

const router = Router();

const VALID_CHANNELS = ["whatsapp", "telegram", "web", "api"];

/**
 * POST /v1/public/check
 *
 * The main endpoint: WhatsApp bot, Telegram bot, and the web paste box.
 * Every decision here comes from the evidence engine's rules, not a model.
 */
router.post("/check", checkRules, async (req, res, next) => {
  const { recipient, type, amount_ghs: amountGhs, new_payee: newPayee = false } = req.body;
  const channel = VALID_CHANNELS.includes(req.headers["x-channel"]) ? req.headers["x-channel"] : "web";

  try {
    const result = await evaluate({ recipient, type, amount_ghs: amountGhs, new_payee: newPayee, audience: "public" });

    // Never awaited, and never throws: a log write must not hold up the reply.
    logCheck({
      channel,
      inputType: inputTypeFor(type),
      identifierHashes: [result.value_hash],
      matchedEntityIds: result.entity_id ? [result.entity_id] : [],
      state: result.state,
      tier: result.tier,
      flags: result.reason_codes,
      outcome: "none",
      isDemo: result.is_demo,
    });

    return res.json({
      match: result.match,
      entity: result.entity,
      state: result.state,
      tier: result.tier,
      reason_codes: result.reason_codes,
      ...(result.did_you_mean ? { did_you_mean: result.did_you_mean } : {}),
      report: result.report,
      is_demo: result.is_demo,
      checked_at: result.checked_at,
    });
  } catch (err) {
    next(err);
  }
});

/** Map a request type onto the Check model's inputType enum. */
function inputTypeFor(type) {
  switch (type) {
    case "momo_number":
    case "bank_account":
      return "number";
    case "domain":
      return "domain";
    case "url":
    case "telegram_link":
      return "url";
    case "wallet":
      return "wallet";
    default:
      return "name";
  }
}

export default router;
