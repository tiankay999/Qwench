# Qwench backend workplan

## Your role
You are building the backend for Qwench, Ghana's fraud bureau, in `Backend/`.
Its first product is Know Your Payee: before a payment goes, a bank or MoMo app
checks the recipient against schemes regulators have named and fraud
institutions have confirmed.

Work through the phases in order. Finish and test each phase before starting
the next. Commit after each phase on a branch called `backend-v1`, started from the latest `main`. Don't push,
merge or deploy unless Dre asks.

**Other owners:**
- `WhatsappBot/`, `WebAPP/` and the console UI belong to another engineer. Don't edit them.
- The data lead supplies reviewed records. Never invent records.
- If you need something from them, list it for Dre.

## Stop and ask Dre if
- A requirement here conflicts with what you find in the code.
- A step would delete data, or remove an `/api` route the bot still calls.
- You need a credential, a deployment target or a new paid service.
- A record has no source, or a legal question comes up.

## The current code
Read [README.md](README.md) first. Commits `eb90ce8` and `690a7f7` already added the
data model and a first `/v1` API. For each phase below, check what exists, test it,
and build only what's missing. Keep the names the code already uses: the `x-api-key`
header, `HMAC_SECRET_KEY` and `ALLOWED_ORIGINS`.

The bot calls `/api/check`, `/api/report`, `/api/trending`, `/api/verify-name`,
`/api/evidence/image`, `/api/evidence/url` and `/health` through `WhatsappBot/src/api.js`.

**Setup:** disk space may be tight. Keep the test MongoDB copy and the pnpm store in
`/tmp` if needed. Stop and report if free space falls below 150 MB. Model names can't be
checked without a key, so list that as not done. Everything must work with no AI provider.

## Progress
| Phase | Status | Commit on `backend-v1` |
|---|---|---|
| 0 Setup | Done | `a63f1cd` |
| 1 Data model | Done | `4158cef` |
| 2 onwards | Not started | |

Known bugs from the review that are still open, by phase:
- **Phase 3:** near-miss names returned as matches, foreign alerts at tier 1, tier 3 reached by one organisation or unreviewed contributions, numbers flagged without review, expired records still counted, suggested actions, partner numbers not found by a check.
- **Phase 4:** `isPublicHttpUrl`.

## Rules that must never break
1. No scores, verdicts or advice anywhere in `/v1`.
2. Qwench's own wording never says "safe", "scam", "verified" or "fraudulent".
   Exact regulator quotes are allowed. So is this one sentence:
   "This does not mean it is safe or unsafe."
3. Qwench never blocks a payment, holds money or contacts a suspect.
4. Only regulator records, sanctions lists and agreed partner confirmations can
   produce a customer warning.
5. A public report can never change a public result. It only opens a review.
6. Nobody can pay for a different result.
7. Store what was checked, not who checked it. No raw queries, message text or
   phone numbers in the database or logs.
8. Responses never reveal who contributed or who checked.
9. Partner payment numbers are stored only as keyed hashes.
10. Partner data never leaves one organisation in readable form. Scheme details only, never customer records.
11. An active record needs a reviewer who is not its capturer.
12. Demo data is marked `isDemo: true`, returned as `"is_demo": true`, and never
    presented as coming from MTN, a bank or a regulator.
13. Demo payment numbers must use obviously fake values such as `+233240000000`,
    so nobody real is flagged.
14. AI may extract details. It never decides status, tier or wording of a finding.

---

## Phase 0: Setup
- Create the `backend-v1` branch.
- Add `.env.example` with `MONGODB_URI`, `API_PORT`, `ALLOWED_ORIGINS`,
  `PHONE_HASH_SALT`, `HMAC_SECRET_KEY`, `JWT_SECRET`, `CHANNEL_API_KEY`,
  `PUBLIC_DAILY_LIMIT` (default 20), `ALLOW_DEMO_SEED` (default false), and the
  existing LLM variables. Check the configured model names are valid; don't assume.
- Fail at start-up if the salt, HMAC key or JWT secret is missing. No default values.
- Add tests with `node:test` and `mongodb-memory-server`, and a real `test` script.
- Add `helmet`, `express-rate-limit` and `jsonwebtoken`.
- Add a central error handler for `/v1`. Errors use
  `{ "error": { "code": "...", "message": "..." } }` with 400, 401, 403, 404, 429 or 500.
