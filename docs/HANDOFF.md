# Qwench handoff: demo at 17:00, 2 November 2026

Written at about 08:40 GMT. Check `git log` and the open PRs first, because things may have moved since.

Read `AGENTS.md`, then `docs/spec/README.md`, then this file. Dre owns the backend and console. tiankay999 owns the WhatsApp bot, Telegram bot and public web app, so check with Dre before changing their areas.

## Where things stand

| Part | State |
|---|---|
| Backend `/v1` | On `main`. All 872 tests pass on `search-fixes` |
| Console | On `main`. Works in the browser |
| WhatsApp bot | Moved to `/v1` in PR #6, not merged. Never run on real WhatsApp |
| Short names and bank accounts | PR #7, not merged. Builds on #6 |
| Telegram bot | On `main`. Never run on Telegram, and needs a @BotFather token |
| Public web app | **Not connected to the API.** Search does nothing, and scores and report counts are mock data |

The local checkout is on `search-fixes`, which contains #6 and #7.

**Atlas data (real, and what `Backend/.env` points to):**
- 117 live records from SEC and Bank of Ghana notices: 91 warnings and 26 sandbox
- Dre told us to approve them all, so the audit log shows his account, but he didn't read each one
- 12 notices are still open for a person to read
- 2 demo records carry 5 demo identifiers: MoMo `0240000101`, `0550000102`, `0200000103` and bank `0000000000101`, `0000000000102`. Delete them before any real launch
- No real scheme numbers exist. The notices and public searches had none

## What to do, in order

### 1. Get answers from Dre
- **Can the web app work start?** It's tiankay999's area, so Dre should tell them first.
- **What should sandbox firms say?** Dre said they "can be deemed licensed". The wording hasn't changed, because the SEC says a licence comes after the sandbox. The recommendation is "approved to operate in the SEC's sandbox". The sentence is in `Backend/src/engine/report.js`, and it applies to all 26 firms.

### 2. Connect the web app (2 to 3 hours)
In `WebAPP/qwench`:
- `src/components/ui/SearchBar.tsx` has no handler: `onSearch` is declared but never used, and the button does nothing. Make it send the text to `POST /v1/public/check`.
- `next.config.ts` only rewrites `/v1/console/*`. Add `/v1/public/*`, or call the API directly, since CORS allows `http://localhost:3000`. The web channel needs no key.
- Show `report` in the order set in `Backend/docs/API.md`, leading with the evidence level. `TelegramBot/src/format.js` is a working example. Show `is_demo` and `did_you_mean` as well.
- Remove the mock data from the home page: `StatsRow`, `TrendingWarnings`, and the "risk score" and "verdict" wording in `HowItWorks`.
- Take Community, Blog and Dashboard out of the navigation. `/dashboard` says "Confirmed scam" about GoldVest International and rates Databank Ghana, a real-sounding company, from mock data. `/report/[slug]` shows made-up scores.
- Connect `/submit` to `POST /v1/public/reports`, or remove its link. It only takes a scheme name, identifiers and evidence links, with no free text.
- Replace the `wa.me/233XXXXXXXXX` placeholder, or remove it. Ask Dre for the bot's number.
- `WebAPP/qwench/AGENTS.md` warns that this Next.js version differs from what you may know, so read its guides first.

**Done when:** pasting the demo cases below shows the real report, and no page reachable from the navigation shows a score or fake figure.

### 3. Run the demo cases on bot, web and console (45 minutes)

| Input | Expected | Status |
|---|---|---|
| `yepbit` | Regulator warning | Works |
| `Daily Wealth Guide` | Bank of Ghana and SEC warning | Not run |
| `Vaulta`, `GoldBod` | Sandbox sentence, no warning | Not run by name. Yellow Card works |
| `GoldWave pays 5% a day, guaranteed. Tell nobody. Pay 0240000011` | No record, return check, warning signs | Works |
| `Daraz` | Must not match Darazz | Not run |
| `0240000101` in the console payment check | Demo warning, tier 1 | Not run with this number |
| `Mekanism` | Asks "Did you mean MEKANISM MARKETING LTD?" | Works |
| `yepbit.com` | The spec expects a warning, but **it finds nothing** | The SEC notice doesn't list that site, so don't add it as if it did. Demo the name |

