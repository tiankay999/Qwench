---
name: Qwench
description: Ghana's fraud bureau — a public register you read before you pay.
colors:
  action: "#0B6BFF"
  action-text: "#0A57CC"
  action-dark: "#4D94FF"
  beam: "#60D4FF"
  ink: "#081B38"
  ink-soft: "#1F2A44"
  muted: "#4B5563"
  faint: "#64748B"
  hairline: "#E5E7EB"
  edge: "#7E8B9E"
  canvas: "#F7F9FC"
  surface: "#FFFFFF"
  sunken: "#EEF2F7"
  canvas-dark: "#081B38"
  surface-dark: "#0F2A4F"
  sunken-dark: "#0A2140"
  paper-dark: "#F1F5F9"
  dim-dark: "#A9B8CC"
  faint-dark: "#8FA2BA"
  hairline-dark: "#1E3A5F"
  edge-dark: "#5181B8"
  named: "#1E3A8A"
  named-tint: "#E6EDFB"
  named-ink: "#16327A"
  named-tint-dark: "#15294F"
  named-ink-dark: "#A8C3FF"
  reviewed: "#7C3AED"
  reviewed-tint: "#F1E9FE"
  reviewed-ink: "#6A27D4"
  reviewed-tint-dark: "#271A45"
  reviewed-ink-dark: "#CDB4FF"
  signs: "#F59E0B"
  signs-tint: "#FDF0DC"
  signs-ink: "#8A5A00"
  signs-tint-dark: "#3A2A10"
  signs-ink-dark: "#FBBF24"
  listed: "#0E7490"
  listed-tint: "#DFF1F5"
  listed-ink: "#0B5F78"
  listed-tint-dark: "#0C2E38"
  listed-ink-dark: "#5FD8EC"
  none: "#94A3B8"
  none-tint: "#EEF1F5"
  none-ink: "#53647C"
  none-tint-dark: "#16263D"
  none-ink-dark: "#A9B8CC"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3.8vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.6vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 1.3rem + 1.4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.022em"
  section:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  body-lead:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.004em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  body-small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.002em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
    fontFeature: "'tnum' 1, 'zero' 1"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
  "24": "96px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.action-text}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.action-text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  input-check:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lead}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
    height: "60px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  evidence-panel:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
  state-badge-named:
    backgroundColor: "{colors.named-tint}"
    textColor: "{colors.named-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  state-badge-reviewed:
    backgroundColor: "{colors.reviewed-tint}"
    textColor: "{colors.reviewed-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  state-badge-signs:
    backgroundColor: "{colors.signs-tint}"
    textColor: "{colors.signs-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  state-badge-listed:
    backgroundColor: "{colors.listed-tint}"
    textColor: "{colors.listed-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  state-badge-none:
    backgroundColor: "{colors.none-tint}"
    textColor: "{colors.none-ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  source-line:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.mono}"
    padding: "0"
---

# Design System: Qwench

## Overview

**Creative North Star: "The Public Register"**

A register is a bound book of records kept by a bureau. Each entry names who published it and when. Anyone may read it; nobody may edit it by shouting; a party who thinks an entry is wrong files to have it corrected. It does not grade the entries, rank them, or tell the reader what to do with them — it keeps them, legibly, and lets the reader draw their own conclusion. That is precisely what Qwench is, and the interface should feel like consulting one rather than consulting an oracle.

This has a direct consequence for how the pages are built. Qwench's core surface is a **Read** surface: the visitor came to understand something, so the page is first a document of its kind. The frame — masthead, ground, section openers, the way sources and identifiers are set — carries the brand fully and could belong to no other product. The reading column inside it stays calm: a real measure, real contrast, nothing performing behind the text. The forms (`/report-scheme`, `/appeal`) and the watchlist are **Operate** surfaces where the same palette and type serve standard, boring, recognisable controls.

The hardest discipline here is a negative one. Every visual convention this category reaches for is a verdict in disguise: the gauge, the red-amber-green band, the shield, the big green tick, the score out of ten. Qwench is legally and editorially committed to issuing no verdict, so none of that vocabulary is available — not softened, not relabelled. The design has to make a person feel informed without ever letting them feel *told*. Restraint is not this system's taste; it is its argument.

**Key Characteristics:**

