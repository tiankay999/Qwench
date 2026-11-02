# Workplan: bots, web app and console

**Goal:** all three surfaces show the same evidence from the API. The compliance fix comes first.

Dre styles the screens afterwards, so build plain, working screens with simple shared
styles. Dre owns the backend, and the API format is in `docs/API.md` once written.

| # | Area | Task | Done when |
|---|---|---|---|
| 1 | WhatsApp | Remove the risk score, recommendation, CoinGecko data, public trending and report counts | The Vaulta reply shows no score or red flags |
| 2 | WhatsApp | Fix `messages.js`, and write a new welcome and first-use privacy line | "Safe" and "Recommendation" no longer appear in our wording |
| 3 | WhatsApp | Use fixed reply templates: status, sources and dates, return check, warning signs, questions to ask, footer | Every reply follows the same order |
| 4 | WhatsApp | Move every route in `WhatsappBot/src/api.js` to `/v1` | No bot call uses `/api` |
| 5 | WhatsApp | Accept forwarded messages and TikTok and Telegram links | Names, numbers and links are pulled out |
| 6 | Web app | Build the home page: paste box, then the same report as the bot | The Next.js starter page is gone and YepBit shows its SEC warning with date and link |
| 7 | Console | Build the lookup screen | It shows the state, tier, reason, sources and allowed use |
| 8 | Console | Build the payment check: a real API call beside a mock warning screen | A number found in a notice returns tier 1 with its source |
| 9 | Console | Build the daily feed screen | The table loads from the feed |
| 10 | Telegram | Reuse the same flows through the Bot API. Built by Dre's side in `TelegramBot/` on `telegram-v1`, calling `/v1` | The five demo cases work with a real token, or it's marked "Next" |
| 11 | Handoff | Tell Dre the screens are ready to style | Plain, working screens with shared styles |
| 12 | Backup | Record a 60–90 second demo after styling | The video is saved in case Wi-Fi or the bot fails |

**Console status:** Dre had the console built on the `console-v1` branch (`a55e5b7`), so items 7, 8 and 9 are done there. Don't start them again. It lives in `src/app/console/`, `src/components/console/` and `src/lib/console.ts`. Set `QWENCH_API_URL` to the backend's address.

## Route mapping

| Old route | New route |
|---|---|
| `/api/check` | `POST /v1/public/check` |
| `/api/verify-name` | `did_you_mean` in `POST /v1/public/check` |
| `/api/evidence/image` | Image field in `POST /v1/public/check` |
| `/api/evidence/url` | `urls` field in `POST /v1/public/check` |
| `/api/report` | `POST /v1/public/reports` |
| `/api/trending` | Removed from public replies |
| `/health` | Stays |

The request format, reply fields and curl examples are in `Backend/docs/API.md`. `skipConfirmation`, `pending_records` and `return_check.warning` are gone. When someone picks a `did_you_mean` suggestion, send that name as a new check.

## If time runs out, cut in this order

1. Telegram
2. Link and forwarded-message reading
3. Console feed screen
4. Other web pages, such as `/report`, `/appeal` and `/about`

## Rules

- Don't log raw messages or phone numbers.
- Don't write "safe", "scam" or a score in Qwench's own wording.
- Label anything seeded as "Demo data".
- Stay on Baileys for the demo.
- The prototypes in `Prototypes/` are visual references only. Their scores, risk levels and "Don't send money" wording must not be carried over.