- Keep all `/api` routes working until Phase 6.

**Layout:**
```
src/models/        new models
src/engine/        normalize, extract, match, state, tier, report, templates
src/routes/        public.js, institutional.js, plus new console routes (existing files stay where they are)
src/middleware/    apiKeyAuth, rateLimiter, validate, errorHandler, plus session and channelKey
src/scripts/       import-reviewed, migrate-legacy, seed-demo
test/
docs/API.md
```

## Phase 1: Data model
Create these models. Add indexes on anything used for lookup.

| Model | Fields | Rules |
|---|---|---|
| `Source` | publisher, type, title, url, publishedOn, retrievedAt, archiveUrl, isOfficial, isDemo | Every record needs one |
| `Entity` | name, slug, aliases, kind (platform, company, token, app, merchant, authority), country, allowFuzzy, isDemo | Replaces `Investment` in `/v1` |
| `Identifier` | entityId, type (name, domain, momo_number, bank_account, wallet, social_handle, telegram_link, tiktok_handle, merchant_id), raw, normalized, valueHash, origin (notice, partner, merchant, review, legacy), isDemo | Partner origin: `raw` and `normalized` stay empty. MoMo and bank numbers keep no readable form unless the origin is `notice`, because a notice is already public and the feed publishes it |
| `Record` | entityId, sourceId, type (warning, licence, sandbox, registration, foreign_alert, sanction), jurisdiction, licenseType, quote, effectiveOn, endsOn, status (pending, active, expired, withdrawn), capturedBy, reviewedBy, reviewedAt, isDemo | Validation rejects `active` without a source, a quote, or with reviewer equal to capturer |
| `Relation` | fromEntity, toEntity, type (impersonates, claims_affiliation, renamed_from, same_operator), sourceId, status | Real companies appear only as impersonated |
| `Organization` | name, type (bank, momo, psp, vasp, merchant, regulator, qwench), status, confirmationCallLimitGhs, warnsOnPartnerData, isDemo | |
| `User` | orgId, email, passwordHash, role (analyst, org_admin, reviewer, regulator) | bcrypt; no public sign-up |
| `ApiKey` | orgId, keyHash, prefix, scopes, rateLimit, revokedAt, lastUsedAt | Keyed HMAC-SHA256 hash only, using `HMAC_SECRET_KEY`; show the full key once |
| `Check` | hourBucket, channel, inputType, identifierHashes, matchedEntityIds, state, tier, flags, outcome, legacyId, isDemo | Collection `check_events`, because the old `LegacyCheck` model owns `checks`. No exact time and no sender |
| `SenderDay` | senderHash, day, count, expiresAt | TTL deletes after 24 hours; daily salt |
| `Contribution` | orgId, schemeName, identifiers, terms, region, lossBand, evidenceRefs, reviewStatus, isDemo | Scheme details only |
| `PublicReport` | schemeName, identifiers (type and valueHash), source, evidenceRefs, reviewStatus, expiresAt | Never returned publicly; unconfirmed reports expire after 90 days |
| `Signal` | key, weekStart, checksThisWeek, checksLastWeek, distinctSources, anomalyFlag, reviewStatus | Worked out from `CheckEvent` |
| `Case` | caseNumber, type (scheme, impersonation), trigger, identifiers, checks, evidenceRefs, tier, status (open, under_review, referred, confirmed, dismissed, closed), referrals, outcome, ownerId, isDemo | Every change logged |
| `Merchant` | entityId, legalName, verificationMethod, documentRefs, officialIdentifiers, status, verifiedBy, verifiedAt, renewalDue, isDemo | |
| `BrandWatch` | orgId, brandName, officialDomains, officialNumbers, keywords, status | |
| `BrandFinding` | watchId, platform, url, claimedName, identifiersFound, firstSeen, evidenceRefs, reviewStatus, takedownStatus, isDemo | Public content only |
| `Appeal` | identifierHash, contact, reason, status, dueDate, resolution | Clear `contact` on closure |
| `AuditLog` | actor, action, target, before, after, timestamp | Tier, record, case and review changes |

**Test:** an active record fails validation with no source, no quote, or the same capturer and reviewer.