- A document, not a dashboard. The report reads top to bottom in one column, in the backend's fixed order.
- Status colours that are categorically distinct and deliberately not a scale.
- Every claim visually bound to its publisher and date, in monospace.
- Flat by default; depth only where something genuinely floats.
- Dark navy as a composed theme for a phone used outdoors, not an inverted light theme.
- No green, no tick, no gauge, no number that could be read as a score.

**Confirmed anti-references:** the prototype's own risk gauge, "HIGH RISK" verdict banner and `--safe: #2ecc71` token, all removed in the Section 7 pass. They are the shape this system exists to prevent, and nothing resembling them returns.

**The frame.** The masthead and the home band keep a dark navy ground in both themes — the register's cover — running `#081b38 → #0a2f6e → #0a4aae` on the 118° diagonal the mark's tail travels, with one angled Beam wash at 12% and no radial glow. The brightest stop is capped where it is so that secondary text on the band still measures 4.69:1 once the wash is composited over it. Inside that frame the reading column reverts to the light grounds and stays calm.

**Still open.** Section cadence below the home band, imagery, and the signature move are not yet set. Nothing below should be read as having chosen them.

## Colors

A navy-and-blue system in which the blue is reserved for things the reader can *do*, and a separate, deliberately unrelated set of hues carries what the record *says*. The neutrals are cool and faintly blue so that navy ink sits on them without looking warm.

### Primary

- **Action Blue** (`#0B6BFF`): the one colour a reader may interpret as "press this". It fills the primary button, draws the focus ring and marks the current navigation item. It is never used for a status, a legal state or an evidence level. At body size on the tinted canvas it measures 4.37:1 and therefore fails AA, so it is a fill colour and a large-text colour only.
- **Action Blue Text** (`#0A57CC`): the darkened form used wherever Action Blue would be body-size text — links in prose, inline actions, the "appeal this" route. 6.13:1 on canvas, 5.75:1 on the sunken panel.
- **Beam** (`#60D4FF`): the brand's light cyan, from the cut in the Q. At 1.61:1 on white it can never be text in the light theme. It earns its place as a dark-theme link and accent (10.10:1 on the dark canvas), as the mark's own colour, and as a thin rule or underline in the frame.

### Secondary

The status hues are secondary, and they are described in full under **Status** below rather than here, because their roles are semantic rather than decorative.

### Neutral

- **Ink** (`#081B38`): the brand's darkest navy. Body text and headings in the light theme (17.15:1 on white), and the whole canvas in the dark theme. It is the ink *and* the ground, which is what keeps the two themes feeling like one product.
- **Ink Soft** (`#1F2A44`): headings on tinted grounds and the footer's ground, where full Ink would be too hard an edge. 14.26:1 on white.
- **Muted** (`#4B5563`): secondary prose, the meaning line under an evidence level, source publishers. 7.56:1 on white, 6.72:1 on the sunken panel.
- **Faint** (`#64748B`): labels, timestamps, the smallest metadata. 4.51:1 on canvas — exactly at the floor, which is why it is the lightest text colour in the system and why it never goes on the sunken panel.
- **Edge** (`#7E8B9E`): the border of anything a person can operate — input, select, checkbox, secondary button. 3.46:1 on white, so it meets the 3:1 floor for control edges.
- **Hairline** (`#E5E7EB`): decorative dividers only, between list items and sections. At 1.24:1 it carries no meaning and must never be the only thing marking a control.
- **Canvas** (`#F7F9FC`), **Surface** (`#FFFFFF`), **Sunken** (`#EEF2F7`): the three light grounds — the page, a card lifted off it, and a panel pressed into it. The evidence level block uses Sunken; it is set *into* the document, not laid on top of it.
- **Dark theme grounds** — Canvas `#081B38`, Surface `#0F2A4F`, Sunken `#0A2140` — with **Paper** `#F1F5F9` (13.09:1 on Surface), **Dim** `#A9B8CC` (7.11:1), **Faint Dark** `#8FA2BA` (5.49:1), **Hairline Dark** `#1E3A5F` and **Edge Dark** `#5181B8` (3.54:1 on Surface).

### Status

Five roles. They map the nine publicly reachable evidence levels, and they are the only colours in the system that carry meaning.

