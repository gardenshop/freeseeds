import type { MoProjection } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { escapeMoAttribute, renderMoPreviewDocuments, type MoBackPreviewRotation, type MoPreviewDocuments } from "./renderer";
import type { MoPdfProgress } from "./pdf";
import { emptyMoSessionMapping, hasMoSessionMapping, hasVisibleMoFields, moSessionMappingError, resolveMoVisibleFields, type MoPartySource, type MoSessionMapping, type MoValueSource } from "./mapping";
import { MO_LAYOUT_SOURCES, resolveMoLayoutSource, type MoLayout } from "./layout";

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

function manualOverrideCard(candidate: MoProjection["candidates"][number], mappings: ReadonlyMap<number, MoSessionMapping>, pendingMappings: ReadonlyMap<number, MoSessionMapping>): string {
  const mapping = pendingMappings.get(candidate.sourceIndex) ?? mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping();
  const input = (key: keyof MoSessionMapping, label: string, value: string, type = "text") => `<label class="mo-manual-field">${label}<input type="${type}" data-mo-map-index="${candidate.sourceIndex}" data-mo-map-key="${key}" value="${escapeHtml(value)}" autocomplete="off"></label>`;
  return `<details class="mo-record-mapping"><summary>Session-only manual correction · eligible row ${candidate.sourceIndex + 1}</summary><p>Used only by layout fields explicitly bound to these manual sources. Values are not saved with the layout or Order.</p><div class="mo-mapping-grid">${input("manualArticleNumber", "Manual V.P. article number", mapping.manualArticleNumber)}${input("manualPrincipal", "Manual whole-rupee principal", mapping.manualPrincipal)}${input("manualSenderName", "Manual sender name", mapping.manualSenderName)}${input("manualSenderAddress", "Manual sender address", mapping.manualSenderAddress)}${input("manualSenderPhone", "Manual sender telephone", mapping.manualSenderPhone)}${input("manualReceiverName", "Manual receiver name", mapping.manualReceiverName)}${input("manualReceiverAddress", "Manual receiver address", mapping.manualReceiverAddress)}${input("manualReceiverPhone", "Manual receiver telephone", mapping.manualReceiverPhone)}</div></details>`;
}

function renderMoEditorStage(
  face: "front" | "back",
  srcdoc: string,
  layout: MoLayout,
  editing: boolean,
  sample: MoProjection["candidates"][number] | undefined,
  cnic: string,
  mapping: MoSessionMapping,
  selectedFieldId?: string,
): string {
  const pxPerMm = 96 / 25.4;
  const boxes = sample ? layout.fields.filter((field) => field.face === face).flatMap((field) => [0, 1].map((slot) => {
    const left = (slot * 148.5 + field.xMm) * pxPerMm;
    const top = field.yMm * pxPerMm;
    const width = field.widthMm * pxPerMm;
    const height = field.heightMm * pxPerMm;
    const label = MO_LAYOUT_SOURCES.find((item) => item.id === field.source)?.label ?? field.source;
    const bindingLabel = field.source === "articleType" ? "VPL/VPP"
      : field.source === "declaredPrincipal" ? "Principal"
        : field.source === "tracking" ? "Tracking"
          : field.source === "senderName" ? "Sender"
            : field.source === "senderAddress" ? "Sender address"
              : field.source === "name" ? "Receiver"
                : field.source === "address" ? "Address"
                  : field.source === "phone" ? "Contact"
                    : field.source === "orderDate" ? "Month Stamp"
                      : label;
    const sampleValue = resolveMoLayoutSource(sample, field.source, cnic, mapping)?.value ?? "";
    return `<div class="mo-editor-field ${selectedFieldId === field.id ? "selected" : ""} ${sampleValue ? "has-value" : "missing-value"}" data-mo-layout-id="${escapeHtml(field.id)}" data-mo-layout-source="${field.source}" data-mo-layout-face="${face}" data-mo-layout-slot="${slot}" title="${escapeHtml(sampleValue || `No sample value for ${label}`)}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;text-align:${field.alignment};font-size:${field.fontSizePt}pt;font-weight:${field.bold ? "700" : "400"};white-space:${field.wrap ? "normal" : "nowrap"}"><span class="mo-editor-value">${escapeHtml(sampleValue || "NO SAMPLE VALUE")}</span><small class="mo-editor-binding">${escapeHtml(bindingLabel)}</small><i data-mo-resize-handle role="button" tabindex="0" aria-label="Resize ${escapeHtml(label)} field"></i></div>`;
  })).join("") : "";
  return `<div class="mo-editor-stage" data-mo-editor-stage style="width:1123px;height:794px"><iframe id="${face === "front" ? "moLayoutFrontPreview" : "moLayoutBackPreview"}" title="MO-51 ${face} layout editor preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(srcdoc)}"></iframe><div class="mo-editor-overlay" data-mo-editor-overlay="${face}" data-mo-editor-active="${String(editing)}" aria-label="${face} field placement surface">${boxes}</div></div>`;
}