## Phase 2: Data import
**`src/scripts/import-reviewed.js`** reads `src/data/reviewed/*.json`:
```json
{
  "name": "", "kind": "platform", "aliases": [], "allowFuzzy": false,
  "recordType": "warning", "jurisdiction": "GH", "licenseType": "",
  "identifiers": [{ "type": "domain", "raw": "" }],
  "source": { "publisher": "", "title": "", "url": "", "publishedOn": "" },
  "quote": "", "effectiveOn": "", "endsOn": null,
  "capturedBy": "", "reviewedBy": ""
}
```
- It must be idempotent, and print a report of what was added, changed and rejected.
- Reject the row, with a reason, if a required field is missing.
- Don't guess a missing date, link or quote.

**`src/scripts/migrate-legacy.js`** imports `sec-ghana.json` with status `pending`.
Pending records are never returned by a check. They only give the data lead a starting list.

**`src/scripts/seed-demo.js`** runs only when `ALLOW_DEMO_SEED=true`. It creates
labelled demo organisations, API keys, partner numbers, merchants, cases and findings.

**Other changes:**
- Stop calling `bootstrapSecData` once `/api` is retired in Phase 6.
- Don't use the invented reports in `seed.js` anywhere in `/v1`.

If `src/data/reviewed/` is empty, use test fixtures for tests and tell Dre that real data is still needed.

## Phase 3: Evidence engine
Build it in `src/engine/` as pure functions where possible, with this flow:

1. **Extract:** names, domains, numbers, wallets, stated returns and warning signs,
   using rules first. AI can add candidates, but each must literally appear in the
   input. AI failure never fails the check.
2. **Normalise:**
   - `0241234567`, `233241234567` and `+233 24 123 4567` become `+233241234567`.
   - Domains: lowercase, without protocol, `www` or path.
   - EVM wallets: lowercase.
   - Names: reuse the existing homoglyph handling.
   - `valueHash` is HMAC-SHA256 of type and normalised value, using `HMAC_SECRET_KEY`.
3. **Match:** identifier hashes first, then names. Adapt `nameVerifier.js` to read
   from `Entity`, and tighten its threshold. Close matches return as "Did you mean?"
   and never as a match. Entities with `allowFuzzy: false` match exactly.
4. **Legal state** from active, unexpired records, first match wins:
   `named_in_notice`, `licensed`, `sandbox`, `registered`, `authority`, `no_record`.
5. **Merchant registry:** if the number was advertised under a registered business's
   name and isn't one of its numbers, flag impersonation for review.
6. **Tier:**

| Tier | Basis | Reason code | `allowed_use` |
|---|---|---|---|
| 1 | Ghana regulator notice or sanctions list | `REGULATOR_NOTICE`, `SANCTIONS_LIST` | `customer_warning` |
| 2 | Partner-confirmed fraud, reviewed impersonation | `PARTNER_CONFIRMED`, `ADVERTISED_AS_BUSINESS_NOT_REGISTERED` | `internal_review`, or `customer_warning` if the organisation has `warnsOnPartnerData` |
| 3 | Reports from 3+ independent sources with evidence, reviewed | `CORROBORATED_REPORTS` | `internal_review` |
| 4 | Reviewed rise in checks | `CHECK_SPIKE` | `watch` |
| None | Single public report | None | Not shown; opens a review |

   Licensed, sandbox, registered and authority are legal states, never warnings,
   and carry `tier: null`. Foreign regulator alerts are labelled context only.
   Count independent organisations and channels, not volume.

7. **`suggested_action`:**
   - `warn_or_confirmation_call`: tier 1, `new_payee` true, and amount at or above
     the organisation's `confirmationCallLimitGhs`.
   - `warn`: other tier 1 results.
   - `internal_review`: tiers 2 and 3, or `warn` where `allowed_use` is `customer_warning`.
   - `watch`: tier 4.
   - `none`: everything else.

8. **Context:** return check (5% a day shown as about 1,825% a year, simple
   multiplication and labelled as such), warning signs described as what the message
   says, and domain age where cached.
9. **Report:** fixed templates produce `state_sentence`, `sources`, `return_check`,
   `warning_signs`, `questions_to_ask` and `footer`. The footer gives the data date,
   SEC 0800 100 065, CSA 292 and "Information, not advice."