| Role | What it covers | Solid | Light tint / ink | Dark tint / ink |
|---|---|---|---|---|
| **Named** | `regulator_warning` — a Ghana regulator or sanctions list has named this | `#1E3A8A` | `#E6EDFB` / `#16327A` (10.09:1) | `#15294F` / `#A8C3FF` (8.15:1) |
| **Reviewed** | `reviewed_impersonation` — two people at Qwench reviewed it | `#7C3AED` | `#F1E9FE` / `#6A27D4` (6.25:1) | `#271A45` / `#CDB4FF` (8.76:1) |
| **Signs** | `many_signs`, `some_signs`, `foreign_alert` — signs or a foreign alert, no Ghana regulator record | `#F59E0B` | `#FDF0DC` / `#8A5A00` (5.27:1) | `#3A2A10` / `#FBBF24` (8.28:1) |
| **Listed** | `on_regulator_list`, `regulator_or_public_body`, `registered_business` — the name appears on a list | `#0E7490` | `#DFF1F5` / `#0B5F78` (6.17:1) | `#0C2E38` / `#5FD8EC` (8.55:1) |
| **Nothing** | `not_enough` — no regulator record and no warning signs | `#94A3B8` | `#EEF1F5` / `#53647C` (5.32:1) | `#16263D` / `#A9B8CC` (7.55:1) |

Three of the five come straight from the brand sheet. **Listed** (`#0E7490`) is new: the sheet has no colour for "this name is on a list", and the obvious choice — green — is the one colour this product may never use. It is derived from Beam, darkened until it reads as information rather than approval.

Two of the sheet's names are not used as labels, though its colours are. `#7C3AED` is labelled **Reviewed**, not "Partner-Confirmed": Rule 14 forbids implying partnerships, and member confirmations never reach a public reply at all, so the only Tier-2 finding a visitor can ever see is reviewed impersonation. `#94A3B8` is labelled from the backend's own wording, **"Not enough to go on"**, not "No Match Found" — Qwench did not fail to find a match, it found nothing that tells you either way, and the difference is the whole point of the reply.

Amber is the trap in this set. `#F59E0B` measures 2.04:1 as text and 2.15:1 under white, so it fails both ways: it is a *fill* that carries dark ink (`#081B38` on it is 7.99:1), and the Signs label in prose is `#8A5A00`, never the raw amber.

### Named Rules

**The Flat Spectrum Rule.** The five status colours are categorical, never ordinal. They may not be arranged into a gradient, a ramp, a traffic light, a meter, a sorted legend or any sequence that implies one is worse than another — because a sequence *is* a score, and a score is the one output this product does not produce. Navy, violet, amber, teal and grey were chosen partly because they refuse to form a scale. The audit test: if a reader could rank the five by looking at them, the implementation is wrong.

**The No Approval Rule.** Nothing in this system renders approval. No green at any lightness, no tick mark, no shield, no badge ribbon, no padlock, no "trusted" chrome. "On a regulator's list" is a fact about a list, not an endorsement, and it must never be dressed as one. This extends to the one sentence the product is allowed to say about safety — *"This does not mean it is safe or unsafe"* — which is set in Muted body text like any other note, never highlighted, never in a callout.

**The Action Blue Rule.** `#0B6BFF` belongs to actions and to nothing else. The moment a status, state, tier or evidence level is painted in it, the reader has been handed Qwench's opinion dressed as a button.

## Typography

**Display Font:** Plus Jakarta Sans (with `system-ui`, sans-serif)
**Body Font:** Inter (with `system-ui`, sans-serif)
**Label/Mono Font:** Roboto Mono (with `ui-monospace`, monospace)

**Character:** Plus Jakarta Sans is a geometric sans with slightly humanist terminals — contemporary and confident without being corporate, and distinct enough from Inter at a glance that a heading never reads as large body text. Inter is the reading face: it is there to disappear. Roboto Mono is the evidence face, and it is load-bearing rather than stylistic — tabular figures mean a column of dates and reference numbers aligns, and a monospaced reference number is one a reader can transcribe without losing their place.

### Hierarchy