function renderLayoutEditor(
  layout: MoLayout,
  docs: MoPreviewDocuments,
  projection: MoProjection,
  sampleIndex: number | undefined,
  sample: MoProjection["candidates"][number] | undefined,
  senderCnic: string,
  mapping: MoSessionMapping,
  editing: boolean,
  selectedFieldId: string | undefined,
  layoutStatus: string,
  sideMode: "paired" | "front-only" | "back-only",
  backRotation: MoBackPreviewRotation,
  layoutError: string,
): string {
  const palette = MO_LAYOUT_SOURCES.map(({ id, label }) => {
    const value = sample ? resolveMoLayoutSource(sample, id, senderCnic, mapping)?.value : undefined;
    return `<button type="button" draggable="true" data-mo-layout-source="${id}" class="mo-source-chip" aria-pressed="false"><span>${escapeHtml(label)}</span><small>${escapeHtml(value ?? "No value for sample")}</small></button>`;
  }).join("");
  const selected = layout.fields.find((field) => field.id === selectedFieldId);
  const sampleOptions = projection.candidates.map((candidate, index) => `<option value="${candidate.sourceIndex}" ${candidate.sourceIndex === sampleIndex ? "selected" : ""}>Eligible ${index + 1} (source row ${candidate.sourceIndex + 1})</option>`).join("");
  const properties = selected ? `<div class="mo-layout-properties" data-mo-selected-layout-field="${escapeHtml(selected.id)}"><strong>${escapeHtml(MO_LAYOUT_SOURCES.find((source) => source.id === selected.source)?.label ?? selected.source)}</strong><label>Binding<select id="moLayoutSource">${MO_LAYOUT_SOURCES.map(({ id, label }) => `<option value="${id}" ${selected.source === id ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><label>X (mm from form left)<input id="moLayoutX" type="number" min="0" max="148.5" step="0.1" value="${selected.xMm}"></label><label>Y (mm from form top)<input id="moLayoutY" type="number" min="0" max="210" step="0.1" value="${selected.yMm}"></label><label>Width (mm)<input id="moLayoutWidth" type="number" min="4" max="148.5" step="0.1" value="${selected.widthMm}"></label><label>Height (mm)<input id="moLayoutHeight" type="number" min="3" max="210" step="0.1" value="${selected.heightMm}"></label><label>Font size (pt)<input id="moLayoutFontSize" type="number" min="4" max="48" step="0.5" value="${selected.fontSizePt}"></label><label>Alignment<select id="moLayoutAlignment"><option value="left" ${selected.alignment === "left" ? "selected" : ""}>Left</option><option value="center" ${selected.alignment === "center" ? "selected" : ""}>Center</option><option value="right" ${selected.alignment === "right" ? "selected" : ""}>Right</option></select></label><label class="mo-layout-wrap"><input id="moLayoutWrap" type="checkbox" ${selected.wrap ? "checked" : ""}>Wrap within field box</label><button type="button" id="moLayoutRemoveField">Remove field</button></div>` : `<p class="mo-layout-properties">Select a placed field to resize, reposition or edit its binding.</p>`;

  return `<section class="mo-layout-editor"><header><div><h2>Reusable MO-51 layout editor</h2><p>Drag a data-source chip onto either A5 half. Positions/bindings are millimetres relative to one form and apply to every eligible row. Imported records are read-only.</p></div><div class="mo-layout-actions"><button type="button" id="moLayoutSave">Save Layout</button><button type="button" id="moLayoutReload">Reload Saved</button><button type="button" id="moLayoutReset">Reset Layout</button><label>Sample record<select id="moLayoutSampleRecord">${sampleOptions}</select></label><label>Editor mode<select id="moLayoutEditMode"><option value="edit" ${editing ? "selected" : ""}>Edit fields</option><option value="preview" ${!editing ? "selected" : ""}>Preview batch</option></select></label><label>Back preview rotation<select id="moLayoutBackRotation"><option value="none" ${backRotation === "none" ? "selected" : ""}>Upright (default)</option><option value="rotate-180" ${backRotation === "rotate-180" ? "selected" : ""}>Per-form 180° (UNVERIFIED)</option></select></label><label>PDF/print faces<select id="moPrintSideMode"><option value="paired" ${sideMode === "paired" ? "selected" : ""}>Paired front/back</option><option value="front-only" ${sideMode === "front-only" ? "selected" : ""}>Front only</option><option value="back-only" ${sideMode === "back-only" ? "selected" : ""}>Back only</option></select></label></div></header><p class="mo-layout-status" role="status">${escapeHtml(layoutStatus)}</p>${layoutError ? `<p class="mo-mapping-fit-error" role="alert">${escapeHtml(layoutError)}</p>` : ""}<div class="mo-layout-workbench"><aside class="mo-layout-palette"><h3>Existing fields</h3><p>Values shown are from the selected sample only. The saved layout stores field IDs, source bindings and coordinates, never these values.</p>${palette}</aside><div class="mo-layout-surfaces"><section><h3>Front · Section 1</h3>${renderMoEditorStage("front", docs.front, layout, editing, sample, senderCnic, mapping, selectedFieldId)}</section><section><h3>Back · Section 2</h3>${renderMoEditorStage("back", docs.back, layout, editing, sample, senderCnic, mapping, selectedFieldId)}</section></div><aside>${properties}</aside></div></section>`;
}

export function renderMoPrintView(
  projection: MoProjection,
  senderCnicInput: string,
  sheetIndex: number,
  backRotation: MoBackPreviewRotation,
  pdfState: MoPdfViewState,
  mappings: ReadonlyMap<number, MoSessionMapping>,
  pendingMappings: ReadonlyMap<number, MoSessionMapping>,
  layout: MoLayout,
  layoutEditing: boolean,
  sampleSourceIndex: number | undefined,
  selectedLayoutFieldId: string | undefined,
  layoutStatus: string,
  sideMode: "paired" | "front-only" | "back-only",
  layoutError: string,
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
  const docs = sheet ? renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation, mappings, layout.fields.length ? layout : undefined) : undefined;
  const progressText = pdfState.progress ? `PDF pages rendered: ${pdfState.progress.completedPages}/${pdfState.progress.totalPages}` : "";
  const layoutMode = layout.fields.length > 0;
  const missingLayoutFields = layout.fields.length ? projection.candidates.flatMap((candidate, index) => layout.fields.filter((field) => field.source !== "senderCnic" && !resolveMoLayoutSource(candidate, field.source, cnic.status === "valid" ? cnic.formatted : "", mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())).map((field) => `eligible-${index + 1}:${field.source}`)) : [];
  const hasMappings = !layoutMode && projection.candidates.some((candidate) => hasVisibleMoFields(resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())));
  const invalidMapping = projection.candidates.map((candidate) => moSessionMappingError(mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())).find(Boolean);
  const reviewCards = sheet ? [sheet.front.left, sheet.front.right].filter((candidate) => candidate !== null).map((candidate) => layoutMode ? manualOverrideCard(candidate!, mappings, pendingMappings) : reviewCard(candidate!, mappings, pendingMappings)).join("") : "";
  const sample = projection.candidates.find((candidate) => candidate.sourceIndex === sampleSourceIndex) ?? projection.candidates[0];
  const layoutEditor = docs && sample ? renderLayoutEditor(layout, docs, projection, sampleSourceIndex, sample, cnic.status === "valid" ? cnic.formatted : "", mappings.get(sample.sourceIndex) ?? emptyMoSessionMapping(), layoutEditing, selectedLayoutFieldId, layoutStatus, sideMode, backRotation, layoutError) : "";
  const layoutReady = layoutMode && missingLayoutFields.length === 0 && !layoutError;
  const mappingState = Array.from(mappings, ([index, mapping]) => `${index}:${mapping.articleNumberSource}/${mapping.principalSource}/${mapping.senderSource}/${mapping.receiverSource}`).join("|");
  const pendingState = Array.from(pendingMappings, ([index, mapping]) => `${index}:${mapping.articleNumberSource}/${mapping.principalSource}/${mapping.senderSource}/${mapping.receiverSource}`).join("|");

  return `<section class="mo-print-view" data-mo-view data-mo-layout-mode="${String(layoutMode)}" data-mo-mapping-state="${escapeHtml(mappingState)}" data-mo-pending-state="${escapeHtml(pendingState)}">
    <header class="mo-heading"><p class="kicker">MO-51 / LAYOUT + BATCH PRINT</p><h1>Money-order forms.</h1><p>Drag existing reviewed sources onto the original artwork once. The same field layout applies automatically to every eligible row; imported records remain unchanged.</p></header>
    <aside class="mo-warning" role="note">LP-046 face convention: section 1 FRONT, section 2 BACK. Field bindings are operator-defined. Actual postal acceptance is not asserted. Duplex rotation remains uncalibrated.</aside>
     <section class="mo-summary" aria-label="MO batch count"><strong>${plan.eligibleCount}</strong><span>eligible VPL/VPP rows</span><span>${plan.sheetCount} cut-and-stack sheets</span><span>${sideMode === "paired" ? plan.pdfPageCount : plan.sheetCount} pages in selected mode</span><span>${layout.fields.length} placed fields</span></section>
    <div class="mo-controls"><label for="moSenderCnic">Sender CNIC # <span>(optional; MO session only)</span></label><input id="moSenderCnic" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="15" value="${escapeHtml(senderCnicInput)}" aria-invalid="${invalidCnic}" aria-describedby="moCnicHelp moCnicError" ${pdfState.exporting ? "disabled" : ""}><small id="moCnicHelp">13 digits; hyphens optional. Printed only on section 1 sender line. Its value is not saved with the layout.</small><p id="moCnicError" class="mo-error" role="alert">${invalidCnic ? "Enter exactly 13 digits, optionally grouped 5-7-1, or clear the field." : ""}</p></div>
    ${layoutEditor}
    <details class="mo-required-fields"><summary>MO fields not bound in this layout</summary><p>The current layout maps only the placed sources. MO number, amount words, other CNICs, relationship/income/reason, dates, offices, postcodes, stamps and signatures remain blank unless the user maps a source or manually enters a session override. Layout success is not postal/official acceptance.</p></details>
    ${layoutMode ? `<details class="mo-manual-overrides"><summary>Optional per-record manual overrides for layout fields</summary><p>These edits are in-memory only. Bind the corresponding “Manual MO-session …” source in the layout to display them.</p>${reviewCards}<button id="confirmMoMappings" type="button" ${pdfState.exporting || !sheet ? "disabled" : ""}>Confirm manual MO-session entries</button></details>` : `<details class="mo-mapping-review"><summary>Per-record user-confirmed DRAFT mapping (LP-047 compatibility mode)</summary><p>This separate mode is available while the layout is empty.</p>${reviewCards}<button id="confirmMoMappings" type="button" ${pdfState.exporting || !sheet ? "disabled" : ""}>Confirm pending manual MO-session entries</button></details>`}
    ${exclusionSummary ? `<details class="mo-exclusions"><summary>${projection.excluded.length} excluded imported records</summary><ul>${exclusionSummary}</ul></details>` : ""}
    <div class="mo-export-controls"><button id="downloadMoPdf" ${pdfState.exporting ? "disabled" : ""}>Download blank manual-completion PDF</button>${layoutReady ? `<button id="downloadMoLayoutPdf" ${pdfState.exporting ? "disabled" : ""}>Download MO PDF</button><button id="printMoBatch" ${pdfState.exporting ? "disabled" : ""}>Print MO Batch</button>` : hasMappings ? `<button id="downloadMoDraftPdf" ${pdfState.exporting || invalidMapping ? "disabled" : ""}>Download user-confirmed DRAFT PDF</button>` : ""}${pdfState.exporting ? `<button id="cancelMoPdf">Cancel export</button>` : ""}<span id="moPdfStatus" role="status" aria-live="polite">${escapeHtml(pdfState.error ?? pdfState.message ?? progressText)}</span></div>
    ${missingLayoutFields.length ? `<p class="mo-mapping-fit-error" role="alert">Selected layout sources are missing on these eligible rows: ${escapeHtml(missingLayoutFields.join(", "))}. Add session values or remove the field; nothing will be truncated.</p>` : ""}<p id="moMappingFitError" class="mo-mapping-fit-error" role="alert"></p>
    <nav class="mo-sheet-nav" aria-label="MO sheet navigation"><button id="moPrevSheet" ${sheetIndex <= 0 || pdfState.exporting ? "disabled" : ""}>Previous sheet</button><label for="moSheetSelect">Sheet <select id="moSheetSelect" ${pdfState.exporting ? "disabled" : ""}>${plan.sheets.map((item, index) => `<option value="${index}" ${index === sheetIndex ? "selected" : ""}>${item.sheetNumber}</option>`).join("")}</select> of ${plan.sheetCount}</label><button id="moNextSheet" ${sheetIndex >= plan.sheetCount - 1 || pdfState.exporting ? "disabled" : ""}>Next sheet</button></nav>
    ${!layoutMode ? `<div class="mo-face-list"><section><h2>Front · Section 1 / Sender and intimation</h2><iframe id="moFrontPreview" title="MO-51 front face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs?.front ?? "")}"></iframe></section><section><h2>Back · Section 2 / M.O.-51 title and payment</h2><iframe id="moBackPreview" title="MO-51 back face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs?.back ?? "")}"></iframe></section></div>` : ""}
    <p class="mo-footer">Print/PDF uses this user-defined layout for the selected batch. It does not assert official postal acceptance or a calibrated physical duplex profile. Saved layout stores source IDs/positions only; customer values and CNIC are never saved with it.</p>
  </section>`;
}
