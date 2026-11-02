# Qwench

A WhatsApp bot that helps people in Ghana verify investments before they put money in.

Send the bot a company name, token or investment link and it replies with a risk score
out of 10, the entity's SEC Ghana licensing status, the specific red flags found, and a
recommendation.

Built for a 48-hour hackathon. Theme: Transparency and Digital Infrastructure.

---

## Layout

```
Qwench/
├─ Backend/            Express + MongoDB API (risk scoring, reports)
│  └─ src/
│     ├─ server.js         entry point (loads the SEC register on start)
│     ├─ config/db.js      Mongo connection
│     ├─ models/           Investment, Report, Check
│     ├─ routes/api.js     all /api endpoints
│     ├─ services/         riskEngine, aiAnalyzer, nameVerifier,
│     │                    imageAnalyzer, urlAnalyzer, secData,
│     │                    bootstrapData, coingecko, goplus
│     ├─ data/             sec-ghana.json  (licensed + blacklisted entities)
│     └─ scripts/seed.js   full reset + community reports
│
├─ WhatsappBot/        Baileys WhatsApp client
│  └─ src/
│     ├─ index.js          entry point
│     ├─ whatsapp.js       Baileys socket, QR code, reconnects
│     ├─ router.js         decides which flow handles a message
│     ├─ flows/            checkFlow, reportFlow
│     ├─ flows/            checkFlow, reportFlow, verifyFlow,
│     │                    evidenceFlow
│     ├─ messages.js       all message copy and report formatting
│     ├─ sessions.js       per-user conversation state
│     └─ api.js            calls the backend over HTTP
│
└─ WebAPP/             (empty - the full web report lives here later)
```

The two processes are independent: the bot talks to the backend over HTTP, so you can
restart either one without touching the other.

---

## Running the demo

You need MongoDB running locally (or a connection string to Atlas).

**1. Backend** — in `Backend/`:

```bash
pnpm install
pnpm seed      # loads 15 licensed entities, 10 flagged schemes, 12 reports
pnpm dev       # http://localhost:4000
```

**2. Bot** — in a second terminal, in `WhatsappBot/`:

```bash
npm install
npm start
```

A QR code prints in the terminal. On your phone: **WhatsApp → Settings → Linked devices
→ Link a device**, and scan it. Credentials are saved to `WhatsappBot/auth/`, so you only
scan once — restarts reconnect on their own.

Then message that WhatsApp number from any other phone.

> `WhatsappBot/` uses npm rather than pnpm: Baileys pulls a git-hosted lint config into
> its dependency tree, which pnpm 12 blocks by default as a supply-chain policy. Using
> npm there avoids turning that guard off.

---

## Things to try in the demo

| Send this                  | You get                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `Menzgold`                 | 🔴 8.0/10 HIGH RISK — SEC & EOCO warning, 3 reports         |
| `Expert Option`            | 🔴 8.0/10 HIGH RISK — SEC Ghana July 2026 notice            |
| `Solmax` / `PetronPay`     | 🔴 8.0/10 HIGH RISK — SEC Ghana & EOCO warning              |
| `ZEC ZEC FX`               | 🔴 8.0/10 HIGH RISK — blacklisted + 2 community reports     |
| `Databank` / `IC Securities` | 🟢 0.5/10 LOW RISK — SEC licensed, with licence type      |
| `BTC` / `Ethereum`         | 🟢 1.5/10 LOW RISK — live CoinGecko market data             |
| `0x…` contract address     | GoPlus honeypot + permissions check                         |
| `http://quick-inv.tk`      | 🟡 flagged throwaway domain                                 |
| `report`                   | starts the 2-step community report flow                     |
| `trending`                 | most-reported schemes right now                             |
| `help`                     | how Qwench works                                            |

Aliases work too — `QVSE`, `PetronPay`, `Kukafor`, `Yepbit` and `DKM` all resolve to
their full registered names.

---

## API

| Method | Route                   | Purpose                                        |
| ------ | ----------------------- | ---------------------------------------------- |
| POST   | `/api/verify-name`      | anti-spoofing check; runs before `/api/check`  |
| POST   | `/api/check`            | `{ query }` → risk score + full breakdown      |
| POST   | `/api/evidence/image`   | `{ base64, mimeType }` → vision analysis       |
| POST   | `/api/evidence/url`     | `{ url }` → scrape + analysis                  |
| POST   | `/api/report`           | save a community scam report                   |
| GET    | `/api/reports`          | recent reports (reporter phone excluded)       |
| GET    | `/api/trending`         | most-reported schemes                          |
| GET    | `/api/register`         | the SEC lists — `?status=`, `?category=`, `?q=` |
| GET    | `/api/crypto/trending`  | CoinGecko trending coins                       |
| GET    | `/api/stats`            | totals, plus licensed / blacklisted counts     |
| GET    | `/health`               | liveness probe                                 |