- **Display** (800, `clamp(2.5rem, 1.6rem + 3.8vw, 4.5rem)`, 1.04, −0.035em): one per page at most, in the frame. The page's own title, never a section's.
- **Headline** (800, `clamp(2rem, 1.4rem + 2.6vw, 3.5rem)`, 1.08, −0.03em): major section openers.
- **Title** (700, `clamp(1.625rem, 1.3rem + 1.4vw, 2.5rem)`, 1.16, −0.022em): the checked entity's name at the top of a report; subsection openers.
- **Section** (700, 2rem, 1.2, −0.018em): fixed-size heading inside the reading column, where a fluid size would make the document breathe unpredictably as it scrolls.
- **Body Lead** (400, 1.25rem, 1.55): the state sentence, and the opening paragraph of an article. The one body size that is allowed to carry weight by size alone.
- **Body** (400, 1rem, 1.65): everything else. Measure 65–72ch.
- **Body Small** (400, 0.875rem, 1.6): notes, the meaning line under an evidence level, badge text.
- **Label** (600, 0.75rem, 0.06em tracking, uppercase): section markers inside the report — "Evidence level", "Sources", "Questions to ask". These are the register's running heads.
- **Mono** (400, 0.875rem, `tnum` + `zero`): identifiers, dates, reference numbers, phone numbers, wallet addresses, percentages in the return check.

### Named Rules

**The Monospace Is Evidence Rule.** Roboto Mono marks things a reader might copy, compare or quote: a notice date, an appeal reference, a wallet address, a phone number published in a notice, a stated return. It is never used to make something look technical, never for running text, never for headings, and never for a word. If it is not a datum, it is Inter.

**The Publisher Line Rule.** A claim and its attribution are one typographic unit, never separated by a layout boundary. Publisher in Muted Body Small, date in Mono, link in Action Blue Text, on the line directly beneath the claim they belong to. A source that has scrolled away from its claim has stopped doing its job, and the claim has silently become Qwench's own.

**The One Display Rule.** One Display-size element per page. The report's own subject — the name that was checked — outranks any marketing line on the same page.

## Layout

A single reading column, 65–72ch (about 680px) for prose, widening to 820px where a report carries source rows and identifier lists that need the room. The column is centred on a canvas that may be full-bleed; the frame around it may be as wide as the viewport.

Spacing is a 4px base, used in the steps listed in the frontmatter. The rhythm matters more than the scale: tight inside a group, generous between groups, and more space above a heading than below it, so that a heading reads as belonging to what follows. Inside a report block, 12px between a claim and its publisher line; 24px between blocks; 48–64px between major sections; 80–96px between the page's regions.

Breakpoints are 480 / 768 / 1024 / 1280. Below 768 everything is one column, the report's section labels stay in place, and nothing collapses behind a disclosure — a person mid-payment must not have to open an accordion to find out that a regulator named the firm they are about to pay. Side gutters are 16px on a phone and never less. At 1280 and above the report may run a sticky secondary column carrying the appeal route and the hotlines; that column is supplementary and its content also appears inline at the end of the document, so nothing lives only in the wide layout.

Touch targets are 44px minimum, and the check field is 60px tall because it is the one control most people will ever use.

### Named Rules

**The Fixed Order Rule.** The report renders in the backend's order — state sentence, evidence level, sources, return check, warning signs, AI warning signs, link facts, foreign context, also checked, notes, questions to ask, disclaimer, footer. A surface may add headings and marks. It may not reorder, merge, summarise, promote a block into a highlight, or add a block of its own. The WhatsApp reply and this page are the same document in two typefaces.

**The No Summary Rule.** Nothing may be rendered above the state sentence that characterises what follows. No at-a-glance strip, no "here's what we found", no count of findings. The first thing a reader meets is the record.

## Elevation & Depth

The system is **flat by default and tonal rather than shadowed**. Depth is expressed by moving between the three grounds — Sunken, Canvas, Surface — and by hairlines, not by lifting things off the page. A register is printed, not stacked, and a document whose every block floats has made all of its blocks equally important.

Shadows exist only where something is genuinely above the page and the reader needs to know it: a popover, a sticky action bar, the mobile navigation sheet, and the check field at the moment it has focus. There are three, and anything else uses a ground change or a hairline.

### Shadow Vocabulary

- **Raised** (`box-shadow: 0 1px 2px rgba(8, 27, 56, 0.06), 0 4px 12px rgba(8, 27, 56, 0.08)`): the check field on focus, and a card the reader is actively hovering.
- **Floating** (`box-shadow: 0 8px 24px rgba(8, 27, 56, 0.12), 0 2px 6px rgba(8, 27, 56, 0.08)`): popovers, dropdowns, the mobile nav sheet.
- **Sticky** (`box-shadow: 0 -2px 16px rgba(8, 27, 56, 0.10)`): a bar pinned to the bottom of the viewport, casting upward.

