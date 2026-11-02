# Qwench API

Base URL in development: `http://localhost:4000`. Replies never contain a score, a verdict or advice. Show the wording in `report`; don't write your own.

## Errors

Every `/v1` error looks like this, with a status of 400, 401, 403, 404, 429 or 500:

```json
{ "error": { "code": "invalid_input", "message": "Invalid input: send text, urls or an image" } }
```

## Public API

### Who can call it

| Caller | Send | Limit |
|---|---|---|
| Web app | `"channel": "web"`, or leave it out | 30 requests a minute per IP. The IP is never stored |
| WhatsApp and Telegram bots | `X-Channel-Key` header, `channel` and `sender_ref` in the body | `PUBLIC_DAILY_LIMIT` per sender per day (20 by default). `sender_ref` is hashed with a daily salt and used only for this limit |

A bot with a missing or wrong key gets 401. A sender over the limit gets 429 with the code `daily_limit`.

### POST /v1/public/check

Send whole messages. At least one of `text`, `urls` or `image_base64` is needed.

| Field | Type | Notes |
|---|---|---|
| `text` | string | Up to 5,000 characters. Links, numbers, wallets and known names are found automatically |
| `urls` | list | Up to 3 links |
| `image_base64` | string | Body limit 12 MB on this route only |
| `mime_type` | string | `image/jpeg`, `image/png` or `image/webp` |
| `channel` | string | `web`, `whatsapp` or `telegram` |
| `sender_ref` | string | Required for bots. Any stable reference for the sender |
| `recipient`, `type` | strings | Optional: look up one identifier directly. `type` is `name`, `domain`, `url`, `momo_number`, `bank_account`, `wallet`, `social_handle`, `telegram_link`, `tiktok_handle` or `merchant_id` |

Web app:

```bash
curl -X POST http://localhost:4000/v1/public/check \
  -H "Content-Type: application/json" \
  -d '{"text": "GoldWave pays 5% a day, guaranteed. Pay 0240000011."}'
```

Bot:

```bash
curl -X POST http://localhost:4000/v1/public/check \
  -H "Content-Type: application/json" \
  -H "X-Channel-Key: $CHANNEL_API_KEY" \
  -d '{"text": "Check https://example.com", "channel": "whatsapp", "sender_ref": "whatsapp-id-of-sender"}'
```

Reply:

```json
{
  "match": false,
  "state": "no_record",
  "entity": null,
  "tier": null,
  "reason_codes": [],
  "did_you_mean": null,
  "report": {
    "state_sentence": "No record found. This does not mean it is safe or unsafe.",
    "foreign_context": [],
    "also_checked": [],
    "sources": [],
    "return_check": {
      "stated": "5% a day",
      "annual_percent": 1825,
      "note": "That is about 1,825% a year, by simple multiplication. It is not a forecast."
    },
    "warning_signs": ["The message promises guaranteed returns."],
    "questions_to_ask": ["Can you find a licence number on their website, and confirm it with SEC Ghana?"],
    "notes": [],
    "footer": "No reviewed records are loaded yet. SEC Ghana 0800 100 065. Cyber Security Authority 292. Information, not advice."
  },
  "is_demo": false,
  "checked_at": "2026-11-02T10:00:00.000Z"
}
```

`also_checked` lists anything else found in the message, one line each. The reply leads with the most significant result, and an unknown payment number outranks a licensed name mentioned beside it.

**How to show it:** use `report` in this order: `state_sentence`, `foreign_context`, `sources`, `also_checked`, `return_check.note`, `warning_signs`, `questions_to_ask`, `notes`, `footer`. If `is_demo` is true, label the screen "Demo data".