10. **Log:** write a `Check` row with hashes only, without blocking the response.

Don't import `riskEngine.js`, `coingecko.js` or `goplus.js` into `/v1`.

**Tests:**
- A banned-word test runs across every template.
- `Daraz` doesn't match `Darazz`.
- A sandbox firm returns no warning, red flag or tier.
- Twenty reports from one source change nothing publicly.
- Reports against a registered merchant go to review only.

## Phase 4: Public API
Used by WhatsApp, Telegram and the web app.

**`POST /v1/public/check`**
```json
{ "text": "", "urls": [], "image_base64": null, "mime_type": null,
  "channel": "whatsapp", "sender_ref": "" }
```
- Returns `{ state, entity, tier, reason_codes, did_you_mean, report, is_demo, checked_at }`.
- Bots authenticate with `X-Channel-Key`. Hash `sender_ref` straight away with the
  daily salt, and use it only for the fair-use limit of `PUBLIC_DAILY_LIMIT`.
- The web app has no sender, so rate-limit it by IP without storing the IP.
- Raise the JSON body limit on this route only, for images.
- Reuse `analyzeUrl` and `analyzeImage` only for extraction, and discard any score or
  verdict they return.
- Fix server-side fetching: check every redirect hop, resolve DNS, block private,
  loopback and link-local addresses, connect to the address you validated, and cap
  response size and time. Test each case.
- `/api/verify-name` moves in as `did_you_mean`. The two evidence routes move into the
  `image_base64` and `urls` fields. List this mapping in `docs/API.md`.
- Don't fetch TikTok or Telegram links automatically. Record them as identifiers and
  queue them for manual review.

**Also build:**
- `POST /v1/public/reports`: saves a report and returns a neutral thank-you with no count.
- `POST /v1/public/appeals`: creates an appeal with a due date.
- `GET /v1/public/about`: data date and record counts by source.

Write `docs/API.md` with curl examples, and tell Dre the bot and web engineer can start.

## Phase 5: Institution API
Authenticate with the `x-api-key` header, checking scopes and rate limit.

**`POST /v1/check`**, request:
```json
{ "recipient": "+233240000000", "type": "momo_number", "amount_ghs": 800, "new_payee": true }
```
Response:
```json
{
  "match": true,
  "entity": "Example Scheme",
  "state": "named_in_notice",
  "tier": 1,
  "reason_codes": ["REGULATOR_NOTICE"],
  "sources": [{ "publisher": "", "date": "", "url": "" }],
  "allowed_use": "customer_warning",
  "suggested_action": "warn",
  "is_demo": false,
  "checked_at": ""
}
```
An unknown recipient returns `match: false`, `state: "no_record"`, `suggested_action: "none"`.

**`GET /v1/feed?since=&cursor=&format=json|csv`**
- New, changed and withdrawn records, with `change: added | updated | removed`.
- Active reviewed records and the identifiers published in them, with cursor paging.
- Leave partner numbers out entirely. Members check them through `POST /v1/check`.
  No per-member keys or plain hashes, because phone numbers can be guessed offline.
- Never name a contributor.

**Console** (`/v1/console`, JWT session, role checks):
- `POST /login`, `GET /me`
- `POST /lookup`: state, tier, reason, sources, allowed use, member report count, signal
- `POST /payment-check`: same logic as `/v1/check`
- `GET /feed`
- `GET`, `POST` and `DELETE /api-keys`
- `GET /review-queue` and `POST /review-queue/:id` for reviewers, with no self-approval

Console routes exist so no API key ever sits in the browser. Log every review in `AuditLog`.

**Stop here if time is short.** Phases 0 to 5 and Phase 6 are the must-haves.

## Phase 6: Security and retiring the old API
Do this after the other engineer confirms the bot and web app use `/v1` for every route listed in "The current code".
Ask Dre before removing anything.

- Limit CORS to `ALLOWED_ORIGINS`.
- Add rate limits to every route.
- Validate all input.
- Remove query strings from the request logger.
- Stop logging raw queries and phone numbers anywhere.
- Remove LLM error details from the public `/health`.
- Remove `/api/check`, `/api/report`, `/api/reports`, `/api/trending`, `/api/register`,
  `/api/crypto/trending`, `/api/stats`, `/api/verify-name` and the evidence routes.
