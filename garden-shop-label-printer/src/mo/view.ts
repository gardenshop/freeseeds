import type { MoProjection } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { escapeMoAttribute, renderMoPreviewDocuments, type MoBackPreviewRotation } from "./renderer";
import type { MoPdfProgress } from "./pdf";
import { emptyMoSessionMapping, hasMoSessionMapping, hasVisibleMoFields, moSessionMappingError, resolveMoVisibleFields, type MoPartySource, type MoSessionMapping, type MoValueSource } from "./mapping";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]!);

export type MoPdfViewState = Readonly<{
  exporting: boolean;
  progress?: MoPdfProgress;
  message?: string;
  error?: string;
}>;

function reviewCard(candidate: MoProjection["candidates"][number], mappings: ReadonlyMap<number, MoSessionMapping>, pendingMappings: ReadonlyMap<number, MoSessionMapping>): string {
  const mapping = pendingMappings.get(candidate.sourceIndex) ?? mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping();
  const confirmedMapping = mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping();
  const snapshot = candidate.sourceSnapshot;
  const visible = resolveMoVisibleFields(candidate, confirmedMapping);
  const mappingError = moSessionMappingError(mapping);
  const manual = (key: keyof MoSessionMapping, label: string, value: string, type = "text") =>
    `<label class="mo-manual-field">${label}<input type="${type}" data-mo-map-index="${candidate.sourceIndex}" data-mo-map-key="${key}" value="${escapeHtml(value)}" autocomplete="off"></label>`;
  const choices = (key: keyof MoSessionMapping, value: MoPartySource | MoValueSource, options: readonly Readonly<{ value: string; label: string }>[]) =>
    `<div class="mo-map-choice-group" role="group" aria-label="${escapeHtml(key)}">${options.map((option) => `<button type="button" data-mo-map-choice-key="${escapeHtml(key)}" data-mo-map-choice-index="${candidate.sourceIndex}" data-mo-map-choice-value="${escapeHtml(option.value)}" aria-pressed="${value === option.value}">${escapeHtml(option.label)}</button>`).join("")}</div>`;
  const partyOptions = [
    { value: "blank", label: "Leave blank" },
    { value: "article-sender", label: "Confirm parcel sender candidate" },
    { value: "article-receiver", label: "Confirm parcel receiver candidate" },
    { value: "manual", label: "Manual entry" },
  ] as const;
  const articleOptions = [
    { value: "blank", label: "Leave blank" },
    { value: "tracking", label: "Confirm exact tracking" },
    { value: "manual", label: "Manual entry" },
  ] as const;
  const principalOptions = [
    { value: "blank", label: "Leave blank" },
    { value: "declared-principal", label: "Confirm declared principal; exclude commission" },
    { value: "manual", label: "Manual entry" },
  ] as const;
  const mappingSelected = hasMoSessionMapping(mapping);
  const pending = JSON.stringify(mapping) !== JSON.stringify(confirmedMapping);
  const resolvedKeys = Object.entries(visible).filter(([, field]) => Boolean(field?.value.trim())).map(([key]) => key).join(",");
  return `<details class="mo-record-mapping" data-mo-review-index="${candidate.sourceIndex}" data-mo-sender-source="${confirmedMapping.senderSource}" data-mo-receiver-source="${confirmedMapping.receiverSource}" data-mo-pending-sender="${mapping.senderSource}" data-mo-pending-receiver="${mapping.receiverSource}" data-mo-resolved-fields="${escapeHtml(resolvedKeys)}"><summary>MO-session review · selected row ${candidate.sourceIndex + 1}${hasVisibleMoFields(visible) ? " · USER-CONFIRMED DRAFT" : ""}${pending ? " · choices pending confirmation" : ""}</summary>
    <div class="mo-candidate-sources"><p><b>Parcel sender candidate (unverified; may be the label default)</b>: ${escapeHtml(snapshot.senderName || "no name")}; ${escapeHtml(snapshot.senderAddress || "no address")}.</p><p><b>Parcel receiver candidate (unverified)</b>: ${escapeHtml(snapshot.name || "no name")}; ${escapeHtml(snapshot.address || "no address")}; ${escapeHtml(snapshot.phone || "no phone")}.</p>${snapshot.sourceAddress && snapshot.sourceAddress !== snapshot.address ? `<p><b>Original imported receiver address</b>: ${escapeHtml(snapshot.sourceAddress)}</p>` : ""}<p><b>Article/amount candidates</b>: exact tracking <code>${escapeHtml(candidate.sourceTracking)}</code>; imported declared amount <code>${escapeHtml(candidate.sourceAmount)}</code>; validated rupee principal ${candidate.declaredPrincipalRupees.toLocaleString("en-US")}; label-only commission ${candidate.labelCommissionRupees} (never added).</p><p class="mo-unverified">Pakistan Post's public service summary does not map these label parties to MO-51 sender/remitter/payee fields. A selection below confirms only your MO-session choice; it is not official postal verification.</p></div>
    <div class="mo-mapping-grid"><div class="mo-mapping-control"><span>MO-51 V.P. article number</span>${choices("articleNumberSource", mapping.articleNumberSource, articleOptions)}${mapping.articleNumberSource === "manual" ? manual("manualArticleNumber", "Manual article number", mapping.manualArticleNumber) : ""}</div><div class="mo-mapping-control"><span>MO-51 “For Rs.” principal</span>${choices("principalSource", mapping.principalSource, principalOptions)}${mapping.principalSource === "manual" ? manual("manualPrincipal", "Manual whole-rupee principal", mapping.manualPrincipal, "text") : ""}</div>
    <div class="mo-mapping-control"><span>MO-51 sender field source</span>${choices("senderSource", mapping.senderSource, partyOptions)}${mapping.senderSource === "manual" ? `${manual("manualSenderName", "Manual sender name", mapping.manualSenderName)}${manual("manualSenderAddress", "Manual sender address", mapping.manualSenderAddress)}${manual("manualSenderPhone", "Manual sender telephone", mapping.manualSenderPhone)}` : ""}</div>
    <div class="mo-mapping-control"><span>MO-51 receiver field source</span>${choices("receiverSource", mapping.receiverSource, partyOptions)}${mapping.receiverSource === "manual" ? `${manual("manualReceiverName", "Manual receiver name", mapping.manualReceiverName)}${manual("manualReceiverAddress", "Manual receiver address", mapping.manualReceiverAddress)}${manual("manualReceiverPhone", "Manual receiver telephone", mapping.manualReceiverPhone)}` : ""}</div></div>
    <small>${pending ? "Manual entries are not yet applied. Click Confirm pending manual entries to update the preview." : mappingSelected ? "Source buttons explicitly confirm user-selected candidates for this session only; they remain non-official and any populated PDF is marked DRAFT." : "No values are mapped by default. Click a source choice to confirm it for this MO session."}</small>${mappingError ? `<p class="mo-mapping-fit-error" role="alert">${escapeHtml(mappingError)}</p>` : ""}</details>`;
}

