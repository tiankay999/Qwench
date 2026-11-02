# Qwench build spec v1

**Stack:** Express, MongoDB and Baileys (existing), plus Next.js for the web app and console.
**Track:** Transparency and Digital Infrastructure.

**Decisions built in:**
- No public score or advice.
- Reports stay internal.
- The web app starts from the Next.js starter page.

## Be realistic about scope
All four additions can be real features, but **partner data won't exist for the hackathon demo**. Use real regulator records where you have them, and mark anything else **"Demo data"**. Never present seeded data as coming from MTN or a bank.

This is roughly **50–70 engineering hours**, so it probably won't all fit before submission. The cut line is in section 12.

## 1. What to do first

| Order | Task | Why |
|---|---|---|
| **1** | Freeze this spec, and assign owners | Stops people building different things |
| **2** | Data model (section 3) | Everything reads from it |
| **3** | API contract (section 5) | Frontend and backend can then work in parallel |
| **4** | Collect and review the data (section 2) | This can start now, alongside task 2 |
| **5** | Evidence engine (section 4) | Every channel depends on it |
| **6** | WhatsApp bot and public web app | Your must-haves |
| **7** | Bank API and console | The product banks buy |
| **8** | Cases, shared layer, merchant registry, Brand Watch | Built on the above |
| **9** | Video, screenshots, final deck | They must show what's actually built |

## 2. Data

### Sources
| Source | Collection method | Used for |
|---|---|---|
| SEC notices, sandbox announcements | Collected automatically, then a person approves each record | Tier 1 and legal states |
| SEC licensed list | By hand, then reviewed | Legal states |
| Bank of Ghana notices, including unlicensed lending apps | Collected automatically, then a person approves each record | Tier 1 |
| Bank of Ghana registers | By hand, then reviewed | Legal states |
| CSA alerts | By hand, then reviewed | Tier 1 and impersonation links |
| ASIC list, OFAC list | Downloaded files | "Found abroad", sanctions, wallets |
| RDAP, Wayback Machine | Lookups, cached | Context only |
| Bot and web checks | Automatic, without identities | Signal |
| TikTok and Telegram links | Forwarded by users; public posts reviewed by hand | Signal and reports |
| Members' contributions | Console form | Shared layer |
| Merchants | Registration with proof of ownership | Registry |

**Not used:** Truecaller data, automated TikTok scraping, reviews, and news reports treated as facts.

**Collecting regulator notices:** collectors read each regulator's public notices on a schedule, apart from checks, so a slow regulator site can't slow a check. Checks only read Qwench's own database. Everything collected starts as a pending record, hidden from checks, with a saved copy and fingerprint of the original. A person approves each one. Nothing goes live automatically. A notice the collector can't read clearly goes to a person.

**Lending apps:** app store links are identifiers (`app_id`), matched exactly. App names are matched exactly too, because many are ordinary words. Asking for your contacts or personal data is a warning sign, not a finding.

**CoinGecko and GoPlus:** remove both from public replies. Keep GoPlus only as labelled context for contract addresses, and check its terms.

### Data tasks
- Move `sec-ghana.json` into the new collections.
- For every record, add the **notice link, publication date, exact quote, who captured it and who reviewed it**.
- Add Daily Wealth Guide and the Darazz and Hut 8 cases.
- Check "Yepbit Trading" against the SEC notice.
- Add every website, wallet and number that appears in a notice.
- Protect names shared with real companies, such as Dallmayr, Daraz and Hut 8, with exact matching only.

## 3. Data model (MongoDB)