- Remove `bootstrapSecData` from start-up, plus the scoring code and models no longer used.
- Delete old `checks` data only with Dre's approval, because it holds raw queries.

**Run the full acceptance tests below.** Then give Dre a summary of what works and what doesn't.

## Phase 7: Cases
Do Phases 7 to 10 in this order. If time runs out, stop and they stay "Next" in the pitch.

- **Opens automatically on:** 3+ independent sources with evidence; a public signal
  matching a member report; a reviewed check spike; a number advertised under a
  registered business's name.
- **Status flow:** open, under review, referred, confirmed or dismissed, closed.
- **Checks recorded:** licence registers, claimed affiliations, website age, links to
  earlier cases, the offer's terms, and confirmation from the victim business on its
  registered number.
- **Never:** call, message or pay a suspect. Don't build any such function.
- **Output:** an evidence pack as JSON and printable HTML for referral to the CSA,
  SEC, Bank of Ghana or law enforcement.
- **Tier change:** only a regulator notice moves a case to tier 1.
- **Routes:** `GET /v1/cases/:id`, and console list, detail, update, referral and evidence pack.

## Phase 8: Shared layer and signals
- `POST /v1/contributions`: scheme name, website, wallet, payment number (hashed on
  arrival, never stored raw), terms, region, loss range.
- Reject customer details and suspicious transaction report contents. Tell the caller what was rejected.
- Show "reported by N members", counting independent organisations. Never name them.
- Record verified contributions per organisation for later fee credits.
- Flag spikes in contributions against one identifier for review.
- Build a scheduled job to work out `Signal` from `Check` rows.
- `GET /v1/signals` returns reviewed signals only.
- Before any real partner data goes in, a data-sharing agreement is required. Until then, demo data only, labelled.

## Phase 9: Merchant registry
- Registration requires proof of ownership, approved by a person.
- `POST /v1/merchants/verify-number` answers "Registered by [business]" or "Advertised
  as [business], but not one of its registered numbers."
- Make no claim about unregistered businesses.
- Registered merchants are never flagged automatically.

## Phase 10: Brand Watch
- Setup: brand name, official domains and numbers, keywords.
- Sources now: checks mentioning the brand, user-forwarded links, look-alike domain
  checks, and findings logged by a reviewer.
- Flow: finding, review, alert, takedown pack, status tracked. A finding can open a case.
- Public content only, on the brand owner's authority. No scraping where terms forbid
  it, and no private chat scanning.

---

## Retention
- Sender hashes: 24 hours.
- Unconfirmed public reports: 90 days.
- Check events: summarise after 12 months.
- Appeal contact details: deleted on closure.
- Evidence files: leave open for the lawyer, and list as an open question.

## Acceptance tests
Automate these where possible. Use real reviewed data once loaded, otherwise labelled
fixtures. Mark each result "fixture" or "real data", because a fixture pass proves the
engine and not the data. GoldWave must never have a record, even in fixtures. Daraz
needs a Darazz record.

| Input | Expected |
|---|---|
| `yepbit.com` | SEC warning with date and link, tier 1, no score |
| Daily Wealth Guide | Bank of Ghana and SEC warning |
| Vaulta or GoldBod | Sandbox sentence, no warning or red flag |
| GoldWave offer | No record, "This does not mean it is safe or unsafe.", return check, warning signs |
| Daraz | No match to Darazz |
| A notice-listed identifier | `/v1/check` returns tier 1 and its source |
| Unknown number | `match: false` |
| Missing API key | 401 |
| Revoked API key | 401 |
| Key without the scope | 403 |
| Too many requests | 429 |
| 20 reports from one source | No public change, flagged for review |
| Reports against a registered merchant | Sent to a person, never automatic |
| Unregistered number advertised as a registered merchant | Impersonation result, after review |
| Banned words | None in Qwench's own wording |
| Self-approval of a record | Rejected |
| Database and log inspection after a test run | No raw message or phone number |
| Partner number in the database | Hash only |
| Demo data result | `is_demo: true` |
| AI provider down | Check still returns correctly |

## When you finish a phase
Tell Dre in plain language:
1. What now works, and how to try it.
2. What you tested and the results, including failures.
3. What the other engineer or data lead now needs to do.
4. Anything you skipped or assumed.