### 4. Dre's steps
- Test WhatsApp on a real phone. He said "not yet" at 08:28, so remind him once. Set `CHANNEL_API_KEY` in `WhatsappBot/.env` to match `Backend/.env`, then run `npm install` and `npm start` in `WhatsappBot`, and scan the QR code.
- Merge #6, then #7. **#7 targets `whatsapp-v1`, so it must be changed to `main` first.**
- Restart the API. His running copy doesn't have the #7 code.
- Record the 60 to 90 second backup video, and take deck screenshots from the real screens.

### Suggested timeline
- By 12:00: web app done
- By 13:30: all demo cases pass, and everything merged
- By 15:00: video and screenshots done
- By 16:00: full rehearsal

## Present as "next", not live
Cases, the shared layer, the merchant registry, Brand Watch, OFAC, other regulators, reviewer alerts and partner numbers. Telegram too, unless it gets tested.

## Open, after the demo
- **OFAC:** Dre hasn't decided. Wallets only is recommended, over approving the whole list at once.
- **Reviewer alerts:** no channel chosen yet. Email is the simplest.
- **Approvals:** should one person be enough for a collected record, or two?
- **`/api`:** still returns unreviewed names and "risk score 9" entries. It also reloads the old list into the `investments` collection every time the API starts. Remove both after #6 merges, but only with Dre's approval. Keep it off any public address until then.
- **Record quality:** near-duplicates such as NovaCedi and Nova Cedi. Blackshield's notice is about its product. Some notices are old.
- **Misspellings:** "Yepbitt" finds nothing, because collected names have fuzzy matching off on purpose. Many lending app names are ordinary words.
- **Unread notices:** Bank of Ghana Notice 22 and the 2025-07 and 2022 SEC lists.
- **Atlas password:** Dre shared it in chat as temporary, so it needs changing when the project is done.

## Rules
- No scores, verdicts or advice. Our own wording never says "safe", "scam", "verified" or "fraudulent", except the sentence "This does not mean it is safe or unsafe."
- Public replies reveal only regulator and sanctions records, legal states and reviewed impersonation.
- Never invent records. Anything not from a real source is labelled demo.
- Don't log raw messages or phone numbers.
- Don't merge or deploy unless Dre asks. He runs `git push` himself.
- Never print the values in `Backend/.env`, and never commit it.

## Running things
```bash
npm --prefix ~/Projects/Qwench/Backend start
```
```bash
npm --prefix ~/Projects/Qwench/WebAPP/qwench run dev
```
The site is at http://localhost:3000 and the console at http://localhost:3000/console. Dre has a reviewer login, and new ones come from `node src/scripts/create-user.js` in `Backend`.

```bash
cd ~/Projects/Qwench/Backend && node --test --test-concurrency=6 "test/**/*.test.js"
```

## Traps we've already hit
- **`Backend/.env` is real data.** Any script run from `Backend` touches Atlas. Don't run `seed:demo` against it. For testing, use `mongodb-memory-server` with `MONGOMS_DOWNLOAD_DIR=/tmp/qwench-mongo`, and pass `MONGODB_URI` in the environment.
- **Audit real output, not just tests.** Fake AI and fake APIs in tests have hidden real bugs before.
- **Record changes must use `document.save()`.** The model refuses direct updates to status and review fields, on purpose. Don't work around it.
- **`gh pr edit --base` fails on this repo** with a Projects (classic) error. That's how #3 and #4 merged into `backend-v1` by accident, so confirm the base before merging. `gh api -X PATCH repos/tiankay999/Qwench/pulls/7 -f base=main` should work, but we haven't tried it.
- **`pkill -f` can kill your own shell,** because it matches its own command line. Kill by process ID.
- **`pnpm` isn't on the PATH.** `npm --prefix` works for starting things. If you need to install backend packages, Dre's earlier setup used a copy of pnpm 12 in `/tmp`, which may be gone.
- **The Next.js dev badge** covers the console's Log out button. This only happens on the dev server.
