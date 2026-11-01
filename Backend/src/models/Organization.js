import mongoose from "mongoose";

export const ORG_TYPES = ["bank", "momo", "psp", "vasp", "merchant", "regulator", "qwench"];
export const ORG_STATUSES = ["active", "suspended", "demo"];

/** The institutions that use Qwench, plus Qwench itself. */
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ORG_TYPES },
    status: { type: String, enum: ORG_STATUSES, default: "active" },
    // At or above this amount, a tier 1 new payee suggests a confirmation call
    confirmationCallLimitGhs: { type: Number, min: 0, default: null },
    // Whether this organisation warns customers on partner-confirmed data
    warnsOnPartnerData: { type: Boolean, default: false },
    // Demo organisations are labelled so their data is never mistaken for real
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A demo organisation must be visibly demo in both fields, so a dashboard
// filtering on either one cannot show demo data as real.
organizationSchema.pre("validate", function syncDemoFlags() {
  if (this.status === "demo") this.isDemo = true;
  if (this.isDemo && this.status === "active") this.status = "demo";
});

organizationSchema.index({ type: 1, status: 1 });
organizationSchema.index({ name: 1 }, { unique: true });

export default mongoose.model("Organization", organizationSchema);