export function renderMoPrintView(
  projection: MoProjection,
  senderCnicInput: string,
  sheetIndex: number,
  backRotation: MoBackPreviewRotation,
  pdfState: MoPdfViewState,
  mappings: ReadonlyMap<number, MoSessionMapping>,
  pendingMappings: ReadonlyMap<number, MoSessionMapping>,
): string {
  const plan = imposeMoCandidates(projection.candidates);
  const cnic = formatSenderCnic(senderCnicInput);
  const sheet = plan.sheets[sheetIndex] ?? plan.sheets[0];
  const excludedCounts = new Map<string, number>();
  for (const record of projection.excluded) {
    for (const reason of record.reasons) excludedCounts.set(reason.code, (excludedCounts.get(reason.code) ?? 0) + 1);
  }
  const exclusionSummary = Array.from(excludedCounts, ([reason, count]) => `<li>${count} excluded · ${escapeHtml(reason)}</li>`).join("");
  const invalidCnic = cnic.status === "invalid";
  const docs = sheet && !invalidCnic ? renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation, mappings) : undefined;
  const progressText = pdfState.progress ? `PDF pages rendered: ${pdfState.progress.completedPages}/${pdfState.progress.totalPages}` : "";
  const hasMappings = projection.candidates.some((candidate) => hasVisibleMoFields(resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())));
  const mappedCount = projection.candidates.filter((candidate) => hasVisibleMoFields(resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()))).length;
  const invalidMapping = projection.candidates.map((candidate) => moSessionMappingError(mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())).find(Boolean);
  const reviewCards = sheet ? [sheet.front.left, sheet.front.right].filter((candidate) => candidate !== null).map((candidate) => reviewCard(candidate!, mappings, pendingMappings)).join("") : "";
  const mappingState = Array.from(mappings, ([index, mapping]) => `${index}:${mapping.articleNumberSource}/${mapping.principalSource}/${mapping.senderSource}/${mapping.receiverSource}`).join("|");
  const pendingState = Array.from(pendingMappings, ([index, mapping]) => `${index}:${mapping.articleNumberSource}/${mapping.principalSource}/${mapping.senderSource}/${mapping.receiverSource}`).join("|");

  return `<section class="mo-print-view" data-mo-view data-mo-mapping-state="${escapeHtml(mappingState)}" data-mo-pending-state="${escapeHtml(pendingState)}">
    <header class="mo-heading"><p class="kicker">MO-51 / LOCAL REVIEW AND MANUAL-COMPLETION</p><h1>Money-order forms.</h1><p>Imported labels are read-only. No field is mapped until you explicitly select a candidate for this MO session.</p></header>
    <aside class="mo-warning" role="note">Authoritative LP-046 mapping: original HTML section 1 is FRONT (sender/receiver and intimation); section 2 is BACK (M.O.-51 title, office, stamps and signatures). Back rotation remains configurable but UNVERIFIED. Download creates blank manual-completion forms only; no printer action is enabled.</aside>
     <section class="mo-summary" aria-label="MO packet count"><strong>${plan.eligibleCount}</strong><span>eligible VPL/VPP rows used for copy quantity only</span><span>${plan.sheetCount} cut-and-stack sheets</span><span>${plan.pdfPageCount} PDF pages</span><span>${mappedCount} user-confirmed draft forms</span></section>
    <div class="mo-controls"><label for="moSenderCnic">Sender CNIC # <span>(optional; MO session only)</span></label><input id="moSenderCnic" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="15" value="${escapeHtml(senderCnicInput)}" aria-invalid="${invalidCnic}" aria-describedby="moCnicHelp moCnicError" ${pdfState.exporting ? "disabled" : ""}><small id="moCnicHelp">13 digits; hyphens optional. Printed only at the MO-51 sender CNIC position. Clearing it leaves that line blank.</small><p id="moCnicError" class="mo-error" role="alert">${invalidCnic ? "Enter exactly 13 digits, optionally grouped 5-7-1, or clear the field." : ""}</p></div>
     <details class="mo-required-fields" open><summary>Source evidence and unresolved postal-field register</summary><p>Pakistan Post’s public VPL/VPP tariff pages do not map parcel parties to MO-51 fields. Its Value Payable Post description says article recipients pay on receipt and traders recover supplied value, but it does not define MO-51 remitter/payee roles. Its Postal Forms index omits MO-51; the linked manuals are large archives that could not be safely inspected here. No field is officially verified.</p><ul><li>MO number/date; article kind; amount words; other-party CNICs and relationship/income/reason: no approved source</li><li>VP article number, declared principal and sender/receiver names/addresses/phones: label candidates may be used only after explicit per-row MO-session confirmation; not postal verified</li><li>Remitter/payee/addressee roles; office names, postcodes and operational dates: unresolved/no source</li><li>Postal stamps, witness/clerk, thumb impression, signatures and payment actions: manual-only</li></ul><p>Confirmed values appear only on a visibly marked DRAFT; completed-order export is unavailable. The separate blank manual-completion PDF remains available.</p></details>
     <section class="mo-mapping-review"><h2>Review candidates for this sheet</h2><p>Every field defaults blank. Source buttons explicitly confirm candidates for this MO session; manually typed entries require confirmation. Neither is official postal verification. Edits stay in memory and are cleared when leaving MO Print.</p>${reviewCards || `<p>No selected rows on this sheet.</p>`}<button id="confirmMoMappings" type="button" ${pdfState.exporting || !sheet ? "disabled" : ""}>Confirm pending manual MO-session entries</button></section>
    ${exclusionSummary ? `<details class="mo-exclusions"><summary>${projection.excluded.length} excluded imported records</summary><ul>${exclusionSummary}</ul></details>` : ""}
     ${plan.sheetCount === 0 ? `<p class="mo-empty">No selected, valid VPL/VPP records are available for an MO manual-completion packet.</p>` : invalidCnic ? `<p class="mo-empty">Preview/export withheld until the invalid nonblank CNIC is corrected or cleared.</p>` : `<div class="mo-export-controls"><button id="downloadMoPdf" ${pdfState.exporting ? "disabled" : ""}>Download blank manual-completion PDF</button>${hasMappings ? `<button id="downloadMoDraftPdf" ${pdfState.exporting || invalidMapping ? "disabled" : ""}>Download user-confirmed DRAFT PDF</button>` : ""}${pdfState.exporting ? `<button id="cancelMoPdf">Cancel export</button>` : ""}<span id="moPdfStatus" role="status" aria-live="polite">${escapeHtml(pdfState.error ?? pdfState.message ?? progressText)}</span></div><p id="moMappingFitError" class="mo-mapping-fit-error" role="alert"></p><div class="mo-orientation"><label for="moBackRotation">Back preview rotation <span>UNVERIFIED / not a printer profile</span></label><select id="moBackRotation" ${pdfState.exporting ? "disabled" : ""}><option value="none" ${backRotation === "none" ? "selected" : ""}>Upright (default)</option><option value="rotate-180" ${backRotation === "rotate-180" ? "selected" : ""}>Rotate each back form 180°</option></select></div><nav class="mo-sheet-nav" aria-label="MO proof sheet navigation"><button id="moPrevSheet" ${sheetIndex <= 0 || pdfState.exporting ? "disabled" : ""}>Previous sheet</button><label for="moSheetSelect">Sheet <select id="moSheetSelect" ${pdfState.exporting ? "disabled" : ""}>${plan.sheets.map((item, index) => `<option value="${index}" ${index === sheetIndex ? "selected" : ""}>${item.sheetNumber}</option>`).join("")}</select> of ${plan.sheetCount}</label><button id="moNextSheet" ${sheetIndex >= plan.sheetCount - 1 || pdfState.exporting ? "disabled" : ""}>Next sheet</button></nav><div class="mo-face-list"><section><h2>Front · Section 1 / Sender and intimation</h2><iframe id="moFrontPreview" title="MO-51 front face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.front)}"></iframe></section><section><h2>Back · Section 2 / M.O.-51 title and payment</h2><iframe id="moBackPreview" title="MO-51 back face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.back)}"></iframe></section></div>`}
     <p class="mo-footer">Blank PDF remains a separate manual-completion packet. User-confirmed draft PDFs are marked DRAFT and not postal-verified; no completed official order export exists while requiredness and party roles remain unresolved.</p>
  </section>`;
}
