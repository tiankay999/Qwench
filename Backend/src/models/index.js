/**
 * Every Mongoose model in one place.
 *
 * Importing this file registers all models, which matters for the cross-model
 * validation hooks (Relation checks Entity and Record at write time).
 */

/* --- Provenance and entity graph --------------------------------- */
export { default as Source, SOURCE_TYPES } from "./Source.js";
export { default as Entity, ENTITY_KINDS } from "./Entity.js";
export { default as Identifier, IDENTIFIER_STATUSES } from "./Identifier.js";
export { default as Record, RECORD_TYPES, RECORD_STATUSES } from "./Record.js";
export { default as Relation, RELATION_TYPES, RELATION_STATUSES } from "./Relation.js";

/* --- Institutions and access -------------------------------------- */
export { default as Organization, ORG_TYPES, ORG_STATUSES } from "./Organization.js";
export { default as User, USER_ROLES } from "./User.js";
export { default as ApiKey, API_SCOPES, generateApiKey, hashApiKey } from "./ApiKey.js";

/* --- Activity and intelligence ------------------------------------ */
export {
  default as Check,
  CHECK_CHANNELS,
  CHECK_INPUT_TYPES,
  CHECK_STATES,
  CHECK_OUTCOMES,
} from "./Check.js";
export { default as Contribution, CONTRIBUTION_REVIEW_STATUSES } from "./Contribution.js";
export { default as PublicReport, PUBLIC_REPORT_SOURCES, PUBLIC_REPORT_STATUSES } from "./PublicReport.js";
export { default as Signal, SIGNAL_REVIEW_STATUSES } from "./Signal.js";
export { default as Case, CASE_TYPES, CASE_STATUSES, CASE_TRIGGERS } from "./Case.js";

/* --- Merchant registry and brand protection ----------------------- */
export { default as Merchant, VERIFICATION_METHODS, MERCHANT_STATUSES } from "./Merchant.js";
export { default as BrandWatch, BRAND_WATCH_STATUSES } from "./BrandWatch.js";
export { default as BrandFinding, FINDING_REVIEW_STATUSES, TAKEDOWN_STATUSES } from "./BrandFinding.js";

/* --- Governance ---------------------------------------------------- */
export { default as Appeal, APPEAL_STATUSES } from "./Appeal.js";
export { default as AuditLog, recordAudit } from "./AuditLog.js";

/* ------------------------------------------------------------------ *
 * Legacy models.
 *
 * Still backing the live risk engine until the cutover. They are exported
 * here so nothing imports them by a path that later disappears.
 * ------------------------------------------------------------------ */
export { default as Investment, STATUSES as INVESTMENT_STATUSES } from "./Investment.js";
export { default as Report } from "./Report.js";
export { default as LegacyCheck } from "./LegacyCheck.js";
export { default as AiAnalysis } from "./AiAnalysis.js";
