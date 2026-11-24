# GFS-LP-070 Chrome MCP Policy and Staging Acceptance

## Permanent Chrome profile policy

`RULES.md` now contains the protected **CHROME MCP PROFILE POLICY**. Use only official Chrome DevTools MCP with the currently open, authorized `gisupp@gmail.com` Chrome profile/session; list pages first. Do not create another profile, Incognito or isolated browser, launch duplicate Chrome, or change debugging configuration. Do not access credentials or inspect, snapshot, export, modify or reuse customer records in populated tabs/restored storage. Live synthetic tests require demonstrably empty, test-only state; stop without reading values if it cannot be established. Reconnect once through supported means only; never bypass Access. Production security remains unchanged.

## Read-only preflight

- Git remote is `https://github.com/gardenshop/freeseeds.git`; branch is `codex/garden-shop-label-printer-mvp`; local HEAD and remote HEAD both equal `3bcd991e8ce145bf264cfbe8e7f31306fcb18e29` before this documentation change.
- Wrangler identity reports `gisupp@gmail.com`, Get Free Seeds, account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`. Official `chrome_devtools.list_pages` showed the authenticated Dashboard in that account and the existing staging tab; the Dashboard showed the same account ID. No staging content was inspected.
- Account-pinned read-only Pages history confirms deployment `3a683220-964b-4eaa-b624-433f6263c620`, Production/main, source `e2b2df8`, and previous deployment `f5f40d5f-4d68-4693-9da6-0024ca249f19`. No deployment or external mutation was performed.
- Preserve the 51 unrelated pending Git paths and all protected systems.

## Live acceptance result

- **BLOCKED / NOT TESTED:** N2 amount-once, alignment, font/bold, preview/PDF raster parity, field duplication/overlap, roles, overflow and validation.
- **BLOCKED / NOT TESTED:** N100 synthetic PDF download, 100 pages/50 sheets, 1/51 and 50/100 pairing, front/back geometry, and Print MO Batch's generated `application/pdf` target.
- **BLOCKED / NOT TESTED:** existing-label import/mapping, preview, barcode, PDF and print target.
- The existing staging tab may have restored application data. It was not opened, snapshotted, exported, modified or reused; no new tab/profile or browser context was created. A safe empty test-only application state could not be established without risking inspection or use of customer data. No synthetic records were submitted, no PDF was generated, and no physical print occurred. No source defect was reproduced.
- Monitor `PDF_GENERATED` HTTP 400 remains separately blocked. No WhatsApp, Admin/API, COD, payment, Meta, D1, Worker, Access-policy, production-routing or Hoja Seeds change occurred. Sender CNIC rules remain MO-only and session-only. Physical duplex remains unverified.

## Gate to resume

Resume only after the authorized operator establishes a demonstrably empty, test-only staging state in the existing authorized Chrome profile without reading or reusing any restored customer records. Then run the synthetic N2 first, followed by N100 and focused existing-label checks. Do not redeploy unless an independently reproduced defect requires a code repair.
