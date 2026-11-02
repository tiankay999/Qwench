import mongoose from "mongoose";

export const RELATION_TYPES = ["impersonates", "claims_affiliation", "renamed_from", "same_operator"];
export const RELATION_STATUSES = ["pending", "active", "disputed", "resolved"];

/**
 * A link between two entities: who is impersonating whom, who claims to be
 * affiliated with whom, what renamed to what.
 */
const relationSchema = new mongoose.Schema(
  {
    fromEntity: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    toEntity: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    type: { type: String, required: true, enum: RELATION_TYPES },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Source" },
    status: { type: String, enum: RELATION_STATUSES, default: "pending" },
    capturedBy: { type: String, trim: true },
    reviewedBy: { type: String, trim: true },
    reviewedAt: { type: Date },
    notes: { type: String, trim: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ACCUSATORY = new Set(["impersonates", "claims_affiliation"]);

/**
 * The direction rule, enforced in code.
 *
 * A licensed entity or an authority may only ever appear as `toEntity` on an
 * accusatory relation -- the party being impersonated. Recording a real,
 * licensed company as the impersonator would publish an accusation against a
 * legitimate business, which is the most damaging mistake this system can
 * make, so it is rejected at write time rather than left to reviewers.
 */
relationSchema.pre("validate", async function enforceDirection() {
  if (String(this.fromEntity) === String(this.toEntity)) {
    throw (new Error("A relation cannot point an entity at itself."));
  }

  if (!ACCUSATORY.has(this.type)) return;

  // An active impersonation is shown to the public, so it takes two people.
  const captured = (this.capturedBy || "").trim().toLowerCase();
  const reviewed = (this.reviewedBy || "").trim().toLowerCase();
  if (this.status === "active" && (!captured || !reviewed)) {
    throw new Error("This relation cannot go active before review. It needs capturedBy and reviewedBy.");
  }
  if (captured && reviewed && captured === reviewed) {
    throw new Error("The reviewer must be a different person from the capturer.");
  }
  if (reviewed && !this.reviewedAt) this.reviewedAt = new Date();

  // A lookup failure here must reject the write, never silently allow it:
  // failing open would publish exactly the accusation this rule prevents.
  const Entity = mongoose.model("Entity");
  const Record = mongoose.model("Record");

  const from = await Entity.findById(this.fromEntity).select("name kind").lean();
  if (!from) return;
  {

    if (from.kind === "authority") {
      throw (
        new Error(
          `"${from.name}" is an authority and cannot be recorded as impersonating anyone. Reverse the direction: the authority is the party being impersonated.`
        )
      );
    }

    const legitimate = await Record.findOne({
      entityId: this.fromEntity,
      type: { $in: ["licence", "sandbox", "registration"] },
      status: "active",
    })
      .select("_id type")
      .lean();

    if (legitimate) {
      throw (
        new Error(
          `"${from.name}" holds an active ${legitimate.type} record, so it cannot be the impersonator. A real company appears only as the impersonated party (toEntity).`
        )
      );
    }
  }
});

/** Query updates skip the rules above, so these fields only change through save(). */
function refuseUnreviewedUpdate() {
  const update = this.getUpdate();
  const fields = Array.isArray(update) ? null : { ...update, ...update?.$set, ...update?.$setOnInsert };
  if (!fields || fields.status === "active" || "reviewedBy" in fields || "capturedBy" in fields) {
    throw new Error("Change a relation's status or review fields with document.save(), so the review rules run.");
  }
}

for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
  relationSchema.pre(op, refuseUnreviewedUpdate);
}

relationSchema.index({ fromEntity: 1 });
relationSchema.index({ toEntity: 1 });
relationSchema.index({ fromEntity: 1, toEntity: 1, type: 1 }, { unique: true });

export default mongoose.model("Relation", relationSchema);
