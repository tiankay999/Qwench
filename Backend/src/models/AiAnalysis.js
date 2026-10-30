import mongoose from "mongoose";

/**
 * Cache + audit log for AI risk assessments.
 *
 * Doubles as the 24h cache (looked up by querySlug) and the debug log: every
 * call stores the exact input we sent and the output we got back.
 */
const aiAnalysisSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    querySlug: { type: String, required: true, index: true },

    provider: { type: String, default: "" },
    model: { type: String, default: "" },

    // Exactly what we sent, for debugging a bad verdict after the fact.
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    // The parsed assessment the model returned.
    output: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Raw text, kept when parsing failed so the failure can be inspected.
    rawResponse: { type: String, default: "" },

    ok: { type: Boolean, default: true },
    error: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
    // Set when our own rules had to correct the model (e.g. it under-scored a
    // blacklisted entity).
    corrections: { type: [String], default: [] },

    expiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("AiAnalysis", aiAnalysisSchema);
