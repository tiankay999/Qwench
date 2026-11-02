# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**The person about to send money.** Someone in Ghana with a payment screen already open — a MoMo transfer, a bank app, a WhatsApp conversation with a trader. They have a name, a number, a link or a flyer, and perhaps forty seconds before they decide. They are not researching; they are deciding. Many reach Qwench through WhatsApp or Telegram rather than the web, and arrive on the web only through a link somebody sent them.

**The person who was already caught.** They search a name to understand what happened, or to find out where to report it. The answer they need is a record and a hotline, not reassurance.

**The named business.** A firm that finds itself on a regulator's list, or whose name is being used by somebody else, arrives to see what Qwench publishes about it and to open an appeal. Qwench is adversarial to this reader by construction, so everything shown to them must be exactly what was shown to everyone else, sourced and dated.

**The institution evaluating Qwench.** A bank, a MoMo operator, a regulator or a judge assessing whether Qwench's output is defensible. They read the same public pages the first reader does. They are not a separate audience with a separate surface; they are the reason the first reader's page has to carry its sources.

## Product Purpose

Qwench is Ghana's fraud bureau. Its first product is Know Your Payee: before a payment goes, a person or an institution checks the recipient against schemes that regulators have named and that fraud institutions have confirmed.

Qwench answers one question — *what is on the record about this payee, and who published it* — and refuses the question people actually want answered, which is *is this safe*. Success is a person who reads a record, sees the publisher and the date, and makes their own decision, having been given no verdict to lean on.

## Positioning

The mechanism a neighbouring product could not truthfully copy is **restraint under evidence**. Qwench never scores, never ranks, never advises and never calls anything a scam. Every claim in a reply carries a publisher, a date and a link, and every reply says it is not a final ruling and can be appealed. A competitor that issues a risk score has made a claim it cannot defend to the business it just accused; Qwench has made only claims a regulator already published.

Four structural commitments hold that position:

- **Evidence levels, not verdicts.** The level grades how much evidence exists, never the scheme itself, and is set by fixed rules rather than by a model.
- **A report never changes a result.** A public report opens a review and nothing else, so the result cannot be brigaded.
- **Nobody can pay for a different result.**
- **"No record" is never a tell.** Everything Qwench is not allowed to reveal publicly returns a reply identical to the no-record reply, so silence carries no information.

## Operating Context

The decision happens on a phone, mid-payment, often on a slow or metered connection and frequently in bright outdoor light. The web app is one of three channels — WhatsApp and Telegram carry the same evidence in the same order — so a person comparing what a bot told them with what the website says must find the two identical.

A public check is anonymous. There is no account, no sign-in and no history; the dashboard is a watchlist kept in the browser, not a profile. Public endpoints are limited by IP rather than by identity.

Records reach the public only through a review pipeline: a regulator notice is collected on a schedule, a person captures it, and a **second** person who is not the capturer approves it before it can appear. Appeals return a reference and a due date, and answer only about what is publicly shown.

## Capabilities and Constraints

**What the product does:** checks a name, a phone number, a link, a wallet address or a flyer; returns a fixed-template report; accepts a public report of a scheme; accepts an appeal from a named business; publishes who its sources are.

**What it will never do:** block a payment, hold money, contact a suspect, or tell anyone what to do.

**Fifteen rules that cannot break**, in `docs/spec/README.md`. The ones that shape every surface:

1. No scores, verdicts or advice anywhere — not in `/v1`, the bots, the web app or the console. Evidence levels are permitted; they grade the evidence, never the scheme.
2. Qwench's own wording never says "safe", "scam", "verified" or "fraudulent". Exact regulator quotes are allowed. One sentence is allowed verbatim: *"This does not mean it is safe or unsafe."*
5. A public report can never change a public result.
7. Store what was checked, not who checked it. No raw queries, message text or phone numbers in the database or in logs.
14. MTN, banks and regulators are prospects, not partners. Never imply otherwise.
15. A public reply may reveal only regulator and sanctions records, legal states and reviewed impersonation. Anything else must be identical to a no-record reply.

**Terminology that is fixed by the running code**, and must not be re-coined:

- Seven **legal states**: `named_in_notice`, `licensed`, `sandbox`, `registered`, `authority`, `no_record`, `foreign_context`.
- Twelve **evidence levels**. Nine can reach a public reply: `regulator_warning`, `reviewed_impersonation`, `foreign_alert`, `many_signs`, `some_signs`, `on_regulator_list`, `regulator_or_public_body`, `registered_business`, `not_enough`. Three are members-only and are masked before a public reply is built: `member_confirmed`, `corroborated_reports`, `rise_in_checks`.
- Four **tiers** describing where evidence came from.
- The **report template** — state sentence, evidence level, sources, return check, warning signs, AI warning signs, link facts, foreign context, also checked, notes, questions to ask, disclaimer, footer — is written by the backend in a fixed order. A channel may add headings and icons to it. A channel may not summarise it, reorder it, or add a conclusion.

