import mongoose from "mongoose";

/**
 * Append-only record of every change to a tier, record or case.
 *
 * Deliberately has no `timestamps: true`: it carries its own immutable
 * `timestamp`, and an updatedAt on an append-only log would imply entries can
 * be edited. The pre-hooks below reject edits and deletes outright — an audit
 * trail that can be rewritten is not an audit trail.
 */
const auditLogSchema = new mongoose.Schema({
  // user id, or "system"
  actor: { type: String, required: true, trim: true },
  // "record.create", "case.refer", "tier.change"
  action: { type: String, required: true, trim: true },
  // what was changed: model + id
  target: { type: String, required: true, trim: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

function refuseMutation() {
  throw new Error("AuditLog entries are append-only and cannot be modified or removed.");
}

auditLogSchema.pre("save", function blockEdits() {
  if (!this.isNew) refuseMutation();
});

for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  auditLogSchema.pre(op, refuseMutation);
}

auditLogSchema.index({ target: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

/** Convenience writer; never throws into the caller's path. */
export async function recordAudit({ actor, action, target, before, after }) {
  try {
    await AuditLog.create({ actor, action, target, before, after });
  } catch (err) {
    console.error(`[audit] failed to write ${action} on ${target}: ${err.message}`);
  }
}

export default AuditLog;