| Collection | Key fields | Rules |
|---|---|---|
| **sources** | publisher, type, title, url, publishedOn, retrievedAt, archiveUrl, isOfficial | Required by every record |
| **entities** | name, slug, kind (platform, company, token, app, merchant, authority), country, allowFuzzy, isDemo | Replaces `Investment` |
| **identifiers** | entityId, type (name, domain, momo_number, bank_account, wallet, social_handle, telegram_link, tiktok_handle, merchant_id, app_id), raw, normalized, valueHash, allowFuzzy, origin (notice, partner, merchant, review, legacy), isDemo | Numbers in +233 format. Partner data, and any number not published in a notice, stored as keyed hashes only |
| **records** | entityId, sourceId, type (warning, licence, sandbox, registration, foreign_alert, sanction), jurisdiction, licenseType, quote, effectiveOn, endsOn, status (pending, active, expired, withdrawn), capturedBy, reviewedBy, reviewedAt, isDemo | **Active needs a source, a quote, and a reviewer different from the capturer** |
| **relations** | fromEntity, toEntity, type (impersonates, claims_affiliation, renamed_from, same_operator), sourceId, status, capturedBy, reviewedBy, reviewedAt | An active impersonation needs a second reviewer. Real companies appear only as impersonated |
| **organizations** | name, type (bank, momo, psp, vasp, merchant, regulator, qwench), status, confirmationCallLimitGhs, warnsOnPartnerData, isDemo | |
| **users** | orgId, email, passwordHash, role (analyst, org_admin, reviewer, regulator) | Team login only; no public sign-up |
| **apiKeys** | orgId, keyHash, prefix, scopes, rateLimit, revokedAt, lastUsedAt | Store a keyed hash only |
| **check_events** | hourBucket, channel, inputType, identifierHashes, matchedEntityIds, state, tier, flags, outcome, isDemo | **No raw query, no sender and no exact time** |
| **senderDays** | senderHash, day, count, expiresAt | Fair-use limit only. Daily salt; deleted after 24 hours |
| **contributions** | orgId, schemeName, identifiers, terms, region, lossBand, evidenceRefs, reviewStatus, isDemo | Scheme details only |
| **publicReports** | schemeName, identifiers, source, evidenceRefs, reviewStatus, expiresAt | Never shown publicly; replaces `Report`. Unconfirmed reports expire after 90 days |
| **signals** | key, weekStart, checksThisWeek, checksLastWeek, distinctSources, anomalyFlag, reviewStatus | Worked out from `check_events` |
| **cases** | caseNumber, type (scheme, impersonation), trigger, identifiers, checks[], evidenceRefs, tier, status, referrals[], outcome, ownerId | Every change logged |
| **merchants** | entityId, legalName, verificationMethod, documentRefs, officialIdentifiers, status, verifiedBy, verifiedAt, renewalDue | "Registered by the business", never "safe" |
| **brandWatches** | orgId, brandName, officialDomains, officialNumbers, keywords, status | |
| **brandFindings** | watchId, platform, url, claimedName, identifiersFound, firstSeen, evidenceRefs, reviewStatus, takedownStatus | Public content only |
| **appeals** | identifierHash, contact, reason, status, dueDate, resolution | Contact details deleted after closure |
| **auditLog** | actor, action, target, before, after, timestamp | For tier, record and case changes |

## 4. Evidence engine

Replace the scoring in `riskEngine.js` with this flow:
1. **Extract** names, domains, numbers, wallets, returns and warning signs, using rules first. Gemini may help extract, but it never decides.
2. **Normalise** numbers, domains and homoglyphs.
3. **Match** exact identifiers first, then names. Keep `nameVerifier.js`, tighten its threshold, and return close matches as "Did you mean?".
4. **Work out the legal state** from active records only, in this order: named in a notice → licensed → sandbox → registered → no record.
5. **Check the merchant registry** for impersonation.
6. **Work out the evidence tier** (below).
7. **Add context:** foreign alerts, the return check, warning signs, domain age.
8. **Write the reply** from fixed templates. Any AI explanation is labelled, and is discarded if it contains a banned word or a fact not in its source.
9. **Log** without identities or raw text.

**Remove:** `riskScore`, `riskVerdict`, `riskColor`, `recommendation`, `communityBoost`, the sandbox score limits, AI status decisions, and AI-derived entries in the main table.

### Evidence tiers
| Tier | Basis | Reason code | Allowed use |
|---|---|---|---|
| **1** | Regulator notice or sanctions list | `REGULATOR_NOTICE`, `SANCTIONS_LIST` | Customer warning |
| **2** | Partner-confirmed fraud, or a reviewed impersonation | `PARTNER_CONFIRMED`, `ADVERTISED_AS_BUSINESS_NOT_REGISTERED` | Partner-confirmed: internal review, or a warning where partners agree. Reviewed impersonation: shown publicly |
| **3** | Independent reports with evidence | `CORROBORATED_REPORTS` | Internal review |
| **4** | Rising checks only | `CHECK_SPIKE` | Watch |
| **None** | A single public report | None | Not shown; opens a review |

**Sandbox, licensed and authority results** are legal states, never warnings.

## 5. API contract

**Public channels:** `POST /v1/public/check`, used by WhatsApp, Telegram and the web app. Rate-limited.

**Institutions** (API key required):