| Field | Values |
|---|---|
| `state` | `named_in_notice`, `licensed`, `sandbox`, `registered`, `authority`, `no_record` |
| `tier` | `1` for a regulator notice or sanctions listing, `2` for a reviewed impersonation, otherwise `null` |
| `reason_codes` | `REGULATOR_NOTICE`, `SANCTIONS_LIST`, `ADVERTISED_AS_BUSINESS_NOT_REGISTERED` |
| `did_you_mean` | `{ "suggested_entity": "Apple" }` for a close name, otherwise `null`. If the user picks it, check that name. It is never a match |

**What a public reply can reveal:** only regulator and sanctions records, legal states and reviewed impersonation. Partner data, reports, signals and open cases look exactly like `no_record`. Don't try to infer more from a reply.

**Not fetched automatically:** TikTok and Telegram links. They are saved for a person to review, and `report.notes` says so.

### POST /v1/public/reports

A report only opens a review. It can never change a public result. Free text isn't accepted, and the reply is always the same, with no count.

```bash
curl -X POST http://localhost:4000/v1/public/reports \
  -H "Content-Type: application/json" \
  -d '{
    "scheme_name": "Example Scheme",
    "identifiers": [{ "type": "momo_number", "value": "0240000000" }],
    "evidence_urls": ["https://example.com/post"]
  }'
```

Bots add `X-Channel-Key`, `channel` and `sender_ref`, as above. Reply, status 202:

```json
{ "received": true, "message": "Thank you. A person will review this." }
```

### POST /v1/public/appeals

For anyone named by Qwench. The reply never confirms or denies what Qwench holds.

```bash
curl -X POST http://localhost:4000/v1/public/appeals \
  -H "Content-Type: application/json" \
  -d '{
    "type": "momo_number",
    "value": "0240000000",
    "contact": "name@example.com",
    "reason": "This number belongs to my shop."
  }'
```

Reply, status 202:

```json
{
  "received": true,
  "reference": "6543abcd6543abcd6543abcd",
  "due_date": "2026-11-16",
  "message": "Thank you. A person will reply about what Qwench shows publicly."
}
```

### GET /v1/public/about

```bash
curl http://localhost:4000/v1/public/about
```

```json
{
  "data_date": "2026-11-02",
  "total_records": 2,
  "records_by_source": [{ "publisher": "SEC Ghana", "records": 2 }]
}
```

`data_date` is `null` until reviewed records are loaded.

## Moving off /api

`/api` keeps working until the bot and web app have moved. Nothing is removed before Dre approves it.

| Old route | New route |
|---|---|
| `POST /api/check` | `POST /v1/public/check` |
| `POST /api/verify-name` | `did_you_mean` in `POST /v1/public/check`. **The old route still suggests names from the unreviewed list** |
| `POST /api/evidence/image` | `image_base64` and `mime_type` in `POST /v1/public/check` |
| `POST /api/evidence/url` | `urls` in `POST /v1/public/check` |
| `POST /api/report` | `POST /v1/public/reports` |
| `GET /api/trending` | Removed from public replies |
| `GET /health` | Stays. AI error details go in Phase 6 |

`skipConfirmation` is gone: when someone picks a suggestion, send the suggested name as a new check. `pending_records` and `return_check.warning` are gone too.

## Institution API

Send your key in the `x-api-key` header. A missing or revoked key gets 401, and a key without the scope gets 403. Keys are limited per minute, per key.

### POST /v1/check

Scope: `check`.

```bash
curl -X POST http://localhost:4000/v1/check \
  -H "Content-Type: application/json" \
  -H "x-api-key: $QWENCH_API_KEY" \
  -d '{"recipient": "+233240000000", "type": "momo_number", "amount_ghs": 800, "new_payee": true}'
```

```json
{
  "match": true,
  "entity": "Example Scheme",
  "state": "named_in_notice",
  "tier": 1,
  "reason_codes": ["REGULATOR_NOTICE"],
  "sources": [{ "publisher": "", "date": "", "url": "", "quote": "" }],
  "foreign_context": [],
  "allowed_use": "customer_warning",
  "suggested_action": "warn",
  "report": {},
  "is_demo": false,
  "checked_at": ""
}
```

