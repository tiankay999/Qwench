import mongoose from "mongoose";

/**
 * When a website's domain was registered, cached so a registry is asked once.
 *
 * Held against a keyed hash, so this can't become a list of what people checked.
 * Nothing else from a registry record is kept: those records can hold people's names
 * and contact details. registeredOn is null when no date was available.
 */
const domainAgeSchema = new mongoose.Schema({
  valueHash: { type: String, required: true, unique: true },
  registeredOn: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});

domainAgeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("DomainAge", domainAgeSchema);