In the dark theme the same three use `rgba(0, 0, 0, 0.4)` and gain a `1px` top hairline of `#1E3A5F`, because a shadow alone does not separate two dark surfaces.

### Named Rules

**The Earned Shadow Rule.** Every shadow has an offset and a soft blur, and exists because something is actually above the page. A zero-offset coloured halo is decoration; a hard offset block shadow is a costume this world never chose. Neither ships.

## Shapes

Softly squared, not pill-shaped and not sharp. Radii run 4 / 6 / 10 / 14 / 20px, with full rounding reserved for status badges and the avatar-sized marks in the frame — a badge is a stamp, and a stamp is round. Cards and panels take 14px; the check field takes 14px; buttons take 10px, deliberately tighter than their container so a button inside a card does not echo its corner.

Borders are 1px. The single exception is the left edge of a quoted regulator notice, which takes a 3px rule in the matching status colour — a blockquote mark, the one place a coloured edge is the right answer because the quotation is genuinely someone else's voice inside the document. Nowhere else does a coloured left border appear, on a card, a list item, a callout or an alert.

The form language has no decorative geometry: no blobs, no diagonal section dividers, no floating rounded squares behind headings, no icon tiles. The mark's forward cut is the only diagonal in the system, and it belongs to the mark.

## Components

### Buttons

- **Shape:** softly squared (10px).
- **Primary:** Action Blue fill, white text, `12px 24px`, 48px tall. 4.60:1. One per view; the check action owns it on any page that has a check.
- **Secondary:** Surface fill, Ink text, 1px Edge border, same metrics. The common case — Secondary is the default and Primary is the exception, because most actions on a register are navigation.
- **Quiet:** no fill, Action Blue Text label, `8px 12px`. Inline routes such as "appeal this entry".
- **Hover / Focus:** hover deepens the fill to Action Blue Text (Primary) or to Sunken (Secondary) over 150ms. Focus is a 2px Action Blue ring at 2px offset, never a removed outline and never a glow substituted for a ring.
- **Disabled:** Sunken fill, Faint text, no border change. Never a Primary button with reduced opacity — translucent text makes contrast context-dependent and unverifiable.

### Chips

Used for the search's did-you-mean suggestions and the watchlist filters.

- **Style:** Sunken fill, Ink Soft text, no border, full rounding, `6px 14px`, Body Small.
- **State:** selected takes an Action Blue 1px border and Action Blue Text label; it never takes a filled Action Blue background, which would make a filter look like a submit.

### Cards / Containers

- **Corner Style:** 14px.
- **Background:** Surface on Canvas; Sunken for a panel pressed into the document.
- **Shadow Strategy:** none at rest. Raised on hover only where the whole card is a link.
- **Border:** 1px Hairline.
- **Internal Padding:** 24px, dropping to 20px below 768.
- Cards never nest. A card inside a card is always a grouping failure; use spacing and a hairline.

### Inputs / Fields

- **Style:** Surface fill, 1px Edge border, 14px radius, Body Lead text. The main check field is 60px tall with `16px 20px` padding and holds an inline submit.
- **Focus:** border becomes Action Blue, a 2px Action Blue ring sits at 2px offset, and Raised appears. The ring is additive to the border, never a replacement for it.
- **Error:** border and message in Signs Ink (`#8A5A00`), with a drawn alert mark. The message names the problem and the recovery — "That doesn't look like a phone number or a link. Try the business name instead." — never a bare "Invalid input".
- **Empty / loading:** a skeleton in Sunken, never a spinner over the whole page; the frame stays put while the column fills.

### Navigation

- **Style:** the masthead is the register's cover — Ink Soft ground, wordmark at left in Beam and Paper, links in Inter 15px/600.
- **States:** default Dim; hover Paper; current item Paper with a 2px Beam underline at 6px offset. The current item is never marked by colour alone.
- **Mobile:** a sheet, not a dropdown; 48px rows; the check field pinned at its top, because navigation on this site is mostly a way to get to a check.

### Status Badge

The signature component, and the one most likely to be built wrong.