---

## The /v1 API

Two layers, mounted alongside the original bot API.

**Public** — no auth, 30 req/min per IP:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/v1/public/check` | `{ recipient, type, amount_ghs, new_payee }` → match, legal state, tier, reason codes, sources |

**Institutional** — `x-api-key` header, per-key rate limit, scope-checked:

| Method | Route | Scope |
| --- | --- | --- |
| POST | `/v1/check` | `check` — same verdict logic, fuller sources, relations, signals |
| GET | `/v1/feed?since=` | `feed` — new/changed records, JSON or CSV |
| POST | `/v1/contributions` | `contributions` — member orgs share scheme details |
| GET | `/v1/signals` | `signals` — reviewed spikes only |
| GET | `/v1/cases/:caseNumber` | `cases` |
| POST | `/v1/merchants/verify-number` | `merchants` |

**What `/v1` never returns:** risk scores, verdicts, colours, recommendations, who
contributed data, who ran a check, or any raw number or message text. `licensed`,
`sandbox` and `registered` are **legal states, not warnings** — a licensed firm comes
back with `tier: null`, no reason codes and `suggested_action: "none"`.

Only a tier-1 (regulator-grade) finding is `allowed_use: "customer_warning"`. Everything
else is `internal_only`: telling a customer their payee is suspect on thinner evidence
is an accusation Qwench cannot stand behind.

**Records must be reviewed before they match.** `/v1/check` reads only
`status: "active"` records, and the migration leaves every imported record
`under_review` by design. Until a second person signs them off, a check resolves the
entity but reports `no_record`. Sign off with:

```bash
node src/scripts/reviewRecords.js --reviewer "you@example.com" --dry-run
node src/scripts/reviewRecords.js --reviewer "you@example.com"
```

That is a bulk approval — mechanically four-eyes clean (the reviewer must differ from
the capturer, and every activation is audited), but one person approving a whole
register in one command is a governance shortcut. Review individually for anything
beyond bootstrapping an import.

> **The old `/api/*` routes break the `/v1` rules.** They return risk scores, verdicts
> and recommendation text, which `/v1` forbids. They are still mounted because the
> WhatsApp bot depends on them; migrating the bot onto `/v1/public/check` is the
> outstanding piece. Do not expose `/api/*` to institutions.

---

## Data sources

**1. SEC Ghana register** — `src/data/sec-ghana.json`, loaded into MongoDB on every
server start by `bootstrapSecData()`. The load is idempotent (upsert by slug), so
restarts refresh the register without duplicating rows or touching community reports.

- **46 blacklisted entities**: 23 from the SEC Ghana July 2026 notice, 17 from earlier
  SEC Ghana & EOCO warnings, and 6 well-known historical Ghanaian investment scams.
- **15 licensed entities**, each with its licence type (Fund Manager / Broker-Dealer /
  Investment Advisor).
- **11 sandbox VASPs** with provisional approval under Act 1154 — held as
  `status: "sandbox"` and never presented as fully licensed.
- Each entity carries `aliases`, so people find it however they spell it.

**2. CoinGecko** (free, no key) — `/search`, `/coins/{id}`, `/coins/markets`,
`/search/trending`. Calls are globally throttled to stay inside the 30 req/min free
tier, retry once on a 429, and are cached for 10 minutes.

**3. GoPlus Security** (free, no key) — `/token_security/{chain_id}`, called **only**
when the query is a `0x…` contract address. It probes Ethereum (1), BSC (56) and
Polygon (137) and uses the first chain that recognises the address, then scores
`is_honeypot`, `is_open_source`, `can_take_back_ownership`, `owner_change_balance`,
`hidden_owner` and `selfdestruct`.

---

## Name verification (anti-spoofing)

Runs **before** every risk check. Two jobs that pull against each other: catch names
built to look like a real entity, without scaring anyone off a legitimate company whose
informal name they happened to type.

`src/services/nameVerifier.js` normalises the input (homoglyphs folded, repeated letters
collapsed, punctuation stripped), checks for an exact match, then falls back to a
fuse.js fuzzy search over every registered name and alias.

| Outcome | When | What the bot does |
| --- | --- | --- |
| `exact` | matches a registered name or alias | straight to analysis |
| `blacklist_variant` | a dressed-up blacklisted name | 🔴 auto-flag, **no** confirmation |
| `spoofing_alert` | borrowed authority word on a registered name | ⚠️ asks "did you mean 1 or 2?" |
| `legit_lookalike` | a **registered company exists** under a close name | ✅ shows it, offers to check it |
| `soft_warning` | the informal name of a registered company | names the registered entity, proceeds |
| `no_match` | nothing similar | normal analysis |

Whenever a legitimate registered entity sits near what was typed, the user is told so —
with its status and licence type — and offered the real one. Even if they choose to check
the look-alike instead, the report ends with *"The registered company with a similar name
is…"*, so nobody leaves without knowing where the real company is.

A look-alike never inherits the real company's standing. `lookupSecEntity` only carries a
loose match forward when the extra words are conversational filler ("is menzgold legit"),
or when the matched entity is blacklisted — so `Menzgold Premium` still resolves to
Menzgold, while `Black Star Energy` is scored on its own merits rather than borrowing
Black Star Advisors' licence.

Detected tricks: duplicated letters (`Vaultaa`), look-alike characters (`V4ulta`,
`Menzg0ld`), added authority words (`Official Vaulta`, `Menzgold Premium`), and names
glued on without a space (`KoinkoinGH`).

**Two deliberate asymmetries keep this honest:**

- A variant of a *blacklisted* name is never offered as a choice — adding "Premium" does
  not make it a different company, so it is auto-flagged and analysed immediately.
- Added words are classified. Ordinary corporate furniture (`Ltd`, `Ghana`) is benign,
  borrowed authority words (`Official`, `Premium`, `Investment`) are the real signal, and
  an unrecognised word usually means a genuinely different business — so
  **"Black Star Energy" is not treated as impersonating "Black Star Advisors"**. A fuzzy
  hit also has to survive an edit-distance check, which is what stops "Gold Trust" being
  accused of impersonating "Gold Coast Fund Management".

Entries the risk engine cached itself (`status: "unknown"`) are excluded from the index,
so one user's past query can never surface in another user's alert.

### Regulators are not investments

Querying a regulator used to return a risk verdict — `SEC Ghana` came back 🔴 10/10
CRITICAL. Two separate bugs caused that, and both are fixed:

- **The loose matcher matched fragments.** `core("SEC Ghana")` is `"sec"`, which
  substring-matched inside `"GAIP Securities Learning & Exchange Group"` — a blacklisted
  entity. `"Ghana Stock Exchange"` matched inside `"Quant Vest Stock Exchange"` the same
  way, so any innocent name sharing a fragment with a blacklisted one was flagged
  CRITICAL. Loose matching now runs in one direction only (a registered name appearing
  inside what the user typed, as whole words), and short forms belong in an entity's
  `aliases` instead.

- **Regulators were on no list**, so they fell through to `unregistered` and scored 7.5+.
  There is now an `authority` status covering SEC Ghana, Bank of Ghana, EOCO, NPRA, NIC,
  the Ghana Stock Exchange and the FIC, plus any `.gov.gh` domain. These get an
  information card — role, official site, contact — instead of a risk score, with a
  warning that anyone collecting money on their behalf is running a scam.

Two supporting rules make this hold. Our register's **status and name beat the model's**,
so it cannot relabel a regulator (or a blacklisted scheme). And **cached verdicts are
re-validated** against current evidence on every cache hit, so an answer stored before a
rule change cannot bypass the safety clamps.

---

## The "not sure" flow — evidence from the user

When no source knows an entity — no SEC record, no CoinGecko match, no contract, no
community reports — the verdict rests on the name alone. Rather than leave it there, the
bot asks for proof and re-runs the analysis with it.

- **Screenshots** are downloaded via Baileys and read by the vision model
  (`src/services/imageAnalyzer.js`) for return promises, recruitment language, fake
  payment proofs, urgency wording and missing licence numbers.
- **Links** are fetched and stripped with cheerio, then assessed
  (`src/services/urlAnalyzer.js`). Private and link-local addresses are refused, so a
  pasted URL cannot be used to probe the host or cloud metadata.
- **Forwarded text** is kept as extra context.

Up to 5 items; `done` produces the final report, `skip` keeps the original verdict.

> **Note on the trigger.** The spec called for this at a 4.0–6.0 "uncertain" score. In
> practice the AI follows the Act 929 rule in its system prompt and scores unregistered
> entities 7.5–8.5, so that window almost never occurs. The real trigger is therefore
> *absence of data*, not the score: if nothing corroborated the verdict, the user gets
> the report **and** an offer to improve it, and the report says plainly that an absent
> registration is a warning under Act 929 but is not itself proof of fraud.

---

## The evidence engine

`src/services/evidenceEngine.js` is the brain. **Rules decide; AI only extracts.**

The 9-step flow: extract → normalise → match (exact identifier first, then name,
then a tight fuzzy pass) → legal state → merchant registry → evidence tier → context →
reply from fixed templates → log.

Nothing it returns is a judgement. There is no score, no verdict, no colour and no
advice anywhere in the output — only a legal state, an evidence tier, reason codes, and
the sources behind them. If a claim is not backed by a Record citing a Source, it does
not appear.

**Evidence tiers** — how well evidenced, not how bad it looks:

| Tier | Means | Action |
| --- | --- | --- |
| 1 | A regulator published it | `warn` — the only tier shown to a customer |
| 2 | A member institution confirmed it, or a reviewed impersonation | `warn` / `warn_or_confirmation_call` |
| 3 | Three or more confirmed independent reports | `internal_review` |
| 4 | Rising check volume only | `watch` |
| null | Nothing meets a bar | `none` |

Volume alone never becomes evidence: twenty unreviewed reports about the same name
produce no tier and change nothing publicly. They open a review.

**Return promises** are measured against SEC Ghana's published thresholds (Notice
SEC/PN/002/07/2025): ≥6% monthly is a fraud indicator, rising to "maximum" at ≥70%.
"15% daily" is reported as 450% monthly against that threshold — a fact, not a verdict.

### AI is extraction only

`src/services/aiExtractor.js` reads screenshots and pages and reports what is literally
there: text, names, numbers, domains, return claims. It is never asked whether something
is a scam, how risky it is, or what to do.

Its output is treated as untrusted and is discarded when it contains a banned word
(`safe`, `scam`, `legitimate`, `recommend`, `trust`…) or states something absent from the
source text. Every extracted list is grounded against the material actually read.

### What was removed

`riskScore`, `riskVerdict` (LOW/MEDIUM/HIGH/CRITICAL), `riskColor`, `recommendation`,
`communityBoost` and `scoreBreakdown` are gone from the product. `riskEngine.js` and
`checkService.js` are deprecated and nothing routes through them; `aiAnalyzer.js` keeps
only its provider plumbing, which the extractors use. The WhatsApp reply was rebuilt to
match — it now states the legal position, the evidence behind it, who published it, and
what to go and ask.

---

## The AI analyzer (retired — kept for reference)

> The scoring system described below has been REPLACED by the evidence engine above.
> It is documented here only so the change is traceable. Nothing routes through it.

The AI model is the brain of the risk analysis. The backend gathers raw data from every
source, packages it into a structured prompt, and the model returns the score, verdict,
red flags with severities, SEC citations and a plain-language recommendation.

```
User sends "Ghana Vest"
        ↓
gatherEvidence()  — SEC register · CoinGecko · GoPlus · community reports
        ↓
buildUserPrompt() — all raw data in one structured prompt
        ↓
AI model  → score · verdict · red flags · recommendation · SEC citations
        ↓
validateAssessment() — safety rules enforced in code
        ↓
Bot formats and sends the WhatsApp reply
```

Qwench runs on **Google Gemini** (`gemini-2.0-flash`) by default — get a free key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) and put it in
`GEMINI_API_KEY`. `AI_PROVIDER` also accepts `groq` or `openai`; all three SDKs are
installed and the provider is chosen at runtime. The full system prompt lives as
`SYSTEM_PROMPT` in `src/services/aiAnalyzer.js`.

If `AI_MODEL` does not match the selected provider (for example a `llama-*` name left
behind after switching to Gemini), Qwench logs a warning and uses that provider's
default rather than 404-ing on every call and quietly falling back to rules.

**The model's output is policed, not trusted.** The prompt states hard rules, but a
language model can ignore them, so `validateAssessment()` enforces the ones that matter
and records every correction it had to make:

| Situation                                      | Enforced outcome        |
| ---------------------------------------------- | ----------------------- |
| SEC-blacklisted entity scored below 8           | raised to 8.0, CRITICAL |
| Unregistered entity scored below 2.5            | raised to 2.5           |
| Sandbox (provisional) entity scored below 3.5   | raised to 3.5, never green |
| Licensed entity with no complaints scored above 3 | lowered to 3.0       |
| Verdict that disagrees with the score           | realigned to the score  |
| Malformed score, flags or breakdown             | coerced or defaulted    |

**It never fails silently.** If the AI is down, rate-limited, returns unparseable text,
or has no API key, the check falls back to the deterministic rule-based model below. The
reply always says which produced it, and `ruleBasedScore` is returned alongside every AI
verdict so the two can be compared.

**Caching and audit.** Every call is written to the `AiAnalysis` collection with the
exact input, the output, latency and any corrections — that is both the 24-hour cache
(keyed on the entity slug) and the debug log. A repeat check inside 24h is served from
MongoDB without calling the model.

---

## How the rule-based score works

Factors add points, and the total is clamped to 0–10:

| Factor                     | Max | Notes                                                 |
| -------------------------- | --- | ----------------------------------------------------- |
| SEC Ghana status           | 5.0 | heaviest weight — licensed 0, unknown 2.5, blacklisted 5 |
| Market presence            | 2.5 | market cap < $100K, 24h volume < $10K, no site/socials |
| Community reports          | 2.0 | scales with how many Qwench users flagged it           |
| Age / track record         | 1.5 | a token under 30 days old is a real signal             |
| Promised returns & wording | 1.5 | "guaranteed", "double your money", "30% monthly"       |
| Contract security          | 10  | contract addresses only — GoPlus findings dominate     |

Rules that override the arithmetic:

- a **licensed** entity with fewer than 3 community reports is capped at 2.5, so it can
  never be shown as high risk
- a **blacklisted** entity is floored at 8.0, so a long operating history cannot score
  it down
- a **licence-revoked** entity is floored at 7.0
- a **sandbox** entity is floored at 3.5 and capped at 5.0 — provisional approval is not
  a licence, so it never shows a green badge that would read as "SEC approved"
- a **honeypot** contract is floored at 9.5

Bands: **0–3 🟢 LOW · 3–6 🟡 MEDIUM · 6–8 🟠 HIGH · 8–10 🔴 CRITICAL**

Two things are deliberately asymmetric:

- **Crypto** cannot hold an SEC Ghana licence, so a missing licence is not treated as a
  fraud signal. An established asset is judged on whether it really exists and trades.
- **Contract permissions** are weighted down for established tokens. USDT genuinely can
  pause transfers and freeze wallets, so those flags alone should not make a $180B asset
  look like a scam — but a honeypot finding is absolute either way.

A failed CoinGecko call is reported as "could not be checked", never as "this token does
not exist" — a rate limit is not evidence against a token.

---

## Configuration

Both directories ship a `.env.example`; copy to `.env`.

`Backend/.env`

```
MONGODB_URI=mongodb://127.0.0.1:27017/qwench
API_PORT=4000
PHONE_HASH_SALT=change-me-qwench-salt
WEB_APP_URL=http://localhost:5173

# AI analyzer — without a key the bot still works, on rule-based scoring
AI_PROVIDER=gemini                  # gemini | groq | openai
GEMINI_API_KEY=                     # free at aistudio.google.com/apikey
AI_MODEL=gemini-2.0-flash
AI_TIMEOUT_MS=25000
```

`GET /api/stats` reports which provider is configured and whether it is enabled, plus
AI call and failure counts.

`WhatsappBot/.env`

```
API_BASE_URL=http://localhost:4000
WEB_APP_URL=http://localhost:5173
AUTH_DIR=./auth
QR_SMALL=true          # false prints a larger QR
ALLOW_GROUPS=false     # true also answers in group chats
BAILEYS_LOG_LEVEL=silent
```

To force a new QR scan: `npm run logout` in `WhatsappBot/` (deletes `auth/`).

---

## Privacy

Reporters' phone numbers are never stored. `POST /api/report` hashes the number with
SHA-256 and a salt from `PHONE_HASH_SALT` before saving, and `GET /api/reports` excludes
the field entirely. Set a real salt in production.

---

## Known limits

- **Licence status changes over time, and this file is a snapshot.** SEC Ghana grants,
  suspends and revokes licences. An entity listed here as `licensed` may not be today.
  Re-check `sec-ghana.json` against the current register and public notices at
  [sec.gov.gh](https://sec.gov.gh) before anyone relies on a 🟢 result.

  In particular, verify **Gold Coast Fund Management** (licence revoked in 2019 after it
  became Blackshield Capital, leaving tens of thousands of clients unpaid), **HFC
  Investments** and **First Fund** — all three have changed status or ownership. The
  schema supports `status: "revoked"`, which floors an entity at 7.0 and is the correct
  value for a firm whose licence is gone.

- Conversation state is in memory, so restarting the bot resets everyone to the welcome
  flow.
- Qwench is an awareness tool, not financial advice.
