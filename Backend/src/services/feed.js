import { Entity, Identifier, Record } from "../models/index.js";
import { sendError } from "../middleware/errorHandler.js";

/**
 * The record feed for institutions: new, changed and removed reviewed records,
 * with the identifiers published in them.
 *
 * Partner numbers are left out entirely, because a phone number is easy to guess
 * from a hash. Members check those through POST /v1/check.
 */

const MAX_PAGE = 1000;
const STATE_FOR = { warning: "named_in_notice", sanction: "named_in_notice", licence: "licensed", sandbox: "sandbox", registration: "registered" };

const encodeCursor = (record) => Buffer.from(JSON.stringify({ u: record.updatedAt.getTime(), i: String(record._id) })).toString("base64url");

function decodeCursor(cursor) {
  try {
    const { u, i } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Number.isFinite(u) || !/^[a-f0-9]{24}$/i.test(i)) return null;
    return { updatedAt: new Date(u), id: i };
  } catch {
    return null;
  }
}

function changeOf(record, since, now) {
  const ended = record.status !== "active" || (record.endsOn && new Date(record.endsOn) <= now);
  if (ended) return "removed";
  if (!since) return "added";
  return new Date(record.reviewedAt || record.createdAt) > since ? "added" : "updated";
}

function row(record, entity, identifiers, since, now) {
  const source = record.sourceId;
  const change = changeOf(record, since, now);
  const isForeign = record.type === "foreign_alert" || (record.type === "warning" && (record.jurisdiction || "GH") !== "GH");

  return {
    change,
    entity: entity.name,
    entity_slug: entity.slug,
    state: isForeign ? "foreign_context" : STATE_FOR[record.type],
    record_type: record.type,
    license_type: record.licenseType || null,
    jurisdiction: record.jurisdiction,
    source: { publisher: source.publisher, title: source.title, date: source.publishedOn, url: source.url || null },
    // A removed record says only that it has gone.
    ...(change === "removed" ? {} : { quote: record.quote }),
    identifiers: change === "removed" ? [] : identifiers,
    effective_on: record.effectiveOn || null,
    ends_on: record.endsOn || null,
    updated_at: record.updatedAt,
    is_demo: Boolean(record.isDemo),
  };
}

export async function buildFeed({ since, cursor, limit, org }) {
  const pageSize = Math.min(Number(limit) || MAX_PAGE, MAX_PAGE);
  const now = new Date();
  const sinceDate = since ? new Date(since) : null;

  const filter = {
    status: { $in: ["active", "expired", "withdrawn"] },
    // Demo records go only to demo organisations.
    ...(org?.isDemo ? {} : { isDemo: { $ne: true } }),
    ...(sinceDate ? { updatedAt: { $gt: sinceDate } } : {}),
  };

  if (cursor) {
    const position = decodeCursor(cursor);
    if (!position) return { badCursor: true };
    filter.$or = [{ updatedAt: { $gt: position.updatedAt } }, { updatedAt: position.updatedAt, _id: { $gt: position.id } }];
    if (sinceDate) {
      filter.$and = [{ updatedAt: { $gt: sinceDate } }];
      delete filter.updatedAt;
    }
  }

  const records = await Record.find(filter).populate("sourceId").sort({ updatedAt: 1, _id: 1 }).limit(pageSize + 1).lean();
  const page = records.slice(0, pageSize).filter((r) => r.sourceId);

  const entityIds = page.map((r) => r.entityId);
  const [entities, identifiers] = await Promise.all([
    Entity.find({ _id: { $in: entityIds } }).select("name slug").lean(),
    // Only what a notice published. Partner and merchant identifiers never go out.
    Identifier.find({ entityId: { $in: entityIds }, origin: "notice", type: { $ne: "name" }, status: "active" }).select("entityId type normalized").lean(),
  ]);
  const entityById = new Map(entities.map((e) => [String(e._id), e]));

  const rows = page
    .filter((r) => entityById.has(String(r.entityId)))
    .map((r) =>
      row(
        r,
        entityById.get(String(r.entityId)),
        identifiers.filter((i) => String(i.entityId) === String(r.entityId) && i.normalized).map((i) => ({ type: i.type, value: i.normalized })),
        sinceDate,
        now
      )
    );

  return { count: rows.length, records: rows, next_cursor: records.length > pageSize ? encodeCursor(page[page.length - 1]) : null };
}

const CSV_COLUMNS = ["change", "entity", "entity_slug", "state", "record_type", "license_type", "jurisdiction", "source_publisher", "source_title", "source_date", "source_url", "quote", "identifiers", "effective_on", "ends_on", "updated_at", "is_demo"];

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // A leading =, +, - or @ would run as a formula when an analyst opens the file.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function feedToCsv(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.change, r.entity, r.entity_slug, r.state, r.record_type, r.license_type, r.jurisdiction,
        r.source.publisher, r.source.title, r.source.date, r.source.url, r.quote,
        r.identifiers.map((i) => `${i.type}:${i.value}`).join(" "),
        r.effective_on, r.ends_on, r.updated_at, r.is_demo,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}

/** Shared by GET /v1/feed and the console's feed. */
export async function sendFeed(req, res, org) {
  const { since, cursor, limit, format } = req.query;
  const feed = await buildFeed({ since, cursor, limit, org });
  if (feed.badCursor) return sendError(res, 400, "invalid_input", "Invalid input: cursor isn't valid");

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=qwench_feed.csv");
    if (feed.next_cursor) res.setHeader("X-Next-Cursor", feed.next_cursor);
    return res.send(feedToCsv(feed.records));
  }
  return res.json(feed);
}