A badge is a **tint fill, its matching ink, full rounding, `6px 14px`, Body Small**, carrying a drawn 16px mark at 1.5px stroke and the state's own words. All three — colour, mark, words — are always present. It never appears alone as a floating pill on a card; it sits on the line above the state sentence it belongs to, and the state sentence always says in prose what the badge says in shorthand.

The marks are drawn from Lucide at a consistent 1.5px stroke: Named `triangle-alert`, Reviewed `user-round-search`, Signs `flag`, Listed `list-checks`, Nothing `search-x`. None of them is a tick, a shield, a cross or a gauge.

### Evidence Panel

The block that leads every report. A Sunken panel, 14px radius, `20px 24px`, with a Label-role running head, the level's label in Plus Jakarta Sans 700 at 1.125rem, the backend's meaning sentence in Muted Body, and the tier line beneath a hairline in Faint Body Small. No icon larger than 16px, no colour fill, no number anywhere in it.

### Source Row

Publisher in Muted Body Small; date in Mono; title in Ink Body; link in Action Blue Text with an external-link mark. Rows are separated by hairlines, not by cards, and they sit directly beneath the claim they support.

### Named Rules

**The Three-Signal Rule.** A status is always carried by colour, a drawn mark, and words together. Remove any one of the three and the remaining two must still say the same thing — which is what makes the system survive greyscale printing, forced-colours mode, a colour-blind reader, and a screenshot sent through three WhatsApp re-compressions.

**The Drawn Icon Rule.** Every mark in the interface is drawn — Lucide, or authored SVG, at 1.5px stroke. Emoji are not an icon system: they render differently on every platform, they are announced as their Unicode names by screen readers, and ✅ in particular asserts exactly the approval this product may never give.

## Do's and Don'ts

### Do:

- **Do** reserve Action Blue (`#0B6BFF`) for actions, and use Action Blue Text (`#0A57CC`) wherever that blue would be body-size text.
- **Do** put a drawn mark and the state's words beside every status colour, so no meaning is carried by hue alone.
- **Do** set the publisher, the date and the link directly beneath the claim they support, with the date in Roboto Mono.
- **Do** render the report in the backend's fixed order, adding only headings and marks.
- **Do** use dark ink (`#081B38`) on the amber fill, and `#8A5A00` for amber text — raw `#F59E0B` fails contrast in both directions.
- **Do** compose the dark theme on its own terms: `#081B38` ground, `#0F2A4F` surfaces, `#4D94FF` in place of Action Blue for text, `#60D4FF` for links.
- **Do** keep prose to 65–72ch and body text at 16px or larger.
- **Do** theme the surfaces the browser would otherwise own — selection, caret, scrollbar, focus ring, underline offset — from this palette.
- **Do** state plainly where Qwench has nothing: "Not enough to go on" is a finding, and it is presented with the same care as any other.

### Don't:

- **Don't** introduce green at any lightness, a tick, a shield, a padlock or any other mark of approval. There is no "safe" token in this system and there will not be one.
- **Don't** arrange the status colours into a ramp, meter, traffic light, gauge or sorted legend. A sequence is a score.
- **Don't** render any number that could be read as a rating — no `x/10`, no percentage of confidence, no count of findings presented as a magnitude.
- **Don't** use emoji as icons anywhere, including in the state map in `src/lib/qwench.ts`, which currently ships ⚠️ ✅ 🔶 ℹ️ 🏛️ 🔍 🌍 and must move to drawn Lucide marks.
- **Don't** write a summary, verdict, conclusion or recommendation above or below the report. The disclaimer is the last word, and it is the backend's.
- **Don't** nest a card inside a card, or reach for a card where spacing and a hairline would group the content.
- **Don't** put a coloured left border above 1px on a card, list item or callout. The only exception is the 3px rule on a quoted regulator notice.
- **Don't** use Roboto Mono for anything that is not a datum, or as a shorthand for "technical".
- **Don't** add an eyebrow or kicker above a heading. The uppercase Label role marks a report section; it is a running head on its own line and never a decorative line above a larger heading.
- **Don't** imply a relationship with MTN, a bank or a regulator — no logo strip, no "trusted by", no institution mark in the frame. They are prospects, and sources are credited in a sources list, not displayed as endorsements.
- **Don't** invent counts, feeds, trending lists or testimonials to fill a layout. There is no public entities endpoint and no public feed; if a design needs one, the design is wrong until the endpoint exists.
