import { body, query, validationResult } from "express-validator";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";
import { sendError } from "./errorHandler.js";

/**
 * Input validation for every endpoint.
 *
 * Every rule set ends with `stripUnknown`, which deletes anything not
 * explicitly allowed. That is what stops a caller smuggling an extra field
 * into a Mongoose write, and what keeps raw message text out of the system
 * when a bot sends more than it should.
 */

/** Collect express-validator errors into the /v1 error shape. */
export function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const first = result.array()[0];
  return sendError(res, 400, "invalid_input", `Invalid input: ${first.msg}`);
}

/** Drop any field the endpoint did not declare. */
export function stripUnknown(allowed) {
  return function strip(req, _res, next) {
    if (req.body && typeof req.body === "object") {
      for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) delete req.body[key];
      }
    }
    next();
  };
}

/* ------------------------------------------------------------------ *
 * Rule sets
 * ------------------------------------------------------------------ */

// The contract's public-check types. "url" is accepted and treated as a domain.
export const CHECK_TYPES = [...IDENTIFIER_TYPES, "url"];

export const checkRules = [
  stripUnknown(["recipient", "type", "amount_ghs", "new_payee"]),
  body("recipient").exists({ checkFalsy: true }).withMessage("recipient is required").bail().isString().isLength({ max: 500 }),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("type is required")
    .bail()
    .isIn(CHECK_TYPES)
    .withMessage(`type must be one of: ${CHECK_TYPES.join(", ")}`),
  body("amount_ghs").optional().isFloat({ min: 0, max: 100_000_000 }).withMessage("amount_ghs must be a positive number"),
  body("new_payee").optional().isBoolean().withMessage("new_payee must be a boolean"),
  handleValidation,
];

const MAX_MESSAGE = 5000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PUBLIC_CHANNELS = ["web", "whatsapp", "telegram"];

export const publicCheckRules = [
  stripUnknown(["text", "urls", "image_base64", "mime_type", "channel", "sender_ref", "recipient", "type"]),
  body("text").optional({ values: "null" }).isString().withMessage("text must be a string").bail().isLength({ max: MAX_MESSAGE }).withMessage(`text can be up to ${MAX_MESSAGE} characters`),
  body("urls").optional({ values: "null" }).isArray({ max: 3 }).withMessage("urls must be a list of up to 3 links"),
  body("urls.*").isString().withMessage("urls must be a list of links").bail().isLength({ max: 2000 }).withMessage("a link is too long"),
  body("image_base64").optional({ values: "null" }).isString().withMessage("image_base64 must be a string"),
  body("mime_type").optional({ values: "null" }).isIn(IMAGE_TYPES).withMessage(`mime_type must be one of: ${IMAGE_TYPES.join(", ")}`),
  body("channel").optional().isIn(PUBLIC_CHANNELS).withMessage(`channel must be one of: ${PUBLIC_CHANNELS.join(", ")}`),
  body("sender_ref").optional({ values: "null" }).isString().isLength({ max: 200 }).withMessage("sender_ref is too long"),
  body("recipient").optional({ values: "null" }).isString().isLength({ max: 500 }).withMessage("recipient is too long"),
  body("type").optional({ values: "null" }).isIn(CHECK_TYPES).withMessage(`type must be one of: ${CHECK_TYPES.join(", ")}`),
  body().custom((value) => {
    const hasText = typeof value?.text === "string" && value.text.trim() !== "";
    const hasUrls = Array.isArray(value?.urls) && value.urls.length > 0;
    if (value?.recipient && !value?.type) throw new Error("type is required with recipient");
    if (!hasText && !hasUrls && !value?.image_base64 && !value?.recipient) throw new Error("send text, urls or an image");
    return true;
  }),
  handleValidation,
];

export const publicReportRules = [
  stripUnknown(["scheme_name", "identifiers", "evidence_urls", "channel", "sender_ref"]),
  body("scheme_name").exists({ checkFalsy: true }).withMessage("scheme_name is required").bail().isString().isLength({ max: 200 }).withMessage("scheme_name is too long"),
  body("identifiers").optional().isArray({ max: 10 }).withMessage("identifiers must be a list of up to 10"),
  body("identifiers.*.type").isIn(IDENTIFIER_TYPES).withMessage("unknown identifier type"),
  body("identifiers.*.value").isString().isLength({ min: 1, max: 500 }).withMessage("an identifier value is missing"),
  body("evidence_urls").optional().isArray({ max: 5 }).withMessage("evidence_urls must be a list of up to 5 links"),
  body("evidence_urls.*").isURL({ protocols: ["http", "https"], require_protocol: true }).withMessage("evidence_urls must be links"),
  body("channel").optional().isIn(PUBLIC_CHANNELS).withMessage(`channel must be one of: ${PUBLIC_CHANNELS.join(", ")}`),
  body("sender_ref").optional({ values: "null" }).isString().isLength({ max: 200 }),
  handleValidation,
];

export const appealRules = [
  stripUnknown(["type", "value", "contact", "reason"]),
  body("type").isIn(IDENTIFIER_TYPES).withMessage(`type must be one of: ${IDENTIFIER_TYPES.join(", ")}`),
  body("value").exists({ checkFalsy: true }).withMessage("value is required").bail().isString().isLength({ max: 500 }),
  body("contact").exists({ checkFalsy: true }).withMessage("contact is required").bail().isString().isLength({ max: 200 }),
  body("reason").exists({ checkFalsy: true }).withMessage("reason is required").bail().isString().isLength({ max: 2000 }),
  handleValidation,
];

export const contributionRules = [
  stripUnknown(["schemeName", "identifiers", "terms", "region", "lossBand", "evidenceRefs"]),
  body("schemeName").exists({ checkFalsy: true }).withMessage("schemeName is required").bail().isString().isLength({ max: 300 }),
  body("identifiers").optional().isArray({ max: 50 }).withMessage("identifiers must be an array"),
  body("identifiers.*.type").optional().isIn(IDENTIFIER_TYPES).withMessage("unknown identifier type"),
  body("identifiers.*.value").optional().isString().isLength({ max: 500 }),
  body("terms").optional().isString().isLength({ max: 500 }),
  body("region").optional().isString().isLength({ max: 120 }),
  body("lossBand").optional().isString().isLength({ max: 60 }),
  body("evidenceRefs").optional().isArray({ max: 50 }),
  handleValidation,
];

export const feedRules = [
  query("since").exists({ checkFalsy: true }).withMessage("since parameter required").bail().isISO8601().withMessage("since must be an ISO 8601 date"),
  query("format").optional().isIn(["json", "csv"]).withMessage("format must be json or csv"),
  query("limit").optional().isInt({ min: 1, max: 1000 }).withMessage("limit must be between 1 and 1000"),
  handleValidation,
];

export const merchantNumberRules = [
  stripUnknown(["number", "type"]),
  body("number").exists({ checkFalsy: true }).withMessage("number and type required").bail().isString().isLength({ max: 100 }),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("number and type required")
    .bail()
    .isIn(["momo_number", "bank_account"])
    .withMessage("type must be momo_number or bank_account"),
  handleValidation,
];
