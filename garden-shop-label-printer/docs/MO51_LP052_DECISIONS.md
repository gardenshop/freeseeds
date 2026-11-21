# MO-51 LP-052 Sender/Receiver Front Positions and LP-051 Completion

## Scope and preserved behavior

- Corrected only presentation on MO FRONT / uploaded HTML section 1. Receiver is now the upper complete party block; Sender is the lower complete party block. Each caption, writing lines, contact fields and adjacent postcode boxes travel as one DOM group. Section 2/MO BACK, stamp artwork, and the imported Sender/Receiver values remain unchanged.
- Existing source resolution remains explicit: candidate receiver `name/address/phone` and sender-profile `senderName/senderAddress` are never exchanged. Independent synthetic data has distinct `Synthetic Receiver N` and `Synthetic Sender` values and assertions verify both source bindings and upper/lower roles.
- Optional Sender CNIC remains MO-only, Sender-only, session-only, and pinned to the lower Sender CNIC line. It is not a saved layout value, imported record field, log or monitoring payload.
- A4 landscape is 297 × 210 mm; each A5 half is 148.5 × 210 mm. All saved field coordinates remain millimetres. Cut-and-stack still uses `S=ceil(N/2)`, row `i` left and row `i+S` right, with matching front/back row identities and blank odd right halves. No imported values, commission, postal meaning, or postal fields were changed or invented.

## Legacy layout handling

- The persistent storage key stays `gfs-mo51-layout-v1`; new normalized definitions use schema version 2 and `partyPositionVersion=2`. Version-1 definitions migrate in memory to schema v2; definitions with Sender/Receiver fields are marked `partyPositionVersion=1`, retaining all IDs, bindings, coordinates and style until the user chooses the correction.
- Detected old positions show **Correct Sender/Receiver Positions**. The one-click correction moves only front Sender fields still in the old upper region down 27 mm and front Receiver fields still in the old lower region up 27 mm. The fixed block offset preserves each field's x, dimensions, font, bold, alignment and wrapping; back fields, unrelated fields and custom positions outside the legacy regions are unchanged. Corrected definitions save as party-position v2. Out-of-bounds correction fails without mutating the input, and mapped PDF/print stay blocked until correction succeeds.
- Unit and browser fixtures load a pre-LP-052 schema-v1 layout, verify the warning/output gate, apply correction, reload schema-v2, preserve customized fields, and generate/rasterize a synthetic PDF. A separate test verifies post-LP-052 layout save/reload/reset.

## LP-051 editor and output verification

- Genuine Playwright mouse palette drag and pointer reposition/resize pass; click-to-place and duplicate prevention pass. Font increment/decrement/numeric controls, bold persistence, wrapping, fit-to-width/zoom, clean preview, print popup, privacy checks and narrow-to-wide 800/1280/1366/1440/1920 px viewports are covered.
- Preview/PDF dimensions remain independent of editor zoom. Mapped export continues to fail closed on missing fields, overflow and overlap. Month Stamp synthetic value is `18-11-26`; a specific regression assertion rejects `31-12-99`.
- Synthetic batch checks cover N=1, 2, 3, 5, 42, 100, 101 and 500, plus mixed VPL/VPP/RGL/UMS prefixes. N=42 verifies pairs 1/22, 11/32, and 21/42; N=100 verifies 1/51 and 50/100. Exact tracking, validated principal, commission exclusion, row identity and odd blank halves remain asserted. N=500 completed with 500 pages / 1,792,432 bytes in 64,517 ms; renderer JS heap peaked at 40,015,880 bytes (not total process memory).
- Unit suite passed 140/140. Final TypeScript/Worker typecheck and Vite production build passed. The full browser/PDF regression exited successfully with `browserErrors: []`, after MO N=42, N=100 (100 pages), N=500 (500 pages), existing label/print/PDF scenarios and privacy assertions. N=500 completed in 74,324 ms, 500 pages / 1,792,429 bytes; renderer JS heap was 14,811,972 bytes before and peaked at 40,669,092 bytes (not total process memory).

## Screenshot evidence

All current screenshots use synthetic records. The actual rasterized PDF page after correcting a legacy layout is at `D:\Temp\kilo\lp052-evidence\lp052-legacy-corrected-pdf-front-synthetic.png`; it shows the Receiver in the upper block and Sender in the lower block. The same evidence directory contains editor screenshots at 800/1280/1366/1440/1920 px. No customer workbook or real customer data was used.

## Security and release state

- Read-only project verification: branch `codex/garden-shop-label-printer-mvp`, start HEAD `ff4c033c9585d76e307d08627880c5f17f0957c0`, remote `https://github.com/gardenshop/freeseeds.git`. Wrangler authenticated as Get Free Seeds account `cb5066a6d71ecdee0bd7ed8aacb4d3c2`; Pages inventory contains the existing `garden-shop-label-printer-staging` project. Latest listed Production/main deployment is `f2141840-4291-496d-909f-93131b0fb9de` (source `b0671ed`); prior deployment `13081dbe-5090-4ad5-97bb-7ea5eafd9931` is the immediate previous successful Pages version. This is CLI history only, not Dashboard active-version confirmation.
- The previously exposed Cloudflare Access session was not revoked: no authorized Dashboard/session-revocation interface was available in this execution. Treat it as compromised. No cookie was reused, no Dashboard account identity/fresh authentication was verified, and no Pages mutation/deployment/staging test was performed.
- The LP-050 `PDF_GENERATED` HTTP 400 for `gfs-paper-presets-v4` remains an independent Worker contract blocker. No Worker, D1, Access policy, API, Admin, WhatsApp, payments, Meta, monitoring, production routing or external account was modified. Physical duplex and official postal acceptance remain unverified.

## Result

Local implementation and functional assertions: **PASS**. Staging/release: **BLOCKED** pending Access-session revocation, fresh Dashboard identity verification, and independent resolution of the existing audit contract. Do not deploy until those gates pass; no Worker change or template-version bypass is authorized.