**AI's role is bounded.** It may extract details from an image or a linked page and spot red flags from a fixed list, with its proof checked. It never decides status, tier or wording, it cannot remove what the rules found, and what it spots is shown separately, labelled, and counted toward nothing.

**Undecided, and not to be invented:** there is no public endpoint listing entities and no public feed of reviewed records, so no page may show a register or a report feed until one exists.

## Brand Commitments

The name is **Qwench**. The mark is the Q with a forward-leaning cut; it exists as a wordmark, a standalone symbol and an app icon.

A brand sheet supplied by the team is binding on colour, typography and voice. It defines the primary blues, a five-step neutral ramp, four status colours, three typefaces (Plus Jakarta Sans for headings, Inter for body, Roboto Mono for numbers and identifiers) and clear-space, minimum-size and light/dark lock-up rules. Those values are recorded in `DESIGN.md`; brand ownership sits with Dre.

**Five voice rules**, from the same sheet: be factual and lead with evidence; be calm and reassuring; be clear and simple; respect the public; build trust, not fear. Its worked examples are consistent with Rule 2 — *"This number is linked to a scheme named in an SEC notice"* is the sanctioned form, *"This is a scam!"*, *"Your money is at risk!"* and *"Click this link now!"* are the rejected ones.

The tagline on the sheet reads *"Qwench fraud before it sends."* It is recorded as supplied. It sits in tension with Rule 3, because Qwench never stops a payment — the person does — and that is Dre's call to resolve, not the web app's.

Two of the sheet's status-colour **names** cannot be used as public labels, though the colours themselves are kept. "Partner-Confirmed" implies the partnerships Rule 14 forbids claiming, and in any case member confirmations never reach a public reply; "No Match Found" overstates a reply whose real wording is *"Not enough to go on."* The re-mapping is in `DESIGN.md`.

## Evidence on Hand

**Real, and usable as content:** 87 entities and 221 name identifiers seeded from published regulator material; 74 reviewed records; SEC Ghana, Bank of Ghana and sanctions-list sources with publisher, date and URL on each; the SEC Ghana hotline 0800 100 065 and the Cyber Security Authority short code 292.

**Known gaps that must not be papered over:** 83 records carry no verbatim notice quote. The sandbox window lapsed on 1 June 2026, so all 11 sandbox entities currently return `no_record` and the sandbox state cannot be seen in the product. `did_you_mean` can never fire on any channel, because `Entity.allowFuzzy` is set on 0 of 87 entities.

**Must never be fabricated:** partner or customer logos, institution endorsements, counts of sources or checks, testimonials, press, report feeds, trending lists, uptime or accuracy figures. Demo data is labelled as demo and is never presented as coming from MTN, a bank or a regulator; demo payment numbers use obviously fake values such as `+233240000000`.

## Product Principles

1. **Show the record, not a conclusion.** Every claim carries a publisher, a date and a link. Where Qwench has nothing, it says so plainly and says that this means nothing either way.
2. **The same evidence, in the same order, on every channel.** A person who checked on WhatsApp and then opened the website must find the two answers identical. Channels may differ in presentation; they may not differ in substance or sequence.
3. **Absence must look like absence.** Everything Qwench may not reveal looks exactly like having nothing, so that a withheld answer and an empty one cannot be told apart.
4. **The accused reader is a first-class reader.** Anything published about a business is published with its source and its route to appeal, because the business will read it and may contest it.
5. **Anonymity is a feature of the product, not a setting.** Nothing identifying the person checking is collected, stored or displayed, so nothing about them can be surfaced, sold or subpoenaed.

## Accessibility & Inclusion

The primary device is a mid-range Android phone, often held outdoors in direct sun, frequently on a slow connection. English is the interface language, read by people across a wide range of literacy and financial literacy; the copy must stay plain and must not assume the reader knows what a regulator, a licence or a sandbox is.

WCAG 2.1 AA is the floor: 4.5:1 for body text, 3:1 for large text and for the edges of controls and focus indicators. Because the evidence level is the single most important thing on a report, it may never be carried by colour alone — it needs its words and its mark as well. Pages must stay usable at 200% zoom and under a forced-colours setting, and every state must be reachable and legible from a keyboard.
