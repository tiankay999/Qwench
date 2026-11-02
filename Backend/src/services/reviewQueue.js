import { CollectedNotice, Contribution, Entity, PublicReport, Record, Relation, Signal, recordAudit } from "../models/index.js";

/**
 * The review queue: where a second person approves what goes live.
 *
 * Nobody approves their own capture, and no organisation approves its own
 * contribution. Contributors are never named here. Every decision is audited.
 */

const PAGE = 100;

const samePerson = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const demoFilter = (org) => (org.isDemo ? { isDemo: true } : { isDemo: { $ne: true } });
const isId = (id) => /^[a-f0-9]{24}$/i.test(id);

function sourceSummary(source) {
  if (!source) return null;
  return { publisher: source.publisher, title: source.title, date: source.publishedOn, url: source.url || null };
}

const KINDS = {
  record: {
    model: Record,
    label: "Record",
    pending: { status: "pending" },
    isPending: (doc) => doc.status === "pending",
    isOwn: (doc, user) => samePerson(doc.capturedBy, user.email),
    statusOf: (doc) => doc.status,
    approve(doc, user, { quote } = {}) {
      // A reviewer can add wording from the original when it couldn't be read automatically.
      if (!(doc.quote || "").trim() && (quote || "").trim()) doc.quote = quote.trim();
      if (!(doc.quote || "").trim()) return { error: { status: 400, code: "needs_quote", message: "This record has no quote from its source, so it can't go live" } };
      const ended = doc.endsOn && new Date(doc.endsOn) <= new Date();
      doc.set({ status: ended ? "expired" : "active", reviewedBy: user.email, reviewedAt: new Date() });
      return {};
    },
    reject(doc, user) {
      doc.set({ status: "withdrawn", reviewedBy: user.email, reviewedAt: new Date() });
      return {};
    },
    async list(filter) {
      const docs = await Record.find(filter).populate("sourceId").populate("entityId", "name aliases").sort({ createdAt: 1 }).limit(PAGE).lean();
      return docs.map((d) => ({
        id: String(d._id),
        kind: "record",
        title: d.entityId?.name || null,
        aliases: d.entityId?.aliases || [],
        record_type: d.type,
        jurisdiction: d.jurisdiction,
        license_type: d.licenseType || null,
        quote: d.quote || null,
        source: sourceSummary(d.sourceId),
        effective_on: d.effectiveOn || null,
        ends_on: d.endsOn || null,
        captured_by: d.capturedBy,
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },

  relation: {
    model: Relation,
    label: "Relation",
    pending: { status: "pending" },
    isPending: (doc) => doc.status === "pending",
    isOwn: (doc, user) => samePerson(doc.capturedBy, user.email),
    statusOf: (doc) => doc.status,
    approve(doc, user) {
      doc.set({ status: "active", reviewedBy: user.email, reviewedAt: new Date() });
      return {};
    },
    reject(doc, user) {
      doc.set({ status: "resolved", reviewedBy: user.email, reviewedAt: new Date() });
      return {};
    },
    async list(filter) {
      const docs = await Relation.find(filter).populate("fromEntity", "name").populate("toEntity", "name").populate("sourceId").sort({ createdAt: 1 }).limit(PAGE).lean();
      return docs.map((d) => ({
        id: String(d._id),
        kind: "relation",
        title: `${d.fromEntity?.name || "?"} ${d.type} ${d.toEntity?.name || "?"}`,
        relation_type: d.type,
        from_entity: d.fromEntity?.name || null,
        to_entity: d.toEntity?.name || null,
        source: sourceSummary(d.sourceId),
        captured_by: d.capturedBy || null,
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },

  public_report: {
    model: PublicReport,
    label: "PublicReport",
    pending: { reviewStatus: { $in: ["pending", "under_review"] } },
    isPending: (doc) => ["pending", "under_review"].includes(doc.reviewStatus),
    isOwn: () => false,
    statusOf: (doc) => doc.reviewStatus,
    approve(doc) {
      doc.reviewStatus = "confirmed";
      return {};
    },
    reject(doc) {
      doc.reviewStatus = "dismissed";
      return {};
    },
    async list(filter) {
      const docs = await PublicReport.find(filter).sort({ volumeFlag: -1, createdAt: 1 }).limit(PAGE).lean();
      return docs.map((d) => ({
        id: String(d._id),
        kind: "public_report",
        title: d.schemeName,
        channel: d.source || null,
        evidence: d.evidenceRefs || [],
        volume_flag: Boolean(d.volumeFlag),
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },

  contribution: {
    model: Contribution,
    label: "Contribution",
    pending: { reviewStatus: "pending" },
    isPending: (doc) => doc.reviewStatus === "pending",
    isOwn: (doc, user) => String(doc.orgId) === String(user.orgId),
    statusOf: (doc) => doc.reviewStatus,
    approve(doc) {
      doc.reviewStatus = "reviewed";
      return {};
    },
    reject(doc) {
      doc.reviewStatus = "rejected";
      return {};
    },
    async list(filter) {
      const docs = await Contribution.find(filter).sort({ createdAt: 1 }).limit(PAGE).lean();
      return docs.map((d) => ({
        id: String(d._id),
        kind: "contribution",
        title: d.schemeName,
        terms: d.terms || null,
        region: d.region || null,
        loss_band: d.lossBand || null,
        identifier_types: (d.identifiers || []).map((i) => i.type),
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },

  // A regulator's notice the collector couldn't read fully, for a person to look at.
  notice: {
    model: CollectedNotice,
    label: "CollectedNotice",
    pending: { status: "needs_person" },
    isPending: (doc) => doc.status === "needs_person",
    isOwn: () => false,
    statusOf: (doc) => doc.status,
    approve(doc) {
      doc.status = "handled";
      return {};
    },
    reject(doc) {
      doc.status = "not_relevant";
      return {};
    },
    async list(filter) {
      const docs = await CollectedNotice.find(filter).sort({ publishedOn: -1 }).limit(PAGE).lean();
      return docs.map((d) => ({
        id: String(d._id),
        kind: "notice",
        title: d.title,
        url: d.url,
        document_url: d.documentUrl || null,
        published_on: d.publishedOn,
        note: d.note || null,
        websites: d.websitesForPerson || [],
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },

  signal: {
    model: Signal,
    label: "Signal",
    pending: { reviewStatus: "pending", anomalyFlag: true },
    isPending: (doc) => doc.reviewStatus === "pending",
    isOwn: () => false,
    statusOf: (doc) => doc.reviewStatus,
    approve(doc) {
      doc.reviewStatus = "reviewed";
      return {};
    },
    reject(doc) {
      doc.reviewStatus = "dismissed";
      return {};
    },
    async list(filter) {
      const docs = await Signal.find(filter).sort({ weekStart: 1 }).limit(PAGE).lean();
      const slugs = await Entity.find({ slug: { $in: docs.map((d) => d.key) } }).select("slug name").lean();
      const nameOf = new Map(slugs.map((e) => [e.slug, e.name]));
      return docs.map((d) => ({
        id: String(d._id),
        kind: "signal",
        title: nameOf.get(d.key) || "A checked identifier",
        checks_this_week: d.checksThisWeek,
        checks_last_week: d.checksLastWeek,
        distinct_sources: d.distinctSources,
        week_start: d.weekStart,
        created_at: d.createdAt,
        raw: d,
      }));
    },
  },
};

export async function listQueue(user, org) {
  const groups = await Promise.all(
    Object.values(KINDS).map(async (kind) => {
      const items = await kind.list({ ...kind.pending, ...demoFilter(org) });
      // `raw` is only for working out can_review. It holds the contributor, so it stays here.
      return items.map(({ raw, ...item }) => ({ ...item, can_review: !kind.isOwn(raw, user) }));
    })
  );
  return groups.flat();
}

/** Returns { error } or { status }. */
export async function decide({ kindName, id, decision, user, org, quote }) {
  const kind = KINDS[kindName];
  const notFound = { error: { status: 404, code: "not_found", message: "That item isn't in the queue" } };
  if (!isId(id)) return notFound;

  const doc = await kind.model.findOne({ _id: id, ...demoFilter(org) });
  if (!doc) return notFound;

  if (!kind.isPending(doc)) return { error: { status: 400, code: "already_reviewed", message: "This item has already been reviewed" } };
  if (kind.isOwn(doc, user)) return { error: { status: 403, code: "self_approval", message: "A different person has to review this" } };

  const before = kind.statusOf(doc);
  const outcome = decision === "approve" ? kind.approve(doc, user, { quote }) : kind.reject(doc, user);
  if (outcome.error) return outcome;

  try {
    await doc.save();
  } catch {
    // The model's own rules refused it, such as an impersonation with no capturer.
    return { error: { status: 400, code: "review_refused", message: "This item doesn't meet the rules to go live" } };
  }

  await recordAudit({
    actor: user.email,
    action: `${kindName}.${decision}`,
    target: `${kind.label}:${doc._id}`,
    before: { status: before },
    after: { status: kind.statusOf(doc), ...(quote ? { quoteAddedByReviewer: true } : {}) },
  });

  return { status: kind.statusOf(doc) };
}
