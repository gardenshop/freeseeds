import type { MoProjection } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { escapeMoAttribute, renderMoPreviewDocuments, type MoBackPreviewRotation } from "./renderer";
import type { MoPdfProgress } from "./pdf";

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

export function renderMoPrintView(
  projection: MoProjection,
  senderCnicInput: string,
  sheetIndex: number,
  backRotation: MoBackPreviewRotation,
  pdfState: MoPdfViewState,
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
  const docs = sheet && !invalidCnic ? renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation) : undefined;
  const progressText = pdfState.progress ? `PDF pages rendered: ${pdfState.progress.completedPages}/${pdfState.progress.totalPages}` : "";

  return `<section class="mo-print-view" data-mo-view>
    <header class="mo-heading"><p class="kicker">MO-51 / LOCAL MANUAL-COMPLETION PACKET</p><h1>Money-order forms.</h1><p>Imported labels are read-only. No order name, address, contact, tracking or amount is placed on this blank form packet.</p></header>
    <aside class="mo-warning" role="note">Authoritative LP-046 mapping: original HTML section 1 is FRONT (sender/receiver and intimation); section 2 is BACK (M.O.-51 title, office, stamps and signatures). Back rotation remains configurable but UNVERIFIED. Download creates blank manual-completion forms only; no printer action is enabled.</aside>
    <section class="mo-summary" aria-label="MO packet count"><strong>${plan.eligibleCount}</strong><span>eligible VPL/VPP rows used for blank-copy quantity only</span><span>${plan.sheetCount} cut-and-stack sheets</span><span>${plan.pdfPageCount} PDF pages</span></section>
    <div class="mo-controls"><label for="moSenderCnic">Sender CNIC # <span>(optional; MO session only)</span></label><input id="moSenderCnic" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="15" value="${escapeHtml(senderCnicInput)}" aria-invalid="${invalidCnic}" aria-describedby="moCnicHelp moCnicError" ${pdfState.exporting ? "disabled" : ""}><small id="moCnicHelp">13 digits; hyphens optional. Printed only at the MO-51 sender CNIC position. Clearing it leaves that line blank.</small><p id="moCnicError" class="mo-error" role="alert">${invalidCnic ? "Enter exactly 13 digits, optionally grouped 5-7-1, or clear the field." : ""}</p></div>
    <details class="mo-required-fields"><summary>Postal fields intentionally left blank</summary><p>The source does not establish party roles or which blanks are mandatory versus postal/manual. This PDF is not a completed MO and does not associate forms with orders. Do not treat it as ready for postal use.</p><ul><li>MO number/date; article number/type; amount in figures and words</li><li>Remitter/payee/addressee identity, names, addresses and telephones</li><li>Other CNICs, relationships, source of income, and remittance reason</li><li>Issuing, delivery and paying offices; postcodes; journal/declaration/article dates</li><li>Postal stamps, witness/clerk details, thumb impression, signatures and payment fields</li></ul></details>
    ${exclusionSummary ? `<details class="mo-exclusions"><summary>${projection.excluded.length} excluded imported records</summary><ul>${exclusionSummary}</ul></details>` : ""}
    ${plan.sheetCount === 0 ? `<p class="mo-empty">No selected, valid VPL/VPP records are available for an MO manual-completion packet.</p>` : invalidCnic ? `<p class="mo-empty">Preview/export withheld until the invalid nonblank CNIC is corrected or cleared.</p>` : `<div class="mo-export-controls"><button id="downloadMoPdf" ${pdfState.exporting ? "disabled" : ""}>Download MO PDF</button>${pdfState.exporting ? `<button id="cancelMoPdf">Cancel export</button>` : ""}<span id="moPdfStatus" role="status" aria-live="polite">${escapeHtml(pdfState.error ?? pdfState.message ?? progressText)}</span></div><div class="mo-orientation"><label for="moBackRotation">Back preview rotation <span>UNVERIFIED / not a printer profile</span></label><select id="moBackRotation" ${pdfState.exporting ? "disabled" : ""}><option value="none" ${backRotation === "none" ? "selected" : ""}>Upright (default)</option><option value="rotate-180" ${backRotation === "rotate-180" ? "selected" : ""}>Rotate each back form 180°</option></select></div><nav class="mo-sheet-nav" aria-label="MO proof sheet navigation"><button id="moPrevSheet" ${sheetIndex <= 0 || pdfState.exporting ? "disabled" : ""}>Previous sheet</button><label for="moSheetSelect">Sheet <select id="moSheetSelect" ${pdfState.exporting ? "disabled" : ""}>${plan.sheets.map((item, index) => `<option value="${index}" ${index === sheetIndex ? "selected" : ""}>${item.sheetNumber}</option>`).join("")}</select> of ${plan.sheetCount}</label><button id="moNextSheet" ${sheetIndex >= plan.sheetCount - 1 || pdfState.exporting ? "disabled" : ""}>Next sheet</button></nav><div class="mo-face-list"><section><h2>Front · Section 1 / Sender and intimation</h2><iframe id="moFrontPreview" title="MO-51 front face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.front)}"></iframe></section><section><h2>Back · Section 2 / M.O.-51 title and payment</h2><iframe id="moBackPreview" title="MO-51 back face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.back)}"></iframe></section></div>`}
    <p class="mo-footer">PDF pages are blank manual-completion copies, except optional Sender CNIC. They are not completed official orders, postal/legal acceptance, calibrated duplex output or proof of payment.</p>
  </section>`;
}