| Endpoint | Purpose |
|---|---|
| `POST /v1/check` | Check a recipient |
| `GET /v1/feed?since=` | New and changed reviewed regulator records, as JSON or CSV. Partner numbers never appear here |
| `POST /v1/contributions` | Share scheme details |
| `GET /v1/signals` | Rising names, after review |
| `GET /v1/cases/:id` | Case status |
| `POST /v1/merchants/verify-number` | Is this number a merchant's registered number? |

**Request:**
```json
{ "recipient": "+233241234567", "type": "momo_number", "amount_ghs": 800, "new_payee": true }
```

**Response:**
```json
{
  "match": true,
  "entity": "YepBit",
  "state": "named_in_notice",
  "tier": 1,
  "reason_codes": ["REGULATOR_NOTICE"],
  "sources": [{ "publisher": "SEC Ghana", "date": "2026-07-15", "url": "..." }],
  "allowed_use": "customer_warning",
  "suggested_action": "warn",
  "checked_at": "2026-11-01T10:00:00Z"
}
```

- **`suggested_action`:** `warn`, `warn_or_confirmation_call` (tier 1, new payee, above the institution's limit), `internal_review`, `watch` or `none`.
- **Errors:** 400 invalid input, 401 bad key, 403 not allowed, 429 too many requests, 500 server error.
- **Never returned:** scores, advice, or the identity of whoever contributed or checked.

## 6. WhatsApp and Telegram bots

**WhatsApp changes:**
- New welcome message, without "tell you if it's safe".
- Remove the score, the recommendation, public trending and the report count.
- Add the first-use privacy line.
- Accept TikTok and Telegram links and screenshots, and pull out what the scheme uses.

**Reply order:**
1. State sentence
2. Sources and dates
3. Return check
4. Warning signs
5. Questions to ask
6. Footer: data date, SEC 0800 100 065, CSA 292, "Information, not advice."

**Telegram:** the same flows, using the Bot API.

**Baileys:** keep it for the demo, and move to the WhatsApp Cloud API before pilots.

## 7. Public web app (Next.js)

| Page | Contents |
|---|---|
| `/` | Paste box, then the same report as the bot |
| `/report/[id]` | Shareable dated report, without the pasted text |
| `/report-scheme` | Public report with evidence, and links to CSA 292 and MTN 419 |
| `/appeal` | Challenge a flag |
| `/about` | Sources, method and data protection |
| `/for-business` | Merchant registration and the bank API overview |

## 8. Bank console (Next.js, `/console`)

| Module | Function |
|---|---|
| **Login and roles** | Organisation accounts, with role-based access |
| **Lookup** | Identifier, state, tier, reason, sources, member reports, signal, allowed use |
| **Payment check** | A real `/v1/check` call beside a mock warning screen |
| **Daily feed** | Table, filters, CSV and JSON |
| **API docs and keys** | Reference, plus creating and revoking keys |
| **Review queue** | Qwench staff approve records and reports; no self-approval |

Show honest empty states: *"No member reports yet."*

## 9. The four additions

### Cases
- **Opens automatically when:** there are 3+ independent sources with evidence, a public signal matches a member report, a check spike is flagged, or a number is advertised under a registered business's name.
- **Status flow:** open → under review → referred → confirmed or dismissed → closed.
- **Checks:** licence registers, claimed affiliations, website age, links to earlier cases, the offer's terms, and asking the *victim business* on its registered number.
- **Never:** call, message or pay a suspect.
- **Output:** an evidence pack for the CSA, SEC, Bank of Ghana or law enforcement. A regulator notice moves the case to tier 1. Unconfirmed cases fade.
- **Screens:** case list, case detail, evidence pack, referral record.

### Shared layer
- **Contribute:** scheme name, website, wallet, hashed payment number, terms, region, loss range.
- **Never shared:** customer details, suspicious transaction report contents, or who contributed.
- **Matching:** keyed hashes (HMAC). Show "reported by 3 members".
- **Protection:** count independent organisations, require review, flag spikes.
- **Credits:** record verified contributions for later fee discounts.
- **For the demo:** demo organisations and data, clearly labelled.
- **Legal:** a data-sharing agreement template is needed before real data.

### Merchant registry
- **Register:** business details and official numbers, merchant IDs and domains.
- **Prove ownership:** company registration, a merchant account in the business's name, or bank confirmation. A person approves it.
- **Results:** "Registered by [business]", or "Advertised as [business], but not one of its registered numbers".
- **No claim** when a business isn't registered. Registered merchants are never flagged automatically.
- **Screens:** registration, review queue, merchant dashboard.

### After the hackathon: official registry
**Don't build this yet.** Until then, the feature, the code and the pitch all stay "merchant registry". The aim is to extend it so people can ask whether an offer really came from a company. Qwench never calls an offer "legitimate". It reports these facts:

| Question | How it's checked | Example reply |
|---|---|---|
| Is this contact theirs? | Compare the number, website or social handle with what the company registered | "This number is registered by [Company]." |
| Did they publish this offer? | Compare it with the company's current listed offers | "[Company] lists this offer, reference 123. Qwench hasn't assessed this offer." |
| Are they allowed to operate? | Regulator records | "[Company] is licensed by the SEC as a fund manager." |
| Does the company know about it? | Ask the company on its registered contact, through a case | After a person reviews it: "[Company] told us this offer isn't theirs." |

- **Contact decides first:** a scheme can copy a real offer's wording or reference. If the contact isn't registered to the company, the mismatch is what's shown, even if the offer is listed.
- **Unregistered companies:** make no negative claim. Say "[Company] hasn't registered its contacts with us, so we can't confirm this."
- **Limits of a licence:** a licence says the firm may operate, not that a given offer came from it.
- **Limits of registration:** a registered channel can be taken over, so registration doesn't prove a given message is genuine.
- **Offer upkeep:** listed offers need end dates, and companies must renew their entries.
- **Who can register:** the same proof of ownership and human approval as the merchant registry, plus a named contact.
- **Asking a company:** Qwench may contact the company being impersonated, and never the suspect.
- **Brand Watch:** it reads official contacts from the same registry, so companies keep one list.
- **Cost to customers:** the public check stays free, companies pay to be listed, and Know Your Payee uses the same comparison at payment.
- **Needs before building:** a legal review of "lists this offer" under Act 1154, so it can't read as an endorsement or advice.

### Brand Watch
- **Setup:** brand name, official domains and numbers, keywords.
- **First sources:** bot and web checks mentioning the brand, user-forwarded links, look-alike domain checks, and findings logged by a reviewer.
- **Later:** certificate logs, Google listing APIs, Meta and TikTok brand tools, app stores.
- **Flow:** finding → review → alert → takedown pack → status tracked. It can also open a case.
- **Limits:** public content only, official APIs, acting on the brand owner's authority, no private chat scanning.

## 10. Security and data protection
- API keys and console login required; passwords and keys stored hashed.
- CORS limited to your own domains; rate limits on all endpoints; input validation.
- `PHONE_HASH_SALT`, `HMAC_SECRET_KEY` and `JWT_SECRET` required at start-up, with no default values.
- No raw queries, phone numbers or message text in the database or logs.
- **Retention:** sender hashes 24 hours, unconfirmed reports 90 days, checks summarised after 12 months. Decide evidence-file retention with your lawyer.
- Audit log on all reviews and tier changes.
- Before launch: Data Protection Commission registration, data-sharing agreements and legal review.

## 11. Acceptance tests

| Test | Expected |
|---|---|
| yepbit.com | SEC warning with date and link; tier 1; no score |
| Daily Wealth Guide | Bank of Ghana and SEC warning |
| Vaulta or GoldBod | Sandbox sentence; no warning or red flag |
| GoldWave offer | No record, "does not mean it is safe or unsafe", return check, warning signs |
| Daraz | No match to Darazz |
| A notice-listed identifier | `/v1/check` returns tier 1 and its source |
| Unknown number | `match: false` |
| Missing API key | 401 |
| 20 reports from one source | No public change; flagged for review |
| Reports against a registered merchant | Sent to a person; never automatic |
| Unregistered number advertised as a registered merchant | Impersonation warning, after review |
| Banned words | None in Qwench's own wording |
| Database inspection | No raw message or phone number |

## 12. Work plan

See the workplan files in this folder. Current owners are in [README.md](README.md), along with where the code on `main` already differs from this spec.

### If time runs out, protect these in order
1. **Must:** data, evidence engine, bot, public web app
2. **Then:** `/v1/check`, console lookup and payment check
3. **Then:** daily feed
4. **Then:** cases and shared layer
5. **Then:** merchant registry and Brand Watch
6. **Then:** Telegram

**Anything not built by the feature freeze goes in the video and deck as "next", not as live.**

## 13. Using an AI video for the demo

**Recommended approach:** record your **real screens**, then use AI for the voice-over and editing.
- Keep it to 60–90 seconds.
- Don't generate fake product screens. If it shows something unbuilt, label it **"Concept"**.
- Have the live link ready in case the panel asks to try it.
