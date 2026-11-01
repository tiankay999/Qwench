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
    const result = await evaluate({ recipient, type, channel, amount_ghs: amountGhs, new_payee: newPayee });

    // The sender is hashed inside logCheck with a daily-rotating salt and
    // cleared after 24h; the raw value never reaches the database.
    await logCheck({
      channel,
      inputType: inputTypeFor(type),
      identifierHashes: [result.value_hash],
      matchedEntityIds: result.entity_id ? [result.entity_id] : [],
      state: result.state,
      tier: result.tier,
      flags: result.reason_codes,
      sender: req.headers["x-sender"],
      outcome: result.suggested_action,
    });

    // A close-but-not-exact name: ask which was meant rather than judging.
    if (result.needs_confirmation) {
      return res.json({
        match: false,
        did_you_mean: result.did_you_mean,
        checked_at: result.checked_at,
      });
    }

    if (!result.match) {
      return res.json({
        match: false,
        state: result.state,
        tier: result.tier,
        reason_codes: result.reason_codes,
        // Absence of a record is not a clean bill of health, and saying so is
        // the single most important line in a no-match reply.
        note: "No record found. This does not mean it is safe or unsafe.",
        questions_to_ask: result.questions_to_ask,
        checked_at: result.checked_at,
      });
    }

    return res.json({
      match: true,
      entity: result.entity,
      state: result.state,
      tier: result.tier,
      reason_codes: result.reason_codes,
      sources: result.sources,
      warning_signs: result.warning_signs,
      return_check: result.return_check,
      questions_to_ask: result.questions_to_ask,
      allowed_use: result.allowed_use,
      suggested_action: result.suggested_action,
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
