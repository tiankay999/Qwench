# Workplan: data lead

**Goal:** a small set of records the team can prove, not a big list.

| # | Task | Done when |
|---|---|---|
| 1 | Agree the handoff format below with backend | Backend can load one sample record |
| 2 | Review the acceptance test records first: YepBit, Vaulta, GoldBod, Daily Wealth Guide, Darazz | Each has its notice link, date and exact quote |
| 3 | Review the other SEC warnings, including BonChat and the 23 named in July | Same as above |
| 4 | Check "Yepbit Trading" against the SEC notice | The name matches the notice, or the record is corrected |
| 5 | Add the rest of the sandbox firms, the licensed list, Bank of Ghana and CSA notices, and the Hut 8 case | Undated records have dates, or are left out |
| 6 | Add every website, wallet and number that appears in a notice | Identifiers are entered in full, numbers in +233 format |
| 7 | A second person reviews every record | Nobody approved their own record |
| 8 | Test the demo cases: a warning, a sandbox firm, a no-record offer, Daraz vs Darazz, a number found in a notice | Backend and bots have tested all five |
| 9 | Create merchant and partner demo data | Every item is labelled "Demo data" |

GoldWave is the no-record test, so it must never have a record.

## Handoff format

Put files in `Backend/src/data/reviewed/`:

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

Each file holds one record or a list of records. Check them with `pnpm import:reviewed --dry-run`, which gives a reason for every rejected row. A row needs a quote, an `effectiveOn` date, a source link and a second reviewer. A licence also needs `licenseType`. Identifiers listed here must be published in the notice, because they stay readable.

The format has no way to link an impersonator to a real company, so tell Dre when you reach the Hut 8 case. It also has no way to withdraw a record. Tell Dre if a notice is withdrawn.

## Rules

- Use regulators' originals, not news reports.
- Don't invent a payment number. Leave out any record you can't source.
- Real companies such as Hut 8 appear only as the impersonated party.
- Being unlicensed doesn't by itself show fraud, so quote what the regulator said.

**If time runs out:** finish the SEC warnings and sandbox firms, then stop.
