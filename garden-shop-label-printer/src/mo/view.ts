import type { MoProjection } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { escapeMoAttribute, renderMoPreviewDocuments } from "./renderer";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]!);

export function renderMoPrintView(projection: MoProjection, senderCnicInput: string, sheetIndex: number): string {
  const plan = imposeMoCandidates(projection.candidates);
  const cnic = formatSenderCnic(senderCnicInput);
  const sheet = plan.sheets[sheetIndex] ?? plan.sheets[0];
  const excludedCounts = new Map<string, number>();
  for (const record of projection.excluded) {
    for (const reason of record.reasons) excludedCounts.set(reason.code, (excludedCounts.get(reason.code) ?? 0) + 1);
  }
  const exclusionSummary = Array.from(excludedCounts, ([reason, count]) => `<li>${count} excluded · ${escapeHtml(reason)}</li>`).join("");
  const invalidCnic = cnic.status === "invalid";
  const docs = sheet && !invalidCnic ? renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "") : undefined;

  return `<section class="mo-print-view" data-mo-view>
    <header class="mo-heading"><p class="kicker">MO-51 / LOCAL PREVIEW ONLY</p><h1>Money-order forms.</h1><p>Existing label data is read-only. Postal roles, values and reserved fields remain blank until verified.</p></header>
    <aside class="mo-warning" role="note">The uploaded HTML does not identify the physical front/back order. This preview provisionally calls the M.O.-51 title side “front”; no duplex rotation or print/PDF output is enabled.</aside>
    <section class="mo-summary" aria-label="MO eligibility summary"><strong>${plan.eligibleCount}</strong><span>eligible VPL/VPP records</span><span>${plan.sheetCount} cut-and-stack sheets</span><span>${plan.pdfPageCount} logical faces</span></section>
    <div class="mo-controls"><label for="moSenderCnic">Sender CNIC # <span>(optional; MO session only)</span></label><input id="moSenderCnic" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="15" value="${escapeHtml(senderCnicInput)}" aria-invalid="${invalidCnic}" aria-describedby="moCnicHelp moCnicError"><small id="moCnicHelp">13 digits; hyphens optional. Printed only at the MO-51 sender CNIC position. Clearing it leaves that line blank.</small><p id="moCnicError" class="mo-error" role="alert">${invalidCnic ? "Enter exactly 13 digits, optionally grouped 5-7-1, or clear the field." : ""}</p></div>
    ${exclusionSummary ? `<details class="mo-exclusions"><summary>${projection.excluded.length} excluded imported records</summary><ul>${exclusionSummary}</ul></details>` : ""}
    ${plan.sheetCount === 0 ? `<p class="mo-empty">No selected, valid VPL/VPP records are available for MO preview.</p>` : invalidCnic ? `<p class="mo-empty">Preview withheld until the invalid nonblank CNIC is corrected or cleared.</p>` : `<nav class="mo-sheet-nav" aria-label="MO proof sheet navigation"><button id="moPrevSheet" ${sheetIndex <= 0 ? "disabled" : ""}>Previous sheet</button><label for="moSheetSelect">Sheet <select id="moSheetSelect">${plan.sheets.map((item, index) => `<option value="${index}" ${index === sheetIndex ? "selected" : ""}>${item.sheetNumber}</option>`).join("")}</select> of ${plan.sheetCount}</label><button id="moNextSheet" ${sheetIndex >= plan.sheetCount - 1 ? "disabled" : ""}>Next sheet</button></nav><div class="mo-face-list"><section><h2>Front · provisional title side</h2><iframe id="moFrontPreview" title="MO-51 front face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.front)}"></iframe></section><section><h2>Back · provisional intimation side · unrotated</h2><iframe id="moBackPreview" title="MO-51 back face preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" srcdoc="${escapeMoAttribute(docs!.back)}"></iframe></section></div>`}
    <p class="mo-footer">Preview only. Not an official completed postal form, print job, PDF, or acceptance evidence.</p>
  </section>`;
}