A match also has `entity_slug`, `entity_kind`, `relations`, `merchant_claim` and `signal`. An unknown recipient returns `match: false`, `state: "no_record"` and `suggested_action: "none"`.

| Field | Values |
|---|---|
| `allowed_use` | `customer_warning`, `internal_review`, `watch` or `null` |
| `suggested_action` | `warn_or_confirmation_call` (tier 1, new payee, at or above your limit), `warn`, `internal_review`, `watch`, `none` |

### GET /v1/feed

Scope: `feed`. New, changed and removed reviewed records, oldest change first.

```bash
curl "http://localhost:4000/v1/feed?since=2026-11-01T00:00:00Z&limit=500" -H "x-api-key: $QWENCH_API_KEY"
```

```json
{
  "count": 1,
  "records": [{
    "change": "added",
    "entity": "Example Scheme",
    "entity_slug": "example-scheme",
    "state": "named_in_notice",
    "record_type": "warning",
    "jurisdiction": "GH",
    "source": { "publisher": "", "title": "", "date": "", "url": "" },
    "quote": "",
    "identifiers": [{ "type": "domain", "value": "example.com" }],
    "updated_at": "",
    "is_demo": false
  }],
  "next_cursor": null
}
```

- `change` is `added`, `updated` or `removed`. A removed record has no quote or identifiers.
- When `next_cursor` isn't null, pass it back as `cursor` for the next page. In CSV it's in the `X-Next-Cursor` header.
- Add `format=csv` for a spreadsheet.
- Identifiers are only those published in a notice. Partner numbers are never in the feed, in any form. Check them through `POST /v1/check`.

## Console API

For the console's own screens. It uses a login session, so no API key ever sits in the browser. The session is an httpOnly cookie set by `/login`, so send requests with credentials included (`credentials: "include"` in `fetch`). It lasts 8 hours. Add the console's address to `ALLOWED_ORIGINS`.

There's no sign-up. Create users with `pnpm user:create`, or `pnpm seed:demo` on a demo database.

| Route | Who | Purpose |
|---|---|---|
| `POST /v1/console/login` | Anyone | `{ "email", "password" }`, returns `{ "user": { "email", "role", "organization", "is_demo" } }` |
| `POST /v1/console/logout` | Anyone | Ends the session |
| `GET /v1/console/me` | Signed in | The current user, or 401 |
| `POST /v1/console/lookup` | Signed in | `{ "recipient", "type" }`. Same reply as `/v1/check`, plus `member_report_count`: how many independent members reported it, never who |
| `POST /v1/console/payment-check` | Signed in | Same request and reply as `/v1/check`, using the user's organisation |
| `GET /v1/console/feed` | Signed in | Same as `/v1/feed` |
| `GET /v1/console/api-keys` | `org_admin` | Their organisation's keys, without the keys themselves |
| `POST /v1/console/api-keys` | `org_admin` | `{ "scopes": ["check", "feed"] }`. The reply has the full `key`, shown only this once |
| `DELETE /v1/console/api-keys/:id` | `org_admin` | Revokes it at once |
| `GET /v1/console/review-queue` | Qwench reviewers | `{ "count", "items": [...] }`. Each item has `id`, `kind`, `title`, `can_review` and details for its kind |
| `POST /v1/console/review-queue/:id` | Qwench reviewers | `{ "kind", "decision": "approve" or "reject" }` |

Queue `kind` is `record`, `relation`, `public_report`, `contribution` or `signal`. Refusals you should show:

| Code | Meaning |
|---|---|
| `self_approval` | A different person has to review this (403). `can_review` is false on these items |
| `needs_quote` | The record has no quote from its source, so it can't go live |
| `already_reviewed` | Someone else got there first |
| `review_refused` | The item doesn't meet the rules to go live |
