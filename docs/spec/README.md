# Qwench spec

This folder is the source of truth for what Qwench is and what needs building.
Where older README text or `/api` behaviour conflicts with it, this folder wins.

## Reading order

| File | What it covers | Who needs it |
|---|---|---|
| [01-business.md](01-business.md) | The idea, customers, data rules, law, roadmap | Everyone |
| [02-build-spec.md](02-build-spec.md) | Data, data model, engine, API, channels, tests | All builders |
| [03-backend-workplan.md](03-backend-workplan.md) | Backend phases in order | Backend |
| [04-bot-web-console-workplan.md](04-bot-web-console-workplan.md) | Bots, web app and console | Bot and web engineer |
| [05-data-lead-workplan.md](05-data-lead-workplan.md) | Reviewed records and demo data | Data lead |
| [06-lean-canvas.md](06-lean-canvas.md) | One-page lean canvas | Pitch |
| [07-qa-and-sources.md](07-qa-and-sources.md) | Panel answers, and the source of every figure | Pitch and QA |

## Who owns what

| Owner | Area |
|---|---|
| Dre | Backend, brand design, pitch design, QA |
| Web app engineer | WhatsApp bot, Telegram bot, web app, console UI |
| Data lead | Reviewed records, demo data |

Stay in your own area. If you need something from another owner, list it for them.

## Rules that must never break

1. No scores, verdicts or advice in `/v1`, the bots, the web app or the console.
2. Qwench's own wording never says "safe", "scam", "verified" or "fraudulent". Exact
   regulator quotes are allowed. So is this one sentence: "This does not mean it is safe or unsafe."
3. Qwench never blocks a payment, holds money or contacts a suspect.
4. Only regulator records, sanctions lists and agreed partner confirmations can produce a customer warning.
5. A public report can never change a public result. It only opens a review.
6. Nobody can pay for a different result.
7. Store what was checked, not who checked it. No raw queries, message text or phone numbers in the database or logs.
8. Responses never reveal who contributed or who checked.
9. Partner payment numbers are stored only as keyed hashes, and never appear in the feed.
10. An active record needs a reviewer who is not its capturer.
11. Demo data is labelled, and never presented as coming from MTN, a bank or a regulator.
12. Demo payment numbers use obviously fake values such as `+233240000000`.
13. AI may extract details. It never decides status, tier or the wording of a finding.
14. MTN, banks and regulators are prospects, not partners. Never imply otherwise.

## Decisions already made

- **No public scores:** evidence tiers replace them.
- **Feed:** carries reviewed regulator records and the identifiers published in them.
  Members check partner numbers through `POST /v1/check`. No per-member keys or plain
  hashes, because phone numbers are few enough to guess offline.
- **Foreign regulator alerts:** labelled context only. Ghana regulators and sanctions lists are tier 1.
- **Sources not used:** Truecaller data, automated scraping, reviews. CoinGecko is out of public replies.
- **TikTok and Telegram:** user forwarding and manual review of public posts only.
- **Cases:** checks that don't contact suspects, ending in an evidence pack for the authorities.
- **Fair-use limit:** 20 checks per person per day on the bots, configurable.
- **Console:** login session, so no API key sits in the browser.
- **Unbuilt features:** say "Next" in the pitch, and label concepts "Concept".
- **API keys:** stored as a keyed hash using `HMAC_SECRET_KEY`, because a plain SHA-256 of a stolen key list is easier to attack.
- **Identifier hashes:** every identifier, including numbers, uses `HMAC_SECRET_KEY`. `PHONE_HASH_SALT` is for sender hashes.
- **Readable numbers:** only a number published in a notice stays readable. Every other MoMo or bank number, and all partner data, is a hash only.
- **Record statuses:** `pending`, `active`, `expired`, `withdrawn`.
- **Code layout:** existing files in `src/routes/` and `src/services/` stay where they are. New engine code goes in `src/engine/`.

## Code already on `main`

Commits `eb90ce8` and `690a7f7` added the data model and a first `/v1` API. Build on
them and don't redo them. This list came from reading the code, not running it, so
confirm it first.

**Already there:** the new models, `check_events` as a separate collection, the
four-eyes check on records, required secrets at start-up, CORS limits, rate limiters,
`/v1/public/check`, `/v1/check`, `/v1/feed`, `/v1/contributions`, `/v1/signals`,
`/v1/cases/:id` and `/v1/merchants/verify-number`.

**Names to keep, because the code already uses them:**

| Topic | Use |
|---|---|
| Institution API key | `x-api-key` header |
| Identifier hash key | `HMAC_SECRET_KEY` |
| Allowed origins | `ALLOWED_ORIGINS` |

Backend progress and open bugs are in [03-backend-workplan.md](03-backend-workplan.md).

**Gaps between the code and this spec:**

| Gap | What the spec needs |
|---|---|
| `/v1/public/check` takes `recipient` and `type` only | Also `text`, `urls` and an image, because the bots and paste box send whole messages |
| Public replies have no report | `state_sentence`, `sources`, `return_check`, `warning_signs`, `questions_to_ask`, `footer` |
| Public replies have no `did_you_mean` | Move the `nameVerifier.js` logic in, so `/api/verify-name` can retire |
| No `/v1/console` routes | Login, lookup, payment check, feed, keys, review queue |
| README uses `internal_only` | Confirm against the `internal_review` and `allowed_use` table in the spec, then use one name |
| No `is_demo` in responses | Add it wherever demo data can be returned |
| `reviewRecords.js` approves records in bulk | Don't use it for real data. Every record needs a real second review. Migrated records have no quote, so it can't activate them |
| Feed may include partner data | Confirm that partner numbers never appear in it |
| `isPublicHttpUrl` follows redirects unchecked | Fix as described in the backend workplan |
| The bot still depends on `/api` | Move it, then retire `/api` with Dre's approval |
| `/api` still returns scores and recommendations | Must not be shown or demoed |
