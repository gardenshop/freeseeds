import {
  FIELDS,
  type AuditEvent,
  type ImportMapping,
  type Order,
} from "./types";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-700.css";
import {
  PAPER_PRESETS,
  type PaperPresetId,
  getPaperPreset,
  pagePoints,
  addA4Page,
  detectMapping,
  labelBox,
  findAmbiguousMappings,
  MM_TO_POINTS,
  normalizeRows,
  normalizeAddressText,
  normalizePakistaniPhone,
  pagesForCount,
  parseCsv,
  safeContactRemoval,
  safeCsvCell,
  TEMPLATE_VERSION,
} from "./engine";
import "./style.css";
import "../public/label.css";
import { CODE128_LAYOUT, destinationBoxes, fitCommissionExpression, fitTextMm, fitTextPx, HP_P2055_PRINT_ALLOWANCE_MM, HP_P2055_SAFE_EDGE_MM, labelBoxes, labelContentTransform, labelFontFamily, LABEL_FOOTER_ADDRESS, recipientBoxes, transformLabelContentBox, transformLabelContentPoint, usesArabicScript, usesComplexScript } from "./layout";
import { normalizeTrackingReference, trackingLabelDisplay } from "./tracking-rules";
import { restoreZeroFormattedCells } from "./xlsx";
import { LABEL_REFERENCE_NOTICE, reserveLabelReference, updateLabelReferenceSource } from "./references";
import "./mo/view.css";
import "./mo/editor.css";
import { projectMoRecords } from "./mo/adapter";
import { formatSenderCnic } from "./mo/cnic";
import { renderMoPrintView, type MoPdfViewState } from "./mo/view";
import { findMoLayoutDiagnostics, validateMoBatchLayout, type MoBackPreviewRotation, type MoBatchLayoutValidation, type MoLayoutDiagnostic } from "./mo/renderer";
import { emptyMoSessionMapping, hasMoSessionMapping, moSessionMappingError, type MoSessionMapping, type MoSessionMappingKey } from "./mo/mapping";
import { correctMoPartyPositions, hasLegacyMoPartyPositions, MO_LAYOUT_SOURCES, defaultMoLayout, loadMoLayout, newMoLayoutField, removeMoLayoutField, resetMoLayout, resolveMoLayoutSource, saveMoLayout, updateMoLayoutField as updateLayoutFieldConfig, validateMoLayout, type MoDataSource, type MoLayout, type MoLayoutAlignment, type MoLayoutFace, type MoLayoutField } from "./mo/layout";
import { proposeMoLayoutRepair, type MoLayoutRepairPlan } from "./mo/layout-repair";
import { isExpectedMoPrintTarget } from "./mo/print-target";

const app = document.querySelector<HTMLDivElement>("#app")!;
const monitoringUrl =
  import.meta.env.VITE_MONITOR_URL?.replace(/\/$/, "") ?? "";
const adminUrl =
  import.meta.env.VITE_ADMIN_URL ??
  "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/";
const sampleHeaders = [
  "Order ID",
  "Name",
  "Cell #",
  "Address",
  "Facebook Name",
  "Tracking Number",
  "COD",
  "Product",
  "City",
  "Province",
  "Nearby Landmark",
];
const sampleRows = [
  [
    "GS-TEST-001",
    "Amina Sample",
    "03001234567",
    "House 14, Model Town",
    "",
    "VPL000001",
    "1250",
    "Garden Seed Mix",
    "Sahiwal",
    "Punjab",
    "Clock Tower",
  ],
  [
    "GS-TEST-002",
    "Zara Example",
    "03001234568",
    "Street 8, Satellite Town",
    "",
    "VPL000002",
    "800",
    "Kitchen Garden Starter",
    "Multan",
    "Punjab",
    "Near Public Library",
  ],
  [
    "GS-TEST-003",
    "M. Sample",
    "03001234569",
    "Village Noor Pur, Post Office Noor Pur",
    "",
    "VPL000003",
    "1800",
    "Tomato Seeds x 4",
    "Okara",
    "Punjab",
    "Main bazaar",
  ],
];
let headers: string[] = [];
let rawRows: unknown[][] = [];
let workbookDate1904 = false;
let rows: Order[] = [];
let mapping: ImportMapping = detectMapping([]);
let batchId = crypto.randomUUID();
let view = "upload";
let selected = new Set<number>();
let page = 0;
let zoom = 1;
let startPosition = 1;
let countLimit = -1;
let paperPresetId: PaperPresetId = "A4";
let hpP2055SafeArea = true;
let activeLabel = -1;
let importedFileName = "";
let printRequested = false;
let colorAccent = false;
let statusMessage = "Workbook data stays in this browser tab.";
let moSenderCnicInput = "";
let moSheetIndex = 0;
let moBackRotation: MoBackPreviewRotation = "none";
let moPdfState: MoPdfViewState = Object.freeze({ exporting: false });
let moPdfAbort: AbortController | undefined;
let moSessionMappings = new Map<number, MoSessionMapping>();
let moPendingMappings = new Map<number, MoSessionMapping>();
function initialMoLayout(): MoLayout {
  try { return loadMoLayout(window.localStorage); } catch { return defaultMoLayout(); }
}
let moLayout = initialMoLayout();
let moLayoutEditMode = true;
let moLayoutSampleSourceIndex: number | undefined;
let moSelectedLayoutFieldId: string | undefined;
let moLayoutStatus = "Layout definitions are local-only; record values are never saved.";
let moLayoutError = "";
type MoLayoutBatchState = Readonly<{ signature: string; status: "pending" | "checking" | "valid" | "blocked" | "error"; report?: MoBatchLayoutValidation; error?: string }>;
type MoLayoutRepairPreview = Readonly<{ plan: MoLayoutRepairPlan; validation: "pending" | "checking" | "valid" | "blocked" | "error"; report?: MoBatchLayoutValidation; error?: string }>;
let moLayoutBatchState: MoLayoutBatchState | undefined;
let moLayoutBatchAbort: AbortController | undefined;
let moLayoutBatchTimer: number | undefined;
let moLayoutBatchGeneration = 0;
let moLayoutRepairPreview: MoLayoutRepairPreview | undefined;
let moLayoutRepairAbort: AbortController | undefined;
let moPrintSideMode: "paired" | "front-only" | "back-only" = "paired";
let moCleanPreview = false;
let moCleanPreviewFace: "front" | "back" = "front";
let moPendingLayoutSource: MoDataSource | undefined;
let moEditorZoom = 1;
let moEditorResizeObserver: ResizeObserver | undefined;
let moEditorWindowResizeBound = false;
let moMappingHandlersBound = false;
let moLayoutPointer: Readonly<{ id: string; face: MoLayoutFace; slot: number; mode: "move" | "resize"; startX: number; startY: number; grabXmm: number; grabYmm: number; field: MoLayoutField }> | undefined;
let moLastSourceDragAt = 0;
let moPrintWindow: Window | null = null;
const MO_PRINT_BLOB_URL_FALLBACK_MS = 30 * 60 * 1000;

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
async function logEvent(
  eventType: AuditEvent["eventType"],
  counts: AuditEvent["counts"] = {},
  errorCode?: string,
) {
  if (!monitoringUrl) {
    statusMessage =
      "Monitoring is not configured locally; labels remain available.";
    render();
    return false;
  }
  try {
    const response = await fetch(`${monitoringUrl}/api/events`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        batchId,
        templateVersion: TEMPLATE_VERSION,
        counts,
        ...(errorCode ? { errorCode } : {}),
      }),
    });
    if (!response.ok) throw new Error(`MONITORING_HTTP_${response.status}`);
    return true;
  } catch {
    statusMessage =
      "Monitoring unavailable. Label work is safe and was not lost.";
    render();
    return false;
  }
}

async function reserveRowReferences(orders: Order[]) {
  for (const row of orders) {
    if (row.printedReference || !row.tracking.trim()) continue;
    try {
      row.printedReference = await reserveLabelReference(row.orderId, row.tracking);
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : "";
      row.warnings.push(`Printed reference could not be reserved locally${reason}; retry before printing.`);
    }
  }
}

function currentOrders(): Array<{ row: Order; index: number }> {
  const ids = [...selected];
  const chosen = ids
    .map((index) => ({ row: rows[index], index }))
    .filter((item) => item.row);
  return countLimit >= 0 ? chosen.slice(0, countLimit) : chosen;
}

function currentPaperPreset() {
  return getPaperPreset(paperPresetId);
}

function nav() {
  return `<header class="topbar"><a class="brand" href="#upload" data-view="upload"><span class="brand-mark">GS</span><span><b>Garden Shop</b><small>LABEL STUDIO / INTERNAL</small></span></a><a class="admin-return" id="backToAdmin" href="${esc(adminUrl)}" rel="noopener noreferrer">← Back to Admin</a><nav aria-label="Main navigation">${[
    ["upload", "Import"],
    ["review", "Review"],
    ["preview", "Sheet preview"],
    ["print", "Print & export"],
    ["mo", "MO Print"],
    ["admin", "Monitoring"],
  ]
    .map(
      ([id, label]) =>
        `<button data-view="${id}" class="nav-item ${view === id ? "active" : ""}" ${id !== "admin" && rows.length === 0 && id !== "upload" ? "disabled" : ""}>${label}</button>`,
    )
    .join(
      "",
    )}</nav><span class="connection"><i></i>${monitoringUrl ? "Audit service configured" : "Local-only mode"}</span></header>`;
}

function renderUpload() {
  return `<section class="intro"><div><p class="kicker">SHIPPING OPERATIONS / ${new Date().toLocaleDateString()}</p><h1>Labels that land<br><em>exactly where they should.</em></h1><p class="lede">Import a dispatch workbook, verify every detail, then print calibrated A4 sheets.</p></div><div class="intro-stamp">A4<br><b>18</b><br>PER SHEET</div></section>
    <section class="upload-grid"><article class="upload-card"><div class="card-number">01 / IMPORT</div><h2>Choose a workbook</h2><p>Excel or CSV. Your file is read locally and never uploaded to monitoring.</p><label class="dropzone" for="workbook"><span class="upload-icon">↑</span><strong>Drop a file or browse</strong><small>.xlsx · .csv · up to 10 MB</small><input id="workbook" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"></label><div class="button-row"><button class="button secondary" id="template">Download template</button><button class="button ghost" id="sample">Load sample records</button></div></article>
    <article class="note-card"><div class="card-number">02 / PRIVATE BY DESIGN</div><h2>Your dispatch data stays yours.</h2><p>Names, phone numbers and addresses remain in this browser tab. Monitoring stores counts and pseudonymous staff activity only.</p><div class="privacy-rule"><span>LOCAL</span><div></div><span>NO CUSTOMER DATA</span></div><p class="micro">Print request and staff-confirmed print completion are recorded separately. Neither is proof of a physical print.</p></article></section>
    <p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function renderMapping() {
  const ambiguous = findAmbiguousMappings(headers);
  const ambiguityNote = ambiguous.length
    ? `<div class="mapping-warning" role="alert">Choose the correct source for ambiguous fields: ${ambiguous.map(({ label, headers: sources }) => `${esc(label)} (${sources.map(esc).join(" / ")})`).join("; ")}.</div>`
    : "";
  return `<section class="section-heading"><div><p class="kicker">IMPORT / FIELD MAPPING</p><h1>Match your columns.</h1><p>Confirm each source column before importing. Facebook Name only becomes tracking when you explicitly choose it.</p></div><div class="file-pill">${esc(importedFileName)} · ${rawRows.length} rows</div></section>${ambiguityNote}<div class="mapping-list">${FIELDS.map(({ key, label, required }) => `<label class="mapping-row"><span>${esc(label)} ${required ? '<b class="required">Required</b>' : ""}</span><select data-map="${key}"><option value="">Not mapped</option>${headers.map((header) => `<option value="${esc(header)}" ${mapping[key] === header ? "selected" : ""}>${esc(header)}</option>`).join("")}</select></label>`).join("")}</div><div class="button-row"><label class="check"><input id="savePreset" type="checkbox"> Save mapping on this device</label><button class="button primary" id="applyMapping">Review ${rawRows.length} rows <span>→</span></button></div><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function renderReview() {
  const q = (
    document.querySelector<HTMLInputElement>("#rowSearch")?.value ?? ""
  ).toLowerCase();
  const filtered = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      [
        row.orderId,
        row.name,
        row.phone,
        row.tracking,
        row.product,
        row.city,
      ].some((field) => field.toLowerCase().includes(q)),
    );
  return `<section class="section-heading"><div><p class="kicker">DISPATCH / DATA REVIEW</p><h1>Review every parcel.</h1><p>${rows.length} imported · ${rows.filter((row) => row.warnings.length).length} flagged · ${rows.length - selected.size} available to select</p></div><button class="button secondary" id="newBatch">Start another batch</button></section><div class="toolbar"><label class="search">⌕ <input id="rowSearch" type="search" placeholder="Search name, city, product…" value="${esc(q)}"></label><button class="button ghost" id="selectAll">${selected.size === rows.length ? "Clear selection" : "Select all"}</button><span class="selection-count">${selected.size} selected</span></div><div class="table-wrap"><table><thead><tr><th></th><th>ORDER / NAME</th><th>CITY</th><th>TRACKING</th><th>PRODUCT</th><th>DECLARED VALUE</th><th>VALIDATION</th></tr></thead><tbody>${filtered.map(({ row, index }) => `<tr><td><input type="checkbox" data-select="${index}" ${selected.has(index) ? "checked" : ""} aria-label="Select row ${index + 1}"></td><td><button class="row-edit" data-edit="${index}"><b>${esc(row.orderId || "No Order ID")}</b><span>${esc(row.name || "Unnamed receiver")}</span></button></td><td>${esc([row.city, row.province].filter(Boolean).join(", ") || "—")}</td><td>${esc(row.tracking || "—")}</td><td>${esc(row.product || "—")}</td><td>${esc(row.cod || "—")}</td><td>${row.warnings.length ? `<span class="warning-badge" title="${esc(row.warnings.join("; "))}">${row.warnings.length} check${row.warnings.length > 1 ? "s" : ""}</span>` : '<span class="ok-badge">Ready</span>'}</td></tr>`).join("") || '<tr><td colspan="7" class="empty-row">No matching orders.</td></tr>'}</tbody></table></div><div class="button-row end"><button class="button primary" data-view="preview">Open A4 preview <span>→</span></button></div><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function boxStyle(box: { x: number; y: number; width: number; height: number }) {
  return `style="--box-x:${box.x}mm;--box-y:${box.y}mm;--box-width:${box.width}mm;--box-height:${box.height}mm"`;
}

function labelMarkup(row: Order, index: number, _compact = false) {
  const preset = currentPaperPreset();
  const boxes = labelBoxes(preset);
  const phone = normalizePakistaniPhone(row.phone);
  const display = trackingLabelDisplay(row.tracking, row.cod);
  const destination = destinationBoxes(document.createElement("canvas").getContext("2d")!, row.city, row.province, preset, display.expandDestination);
  const blockedReason = printBlocker(row);
  const prefixClass = display.prefix === "UNKNOWN" ? "prefix-unknown" : `prefix-${display.prefix.toLowerCase()}`;
  const trackingBox = display.showAmountBox
    ? `<div class="vpl-box layout-box ${display.error ? "invalid-amount" : ""}" ${boxStyle(boxes.vpl)} aria-label="${esc(display.error ?? `${display.prefix} ${display.declaredAmount}+${display.commission}`)}"><strong class="vpl-prefix">${display.prefix}</strong><div class="vpl-amount"><span class="vpl-declared">${display.declaredAmount ?? "FIX AMOUNT"}</span>${display.commission === undefined ? "" : `<span class="vpl-commission">+${display.commission}</span>`}</div></div>`
    : display.prefix === "UNKNOWN"
      ? `<div class="prefix-warning layout-box" ${boxStyle(boxes.vpl)}>CHECK PREFIX</div>`
      : "";
  return `<article class="label ${prefixClass} ${colorAccent ? "color-accent" : ""} ${blockedReason ? "layout-overflow" : ""}" data-label-index="${index}" data-paper-preset="${preset.id}" data-tracking-prefix="${display.prefix}" style="--label-width:${preset.labelWidthMm}mm;--label-height:${preset.labelHeightMm}mm"><div class="label-content">
    <span class="tracking-value layout-box" ${boxStyle(boxes.trackingText)}->${esc(row.tracking)}</span>
    <canvas class="barcode-canvas layout-box" ${boxStyle(boxes.barcode)} data-barcode="${index}" data-source="${esc(row.tracking)}" aria-label="Code 128 barcode"></canvas>
    <span class="tracking-divider layout-box" ${boxStyle(boxes.trackingDivider)} aria-hidden="true"></span>
    ${trackingBox}
    <div class="destination layout-box ${display.expandDestination ? "expanded-destination" : ""}" ${boxStyle(destination.container)}><strong class="city-text">${esc(row.city)}</strong><span class="province-text">${esc(row.province)}</span></div>
    <div class="order-product-frame layout-box" ${boxStyle(boxes.orderProduct)} aria-hidden="true"></div>
    <div class="order-id layout-box" ${boxStyle(boxes.orderId)}><span class="field-heading">Order ID</span><strong class="printed-reference">${esc(row.printedReference)}</strong></div>
    <span class="contact-divider layout-box" ${boxStyle(boxes.contactDivider)} aria-hidden="true"></span>
    <div class="contact layout-box" ${boxStyle(boxes.contact)}><span class="field-heading">Contact Number</span><strong class="contact-number">${phone ? esc(phone) : ""}</strong></div>
    <div class="to-border layout-box" ${boxStyle(boxes.to)} aria-hidden="true"></div>
    <b class="to-heading layout-box" ${boxStyle(boxes.toTag)}>To:</b>
    <strong class="receiver-name layout-box" ${boxStyle(boxes.name)}>${esc(row.name)}</strong>
    <div class="address-text layout-box" ${boxStyle(boxes.address)}>${esc(row.address)}</div>
    <strong class="nearby-label layout-box" ${boxStyle(boxes.nearbyLabel)}>Near by:</strong>
    <div class="landmark layout-box" ${boxStyle(boxes.landmark)}>${esc(row.landmark)}</div>
    <div class="product-row-frame layout-box" ${boxStyle(boxes.product)} aria-hidden="true"></div>
    <b class="product-label layout-box" ${boxStyle(boxes.productLabel)}>Product:</b>
    <strong class="product-value layout-box" ${boxStyle(boxes.productValue)}>${esc(row.product)}</strong>
    <div class="footer-rule layout-box" ${boxStyle(boxes.footer)} aria-hidden="true"></div>
    <strong class="footer-from layout-box" ${boxStyle(boxes.footerFrom)}>From:</strong>
    <b class="footer-sender layout-box" ${boxStyle(boxes.footerSender)}>${esc(row.senderName || "Garden Shop")}</b>
    <span class="footer-divider layout-box" ${boxStyle(boxes.footerDivider)} aria-hidden="true"></span>
    <span class="footer-address layout-box" ${boxStyle(boxes.footerAddress)}>${LABEL_FOOTER_ADDRESS}</span>
  </div></article>`;
}

function overflowingLayoutFields(row: Order): string[] {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return ["text measurement"];
  const preset = currentPaperPreset();
  const boxes = labelBoxes(preset);
  const display = trackingLabelDisplay(row.tracking, row.cod);
  const recipient = recipientBoxes(context, row.name, preset);
  const destination = destinationBoxes(context, row.city, row.province, preset, display.expandDestination);
  const check = (text: string, box: { width: number; height: number }, max: number, min: number, bold = false, wrap = true, lineHeight = 1) =>
    !text.trim() || fitTextMm(context, text, box.width, box.height, max, min, bold, lineHeight, wrap).fits;
  const checks: Array<[string, boolean]> = [
    ["tracking text", check(row.tracking, boxes.trackingText, 9, 6.5, true, false)],
    ["printed reference", check(row.printedReference, { width: boxes.orderId.width, height: boxes.orderId.height - 1.35 * preset.labelHeightMm / 44 }, 11, 8, false, false)],
    ["product", check(row.product, boxes.productValue, 10, 6.5, true, false, 1)],
    ["destination city", check(row.city, destination.city, usesArabicScript(row.city) ? 10.5 : 15, 7, true, true, 0.95)],
    ["province", check(row.province, destination.province, 9.5, 6, true, true, destination.province.height > 3.1 ? 0.95 : 1)],
    ["receiver name", check(row.name, recipient.name, 12, 9, true, true, 1)],
    ["address", check(row.address, recipient.address, 11, 8)],
    ["landmark", check(row.landmark, boxes.landmark, 9.5, 7.5, false, true, 1)],
    ["contact heading", check("Contact Number", { width: boxes.contact.width, height: 1.3 * preset.labelHeightMm / 44 }, 6.3, 4.5, true, false, 0.95)],
    ["phone", check(normalizePakistaniPhone(row.phone) ?? "", { width: boxes.contact.width, height: boxes.contact.height - 1.35 * preset.labelHeightMm / 44 }, 12, 9, true, false, 1)],
    ["From", check("From:", boxes.footerFrom, 9, 7, true, false, 1)],
    ["sender", check("Garden Shop", boxes.footerSender, 10, 6.5, true, false, 1)],
    ["footer address", check(LABEL_FOOTER_ADDRESS, boxes.footerAddress, 8, 6.5, false, false, 1)],
    ["product heading", check("Product:", boxes.productLabel, 7.5, 6.5, true, false, 1)],
  ];
  if (display.showAmountBox && display.declaredAmount !== undefined && display.commission !== undefined) {
    const widthPx = (boxes.vpl.width - 1) * 96 / 25.4;
    const heightPx = 5 * preset.labelHeightMm / 44 * 96 / 25.4;
    const fit = fitCommissionExpression(context, String(display.declaredAmount), display.commission, widthPx, heightPx);
    checks.push(["declared amount and commission", fit.fits]);
  }
  return checks.filter(([, fits]) => !fits).map(([field]) => field);
}

function printBlocker(row: Order): string | undefined {
  if (!row.tracking.trim()) return "Tracking number is required for the Code 128 barcode.";
  const trackingDisplay = trackingLabelDisplay(row.tracking, row.cod);
  if (trackingDisplay.error) return trackingDisplay.error;
  if (!row.printedReference) return "Printed reference has not been reserved in this browser.";
  if (!row.name) return "Receiver name is required.";
  if (!normalizePakistaniPhone(row.phone)) return "Correct invalid contact numbers before printing.";
  if (!row.address) return "Delivery address is required.";
  if (!row.city || !row.province) return "Destination city and province are required.";
  const overflows = overflowingLayoutFields(row);
  if (overflows.length) return "Text does not fit: " + overflows.join(", ") + ". Correct or exclude this label.";
  const blockingWarning = row.warnings.find((warning) =>
    warning.startsWith("Tracking number is missing") ||
    warning.startsWith("Contact number is missing") ||
    warning.startsWith("Contact number is invalid") ||
    warning.startsWith("Delivery address is required") ||
    warning.startsWith("Receiver name is required") ||
    warning.startsWith("Destination city or province") ||
    warning.startsWith("Unsupported tracking prefix") ||
    warning.startsWith("Declared VPL amount") ||
    warning.startsWith("Declared VPP amount") ||
    warning.startsWith("Printed reference") ||
    warning.startsWith("Tracking barcode is too dense") ||
    warning.startsWith("Duplicate tracking number"),
  );
  if (blockingWarning) return blockingWarning;
  return undefined;
}

function renderPreview() {
  const preset = currentPaperPreset();
  const chosen = currentOrders();
  const pages = Math.max(1, pagesForCount(chosen.length, startPosition));
  const currentPage = Math.min(page, pages - 1);
  page = currentPage;
  const pageItems = Array.from({ length: preset.rows * preset.columns }, (_, slot) => {
    const orderIndex = currentPage * 18 + slot - (startPosition - 1);
    return orderIndex >= 0 && chosen[orderIndex]
      ? labelMarkup(chosen[orderIndex].row, chosen[orderIndex].index)
      : '<div class="empty-label" aria-hidden="true"></div>';
  });
  const row = activeLabel >= 0 ? rows[activeLabel] : undefined;
  const rowBlocker = row ? printBlocker(row) : undefined;
  const paperStyle = `--zoom:${zoom};--page-width:${preset.widthMm}mm;--page-height:${preset.heightMm}mm;--label-width:${preset.labelWidthMm}mm;--label-height:${preset.labelHeightMm}mm;--page-padding-x:${preset.columnStartsMm[0]}mm;--page-padding-y:${preset.rowStartsMm[0]}mm;--grid-gap-x:${preset.columnGapMm}mm;--grid-gap-y:${preset.rowGapMm}mm`;
  return `<section class="section-heading"><div><p class="kicker">LAYOUT / ${esc(preset.label)}</p><h1>Sheet preview.</h1><p>${preset.labelWidthMm} × ${preset.labelHeightMm} mm labels · 3 columns × 6 rows · ${preset.columnGapMm} / ${preset.rowGapMm} mm gutters</p></div><div class="preview-controls"><button class="button secondary" id="zoomOut" aria-label="Zoom out">−</button><span>${Math.round(zoom * 100)}%</span><button class="button secondary" id="zoomIn" aria-label="Zoom in">+</button></div></section><div class="preview-layout"><div class="sheet-scroller"><div class="sheet" style="${paperStyle}">${pageItems.join("")}</div></div><aside class="preview-aside"><span class="kicker">BATCH SHEET</span><strong>${chosen.length} <small>labels</small></strong><div class="page-nav"><button id="prevPage" ${currentPage <= 0 ? "disabled" : ""}>←</button><span>Page ${currentPage + 1} / ${pages}</span><button id="nextPage" ${currentPage >= pages - 1 ? "disabled" : ""}>→</button></div><label>Start at position<select id="startPosition">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${startPosition === i + 1 ? "selected" : ""}>Label ${i + 1}</option>`).join("")}</select></label>${row ? `<div class="individual-preview"><span class="kicker">INDIVIDUAL LABEL · ROW ${row.rowNumber}</span>${labelMarkup(row, activeLabel, true)}</div>${rowBlocker ? `<p class="mapping-warning" role="alert">Selected label cannot print: ${esc(rowBlocker)} Review this complete field before printing.</p>` : ""}` : '<p class="micro">Click an order below or in Review to inspect its label.</p>'}<button class="button primary full" data-view="print">Continue to print <span>→</span></button></aside></div><div class="preview-selection">${chosen
    .slice(currentPage * 18, currentPage * 18 + 18)
    .map(
      ({ row, index }) =>
        `<button data-focus-label="${index}" class="preview-chip ${activeLabel === index ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span>${esc(row.name || "Unnamed")}</button>`,
    )
    .join(
      "",
    )}</div><p class="status-line" role="status">${esc(statusMessage)}</p>`.replace("monochrome", "1 mm gutters · black-and-white, green optional");
}

function renderPrint() {
  const preset = currentPaperPreset();
  const selectedOrders = currentOrders();
  const excluded = selectedOrders.filter(({ row }) => printBlocker(row));
  const chosen = selectedOrders.filter(({ row }) => !printBlocker(row));
  const pages = pagesForCount(chosen.length, startPosition);
  const blockedItem = selectedOrders.length > 0 && chosen.length === 0 ? excluded[0] : undefined;
  const blockedReason = blockedItem ? printBlocker(blockedItem.row) : undefined;
  const blocked = Boolean(blockedItem);
  const countValue = countLimit > 0 ? Math.min(countLimit, chosen.length) : chosen.length;
  return `<section class="section-heading"><div><p class="kicker">OUTPUT / ACTUAL SIZE</p><h1>Ready for the printer.</h1><p>${chosen.length} labels · ${pages} ${esc(preset.label)} page${pages === 1 ? "" : "s"} · unused slots stay blank</p></div><div class="output-badge">100%<small>PHYSICAL SCALE</small></div></section>
    <section class="print-panel"><div class="print-summary"><h2>Print setup</h2><p>Use ${esc(preset.label)} portrait and Actual size / 100% in the printer dialog. Turn off browser headers and footers.</p>${preset.id === "CUSTOM" ? `<p class="mapping-warning" role="alert">HP LaserJet P2055dn: select or define 190.5 × 254 mm custom portrait paper in both browser and driver. Disable Fit/Shrink and duplex; use Tray 1/manual feed when supported. The optional shared HP profile reserves a ${HP_P2055_PRINT_ALLOWANCE_MM} mm practical gap beyond the measured 4.233 mm hardware edge (content edge ${HP_P2055_SAFE_EDGE_MM} mm); label cells and PDF MediaBox remain unchanged. Verify one calibration sheet before using pre-cut stock.</p><label class="confirm-print"><input id="hpP2055SafeArea" type="checkbox" ${hpP2055SafeArea ? "checked" : ""}> HP LaserJet P2055dn safe-area content inset for Image Print and PDF</label>` : ""}${preset.marginWarning ? `<p class="mapping-warning" role="alert">${esc(preset.marginWarning)}</p>` : ""}
    <label>Paper preset<select id="paperPreset">${Object.values(PAPER_PRESETS).map((option) => `<option value="${option.id}" ${paperPresetId === option.id ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label>
    ${excluded.length ? `<p class="mapping-warning" role="alert">${excluded.length} selected label${excluded.length === 1 ? "" : "s"} will be excluded from output until corrected or deselected.</p>` : ""}${blocked ? `<p class="mapping-warning" role="alert">Label ${blockedItem!.index + 1}: ${esc(blockedReason ?? "Resolve this record in Review before printing.")}</p>` : ""}
    <label>Start at position<select id="printStart">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${startPosition === i + 1 ? "selected" : ""}>Label ${i + 1}</option>`).join("")}</select></label>
    <label>Number of labels<input id="countLimit" type="number" min="0" max="${chosen.length}" value="${countValue}" aria-describedby="countHelp"></label><small id="countHelp">Set to ${chosen.length} to print the full valid selection.</small>
    <label class="confirm-print"><input id="colorAccent" type="checkbox" ${colorAccent ? "checked" : ""}> Use the Garden Shop green accent (color printer)</label>
    <div class="print-actions"><button class="button primary" id="printNow" ${blocked ? "disabled" : ""}>Print ${chosen.length} labels</button><button class="button secondary" id="savePdf" ${blocked ? "disabled" : ""}>Download PDF</button><button class="button ghost" id="printOne" ${activeLabel < 0 || !rows[activeLabel] || printBlocker(rows[activeLabel]) ? "disabled" : ""}>Print individual</button></div>
    <label class="confirm-print"><input id="confirmPrinted" type="checkbox"> I confirm the print job completed on the printer.</label></div>
    <div class="print-notice"><b>Print requests are not print proof.</b><p>Browser print is logged as a request. Only the separate confirmation above records staff-confirmed completion; neither signal comes from printer telemetry.</p><p>Check one test sheet with a ruler before using pre-cut stock. Physical dimensions depend on printer and driver.</p></div></section><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function renderAdmin() {
  return `<section class="section-heading"><div><p class="kicker">RESTRICTED / SUPER ADMIN</p><h1>Operational activity.</h1><p>Reports are provided by the separately authenticated monitoring Worker. This page does not grant access by itself.</p></div><button class="button secondary" id="refreshAdmin">Refresh report</button></section><div id="adminReports" class="admin-reports"><div class="report-card">Loading protected report…</div></div><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function currentMoLayoutSignature(layout: MoLayout, projection = currentMoProjection()): string {
  const formattedCnic = formatSenderCnic(moSenderCnicInput);
  const cnic = formattedCnic.status === "valid" ? formattedCnic.formatted : "";
  return JSON.stringify({
    fields: layout.fields,
    indexes: projection.candidates.map((candidate) => candidate.sourceIndex),
    values: projection.candidates.map((candidate) => layout.fields.map((field) => resolveMoLayoutSource(candidate, field.source, cnic, moSessionMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())?.value ?? "")),
    sideMode: moPrintSideMode,
    backRotation: moBackRotation,
  });
}

function renderMo() {
  const projection = currentMoProjection();
  const layout = moLayoutRepairPreview?.plan.layout ?? moLayout;
  if (moLayoutRepairPreview) moLayoutError = "Repair proposal preview only; Apply Repair to change the saved layout.";
  else if (!projection.candidates.length) moLayoutError = "No eligible selected VPL/VPP records.";
  else if (layout.fields.length) {
    const signature = currentMoLayoutSignature(layout, projection);
    const state = moLayoutBatchState?.signature === signature ? moLayoutBatchState : undefined;
    if (hasLegacyMoPartyPositions(layout)) moLayoutError = "Saved Sender/Receiver positions are legacy; run Repair Layout before output.";
    else if (!state || state.status === "pending" || state.status === "checking") moLayoutError = "Validating mapped fields across all selected records.";
    else if (state.status === "valid") moLayoutError = "";
    else moLayoutError = state.status === "error" ? "Full-batch layout validation failed; output remains blocked." : "Mapped layout fields require attention.";
  } else moLayoutError = "";
  const sample = projection.candidates.find((candidate) => candidate.sourceIndex === moLayoutSampleSourceIndex) ?? projection.candidates[0];
  if (sample && moLayoutSampleSourceIndex === undefined) moLayoutSampleSourceIndex = sample.sourceIndex;
  return renderMoPrintView(projection, moSenderCnicInput, moSheetIndex, moBackRotation, moPdfState, moSessionMappings, moPendingMappings, layout, moLayoutEditMode, moLayoutSampleSourceIndex, moSelectedLayoutFieldId, moLayoutStatus, moPrintSideMode, moLayoutError);
}

function currentMoProjection() {
  const selectedIndexes = new Set(currentOrders().map(({ index }) => index));
  return projectMoRecords(rows, { selectedSourceIndexes: selectedIndexes, requiredFields: [] });
}

function replaceMoLayout(layout: MoLayout, status = "Unsaved MO layout changes."): void {
  try {
    moLayout = validateMoLayout(layout);
    moLayoutStatus = status;
    moLayoutError = "";
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_INVALID";
    moLayoutStatus = "Layout change rejected; positions remain unchanged.";
  }
  render();
}

function persistMoLayout(): void {
  try {
    saveMoLayout(moLayout, window.localStorage);
    moLayoutStatus = "Layout saved locally (positions/binding IDs only; no record values).";
    moLayoutError = "";
  } catch {
    moLayoutError = "MO_LAYOUT_SAVE_FAILED: browser storage unavailable.";
    moLayoutStatus = "Layout remains in this tab only.";
  }
  render();
}

function correctLegacyMoPartyPositions(): void {
  try {
    if (!hasLegacyMoPartyPositions(moLayout)) return;
    const correctedLayout = correctMoPartyPositions(moLayout);
    // Persist first: a storage failure must leave the in-memory layout legacy-gated too.
    saveMoLayout(correctedLayout, window.localStorage);
    moLayout = correctedLayout;
    moLayoutStatus = "Legacy positions corrected and saved. Receiver fields now target the upper block; Sender fields, including the pinned session-only CNIC, target the lower block.";
    moLayoutError = "";
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_PARTY_CORRECTION_FAILED";
    moLayoutStatus = "Party-position correction was not saved; layout fields remain unchanged.";
  }
  render();
}

function reloadMoLayout(): void {
  try {
    moLayout = loadMoLayout(window.localStorage);
    moLayoutStatus = "Saved layout reloaded (definitions only).";
    moLayoutError = "";
    moSelectedLayoutFieldId = undefined;
  } catch {
    moLayoutError = "MO_LAYOUT_LOAD_FAILED";
  }
  render();
}

function resetMoLayoutSession(): void {
  try {
    moLayout = resetMoLayout(window.localStorage);
    moLayoutStatus = "Layout reset to the reusable blank MO-51 default.";
    moLayoutError = "";
    moSelectedLayoutFieldId = undefined;
    moPendingLayoutSource = undefined;
    moCleanPreview = false;
  } catch {
    moLayout = defaultMoLayout();
    moLayoutStatus = "Layout reset in this tab only; browser storage unavailable.";
    moLayoutError = "MO_LAYOUT_STORAGE_UNAVAILABLE";
  }
  render();
}

function saveMoLayoutFieldChange(fieldId: string, patch: Partial<Omit<MoLayoutField, "id">>): void {
  try {
    moLayout = updateLayoutFieldConfig(moLayout, fieldId, patch);
    moLayoutStatus = "Unsaved layout changes (record values are not stored).";
    moLayoutError = "";
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_INVALID";
  }
  render();
}

function applyLayoutProperty(fieldId: string, key: string, value: string | boolean): void {
  const field = moLayout.fields.find((item) => item.id === fieldId);
  if (!field) return;
  if (field.source === "senderCnic" && ["face", "xMm", "yMm", "widthMm", "heightMm"].includes(key)) {
    moLayoutError = "Sender CNIC position and field bounds follow the semantic Sender identity line.";
    moLayoutStatus = "Sender CNIC position is protected.";
    render();
    return;
  }
  const numeric = typeof value === "string" ? Number(value) : NaN;
  if (key === "source" && typeof value === "string") saveMoLayoutFieldChange(fieldId, { source: value as MoDataSource });
  else if (key === "xMm" && Number.isFinite(numeric)) saveMoLayoutFieldChange(fieldId, { xMm: numeric });
  else if (key === "yMm" && Number.isFinite(numeric)) saveMoLayoutFieldChange(fieldId, { yMm: numeric });
  else if (key === "widthMm" && Number.isFinite(numeric)) saveMoLayoutFieldChange(fieldId, { widthMm: numeric });
  else if (key === "heightMm" && Number.isFinite(numeric)) saveMoLayoutFieldChange(fieldId, { heightMm: numeric });
  else if (key === "fontSizePt" && Number.isFinite(numeric)) saveMoLayoutFieldChange(fieldId, { fontSizePt: numeric });
  else if (key === "bold" && typeof value === "boolean") saveMoLayoutFieldChange(fieldId, { bold: value });
  else if (key === "alignment" && (value === "left" || value === "center" || value === "right")) saveMoLayoutFieldChange(fieldId, { alignment: value as MoLayoutAlignment });
  else if (key === "wrap" && typeof value === "boolean") saveMoLayoutFieldChange(fieldId, { wrap: value });
}

function sampleSheetIndex(projection = currentMoProjection(), sourceIndex = moLayoutSampleSourceIndex): number {
  const ordinal = projection.candidates.findIndex((candidate) => candidate.sourceIndex === sourceIndex);
  if (ordinal < 0) return 0;
  const split = Math.ceil(projection.candidates.length / 2);
  return ordinal < split ? ordinal : ordinal - split;
}

function updateMoEditorViewport(): void {
  const surface = document.querySelector<HTMLElement>(".mo-clean-preview:not([hidden]) .mo-clean-preview-stage-wrap")
    ?? document.querySelector<HTMLElement>(".mo-layout-editor:not([hidden]) .mo-layout-surfaces");
  const availableWidth = surface?.clientWidth || Math.max(320, window.innerWidth - 32);
  const fit = Math.min(1, availableWidth / 1123);
  const scale = Math.max(0.25, Math.min(2, fit * moEditorZoom));
  for (const stage of Array.from(document.querySelectorAll<HTMLElement>(".mo-editor-stage,.mo-final-preview-stage"))) {
    stage.style.width = `${1123 * scale}px`;
    stage.style.height = `${794 * scale}px`;
    stage.style.setProperty("--mo-editor-scale", String(scale));
    for (const child of Array.from(stage.querySelectorAll<HTMLElement>(":scope > iframe,:scope > .mo-editor-overlay"))) {
      child.style.width = "1123px";
      child.style.height = "794px";
      child.style.transform = `scale(${scale})`;
      child.style.transformOrigin = "top left";
    }
    for (const handle of Array.from(stage.querySelectorAll<HTMLElement>(".mo-editor-field [data-mo-resize-handle]"))) {
      const screenHandle = 16 / scale;
      handle.style.width = `${screenHandle}px`;
      handle.style.height = `${screenHandle}px`;
      handle.style.right = `${-screenHandle / 2}px`;
      handle.style.bottom = `${-screenHandle / 2}px`;
    }
    for (const field of Array.from(stage.querySelectorAll<HTMLElement>(".mo-editor-field"))) {
      field.style.borderWidth = `${(field.classList.contains("selected") ? 2 : 1) / scale}px`;
      if (field.classList.contains("selected")) {
        field.style.outlineWidth = `${2 / scale}px`;
        field.style.outlineOffset = `${1 / scale}px`;
      }
    }
    for (const label of Array.from(stage.querySelectorAll<HTMLElement>(".mo-editor-field .mo-editor-binding"))) {
      label.style.fontSize = `${10 / scale}px`;
      label.style.top = `${-15 / scale}px`;
      label.style.maxWidth = `${240 / scale}px`;
    }
  }
  const zoomOutput = document.querySelector<HTMLOutputElement>("#moZoomLevel");
  if (zoomOutput) zoomOutput.value = `${Math.round(scale * 100)}%`;
}

function observeMoEditorViewport(): void {
  moEditorResizeObserver?.disconnect();
  moEditorResizeObserver = undefined;
  const surface = document.querySelector<HTMLElement>(".mo-clean-preview:not([hidden]) .mo-clean-preview-stage-wrap")
    ?? document.querySelector<HTMLElement>(".mo-layout-editor:not([hidden]) .mo-layout-surfaces");
  if (surface && "ResizeObserver" in window) {
    moEditorResizeObserver = new ResizeObserver(updateMoEditorViewport);
    moEditorResizeObserver.observe(surface);
  }
  if (!moEditorWindowResizeBound) {
    window.addEventListener("resize", updateMoEditorViewport, { passive: true });
    moEditorWindowResizeBound = true;
  }
  updateMoEditorViewport();
}

function bindMoEditorUi(): void {
  const editor = document.querySelector<HTMLElement>(".mo-layout-editor");
  if (!editor) {
    moEditorResizeObserver?.disconnect();
    moEditorResizeObserver = undefined;
    return;
  }
  editor.id = "moLayoutEditor";
  for (const box of Array.from(editor.querySelectorAll<HTMLElement>('.mo-editor-field[data-mo-layout-source="senderCnic"]'))) {
    box.querySelector("[data-mo-resize-handle]")?.remove();
    box.setAttribute("aria-label", `Optional Sender CNIC, semantic Sender anchor, ${box.dataset.moLayoutSlot === "0" ? "left" : "right"} form`);
    const value = box.querySelector<HTMLElement>(".mo-editor-value");
    if (value?.textContent === "NO SAMPLE VALUE") value.textContent = "";
    box.classList.remove("missing-value");
    box.classList.add("has-value");
  }
  const selectedProperties = editor.querySelector<HTMLElement>(".mo-layout-properties[data-mo-selected-layout-field]");
  const selectedLayoutField = selectedProperties?.dataset.moSelectedLayoutField
    ? moLayout.fields.find((field) => field.id === selectedProperties.dataset.moSelectedLayoutField)
    : undefined;
  if (selectedProperties && selectedLayoutField?.source === "senderCnic") {
    for (const input of Array.from(selectedProperties.querySelectorAll<HTMLInputElement | HTMLSelectElement>("#moLayoutSource,#moLayoutX,#moLayoutY,#moLayoutWidth,#moLayoutHeight,#moLayoutWrap"))) {
      const label = input.closest("label");
      if (label) label.hidden = true;
      input.disabled = true;
    }
    if (!selectedProperties.querySelector("#moSenderCnicAnchorHelp")) {
      const help = document.createElement("p");
      help.id = "moSenderCnicAnchorHelp";
      help.setAttribute("role", "note");
      help.textContent = "Position and bounds follow the semantic Sender identity line and move with Sender during swaps or legacy-layout correction. Adjust font and alignment only.";
      selectedProperties.insertBefore(help, selectedProperties.querySelector("#moLayoutFontSize")?.closest("label") ?? null);
    }
  }
  const frontFrame = editor.querySelector<HTMLIFrameElement>("#moLayoutFrontPreview");
  if (frontFrame) {
    const syncSenderCnicAnchors = () => window.requestAnimationFrame(() => {
      const doc = frontFrame.contentDocument;
      const overlay = editor.querySelector<HTMLElement>('[data-mo-editor-overlay="front"]');
      if (!doc || !overlay) return;
      const frameRect = frontFrame.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      if (!frameRect.width || !frameRect.height || !frontFrame.clientWidth || !frontFrame.clientHeight) return;
      for (const slot of ["left", "right"] as const) {
        const box = overlay.querySelector<HTMLElement>(`.mo-editor-field[data-mo-layout-source="senderCnic"][data-mo-layout-slot="${slot === "left" ? 0 : 1}"]`);
        const line = doc.querySelector<HTMLElement>(`.mo-half[data-mo-slot="${slot}"] [data-mo-party-block="sender"] [data-mo-sender-cnic-anchor]`);
        if (!box || !line) continue;
        const anchor = line.getBoundingClientRect();
        const savedWidthMm = Number(box.dataset.moLayoutWidthMm) || 42;
        const savedHeightMm = Number(box.dataset.moLayoutHeightMm) || 5;
        const width = Math.min(savedWidthMm * (96 / 25.4), Math.max(0, anchor.width - 4));
        const height = Math.min(savedHeightMm * (96 / 25.4), anchor.height);
        box.style.left = `${frameRect.left - overlayRect.left + anchor.left + 2}px`;
        box.style.top = `${frameRect.top - overlayRect.top + anchor.bottom - height}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        box.dataset.moSemanticAnchorReady = "true";
        box.title = "Optional Sender CNIC · anchored to the Sender identity line.";
      }
    });
    frontFrame.addEventListener("load", syncSenderCnicAnchors);
    if (frontFrame.contentDocument?.readyState === "complete") syncSenderCnicAnchors();
  }
  if (hasLegacyMoPartyPositions(moLayout) && !editor.querySelector("#moCorrectLegacyPartyPositions")) {
    const warning = document.createElement("div");
    warning.className = "mo-party-position-warning";
    warning.setAttribute("role", "alert");
    warning.innerHTML = "<strong>Saved legacy party positions detected.</strong> Correct only Sender/Receiver fields still placed in their old front blocks; bindings, sizes, alignment and other customized fields are preserved. PDF and print stay disabled until corrected.";
    const correction = document.createElement("button");
    correction.type = "button";
    correction.id = "moCorrectLegacyPartyPositions";
    correction.textContent = "Correct Sender/Receiver Positions";
    correction.addEventListener("click", correctLegacyMoPartyPositions);
    warning.append(correction);
    editor.querySelector(".mo-layout-workbench")?.before(warning);
  }
  const instructions = editor.querySelector<HTMLElement>("header>div>p");
  if (instructions) instructions.textContent = "Drag a source onto either A5 half, or select it and click a form position. Move/resize ordinary fields; Sender CNIC follows the semantic Sender identity line. Edit mode intentionally repeats its selected sample on both halves; Preview Final MO and output use the paired records. Coordinates remain millimetres regardless of screen zoom.";

  editor.querySelectorAll<HTMLButtonElement>(".mo-source-chip[data-mo-layout-source]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(moPendingLayoutSource === chip.dataset.moLayoutSource));
    chip.addEventListener("click", (event) => {
      if (performance.now() - moLastSourceDragAt < 500) return;
      event.preventDefault();
      event.stopPropagation();
      const source = chip.dataset.moLayoutSource as MoDataSource | undefined;
      if (!source || !moLayoutEditMode) return;
      moPendingLayoutSource = moPendingLayoutSource === source ? undefined : source;
      moLayoutStatus = moPendingLayoutSource ? `Selected ${MO_LAYOUT_SOURCES.find((item) => item.id === source)?.label ?? source}; click a front or back form position.` : "Field placement cancelled.";
      render();
    });
  });
  editor.querySelectorAll<HTMLElement>("[data-mo-editor-overlay]").forEach((overlay) => {
    if (moPendingLayoutSource) overlay.dataset.moPendingSource = moPendingLayoutSource;
    else delete overlay.dataset.moPendingSource;
    overlay.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!moLayoutEditMode || !moPendingLayoutSource || target.closest(".mo-editor-field")) return;
      const rect = overlay.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const xAcross = Math.max(0, Math.min(297, (event.clientX - rect.left) * 297 / rect.width));
      const yMm = Math.max(0, Math.min(210, (event.clientY - rect.top) * 210 / rect.height));
      addMoLayoutSource(moPendingLayoutSource, overlay.dataset.moEditorOverlay as MoLayoutFace, xAcross, yMm, xAcross >= 148.5 ? 1 : 0);
    });
  });

  const actions = editor.querySelector<HTMLElement>(".mo-layout-actions");
  if (actions && !actions.querySelector("#moRepairLayout")) {
    const repair = document.createElement("button");
    repair.type = "button";
    repair.id = "moRepairLayout";
    repair.textContent = "Repair Layout";
    repair.disabled = !moLayout.fields.length || Boolean(moPdfAbort);
    repair.title = moLayout.fields.length ? "Preview safe MO-only positions and validate every selected record before applying." : "Add explicit mapped fields before repairing a layout.";
    repair.addEventListener("click", startMoLayoutRepairPreview);
    const reset = actions.querySelector("#moLayoutReset");
    (reset?.parentElement ?? actions).insertBefore(repair, reset?.nextSibling ?? null);
  }
  if (actions && moLayout.fields.length && !actions.querySelector("#moPreviewFinal")) {
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.id = "moPreviewFinal";
    previewButton.className = "mo-preview-final-button";
    previewButton.textContent = "Preview Final MO";
    previewButton.addEventListener("click", () => {
      moPendingLayoutSource = undefined;
      moCleanPreview = true;
      render();
    });
    const reset = actions.querySelector("#moLayoutReset");
    (reset?.parentElement ?? actions).insertBefore(previewButton, reset?.nextSibling ?? null);
  }
  if (actions && !actions.querySelector("#moEditorZoomControls")) {
    const zoom = document.createElement("div");
    zoom.id = "moEditorZoomControls";
    zoom.className = "mo-editor-zoom-controls";
    zoom.setAttribute("aria-label", "MO editor zoom");
    zoom.innerHTML = `<button type="button" id="moFitToWidth">Fit to Width</button><button type="button" id="moZoomOut" aria-label="Zoom out">−</button><output id="moZoomLevel">100%</output><button type="button" id="moZoomIn" aria-label="Zoom in">+</button><button type="button" id="moZoomReset">Reset Zoom</button>`;
    actions.append(zoom);
    zoom.querySelector("#moFitToWidth")?.addEventListener("click", () => { moEditorZoom = 1; updateMoEditorViewport(); });
    zoom.querySelector("#moZoomReset")?.addEventListener("click", () => { moEditorZoom = 1; updateMoEditorViewport(); });
    zoom.querySelector("#moZoomIn")?.addEventListener("click", () => { moEditorZoom = Math.min(2, moEditorZoom + 0.1); updateMoEditorViewport(); });
    zoom.querySelector("#moZoomOut")?.addEventListener("click", () => { moEditorZoom = Math.max(0.4, moEditorZoom - 0.1); updateMoEditorViewport(); });
  }

  const fontInput = editor.querySelector<HTMLInputElement>("#moLayoutFontSize");
  const properties = editor.querySelector<HTMLElement>(".mo-layout-properties[data-mo-selected-layout-field]");
  if (fontInput && properties && !properties.querySelector("#moLayoutFontIncrease")) {
    const selectedId = properties.dataset.moSelectedLayoutField;
    const selected = moLayout.fields.find((field) => field.id === selectedId);
    const label = fontInput.closest("label");
    if (selected && label) {
      const controls = document.createElement("div");
      controls.className = "mo-font-adjust";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.id = "moLayoutFontDecrease";
      decrease.setAttribute("aria-label", "Decrease font size");
      decrease.textContent = "−";
      const increase = document.createElement("button");
      increase.type = "button";
      increase.id = "moLayoutFontIncrease";
      increase.setAttribute("aria-label", "Increase font size");
      increase.textContent = "+";
      controls.append(decrease, fontInput, increase);
      label.append(controls);
      const bold = document.createElement("button");
      bold.type = "button";
      bold.id = "moLayoutBold";
      bold.className = "mo-bold-toggle";
      bold.setAttribute("aria-pressed", String(selected.bold));
      bold.textContent = selected.bold ? "Bold: On" : "Bold: Off";
      label.insertAdjacentElement("afterend", bold);
      decrease.addEventListener("click", () => applyLayoutProperty(selected.id, "fontSizePt", String(Math.max(4, selected.fontSizePt - 0.5))));
      increase.addEventListener("click", () => applyLayoutProperty(selected.id, "fontSizePt", String(Math.min(48, selected.fontSizePt + 0.5))));
      bold.addEventListener("click", () => applyLayoutProperty(selected.id, "bold", !selected.bold));
    }
  }
  if (moCleanPreview && moLayout.fields.length) renderMoCleanPreview(editor);
  else document.querySelector(".mo-clean-preview")?.remove();
  observeMoEditorViewport();
}

function cancelMoLayoutRepairPreview(): void {
  moLayoutRepairAbort?.abort();
  moLayoutRepairAbort = undefined;
  moLayoutRepairPreview = undefined;
  moCleanPreview = false;
  moLayoutEditMode = true;
  moLayoutStatus = "Repair preview cancelled; the saved layout is unchanged.";
  render();
}

function startMoLayoutRepairPreview(): void {
  if (!moLayout.fields.length || moPdfAbort) return;
  let plan: MoLayoutRepairPlan;
  try {
    plan = proposeMoLayoutRepair(moLayout);
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_REPAIR_PROPOSAL_FAILED";
    moLayoutStatus = "No repair proposal was applied; the saved layout remains unchanged.";
    render();
    return;
  }
  moLayoutRepairAbort?.abort();
  const preview: MoLayoutRepairPreview = Object.freeze({ plan, validation: "pending" });
  moLayoutRepairPreview = preview;
  moPendingLayoutSource = undefined;
  moSelectedLayoutFieldId = undefined;
  moLayoutEditMode = false;
  moCleanPreview = true;
  moCleanPreviewFace = "front";
  moLayoutStatus = `Previewing ${plan.changes.length} proposed safe layout changes; nothing is saved until Apply Repair.`;
  moLayoutError = "Repair proposal preview only; saved layout and output remain unchanged.";
  render();

  const controller = new AbortController();
  moLayoutRepairAbort = controller;
  const projection = currentMoProjection();
  const cnic = formatSenderCnic(moSenderCnicInput);
  const senderCnic = cnic.status === "valid" ? cnic.formatted : "";
  const faces = moPrintSideMode === "front-only" ? ["front"] as const : moPrintSideMode === "back-only" ? ["back"] as const : ["front", "back"] as const;
  void validateMoBatchLayout(projection.candidates, senderCnic, moBackRotation, moSessionMappings, plan.layout, faces, controller.signal, (checked, total) => {
    const status = document.querySelector<HTMLElement>("#moRepairBatchStatus");
    if (status && moLayoutRepairPreview?.plan === plan) status.textContent = `Validating all ${projection.candidates.length} selected records (${checked}/${total} front/back face documents)…`;
  }).then((report) => {
    if (controller.signal.aborted || moLayoutRepairPreview?.plan !== plan) return;
    moLayoutRepairPreview = Object.freeze({ plan, validation: report.diagnostics.length ? "blocked" : "valid", report });
    moLayoutStatus = `Proposal checked against all ${report.checkedRecords} selected records (${report.sheetCount} sheets; ${report.checkedFaceDocuments} rendered face documents; ${Math.round(report.validationDurationMs)} ms; static artwork ${report.staticArtworkGeometryMeasurements} measured/${report.staticArtworkGeometryCacheHits} reused).`;
    render();
  }).catch((error) => {
    if (controller.signal.aborted || moLayoutRepairPreview?.plan !== plan) return;
    const message = error instanceof Error ? error.message : "MO_LAYOUT_BATCH_VALIDATION_FAILED";
    moLayoutRepairPreview = Object.freeze({ plan, validation: "error", error: message });
    moLayoutStatus = "The proposed layout could not be fully validated; no changes were saved.";
    render();
  });
}

function applyMoLayoutRepair(): void {
  const preview = moLayoutRepairPreview;
  if (!preview || !preview.plan.changes.length || preview.validation === "pending" || preview.validation === "checking" || preview.validation === "error") return;
  try {
    saveMoLayout(preview.plan.layout, window.localStorage);
    moLayout = preview.plan.layout;
    moLayoutRepairAbort?.abort();
    moLayoutRepairAbort = undefined;
    moLayoutRepairPreview = undefined;
    moLayoutBatchAbort?.abort();
    moLayoutBatchAbort = undefined;
    if (moLayoutBatchTimer !== undefined) window.clearTimeout(moLayoutBatchTimer);
    moLayoutBatchTimer = undefined;
    moLayoutBatchState = undefined;
    moLayoutBatchGeneration += 1;
    moCleanPreview = false;
    moLayoutEditMode = true;
    moLayoutStatus = `Applied ${preview.plan.changes.length} approved MO layout changes; validating the full selected batch.`;
    moLayoutError = "Validating mapped fields across all selected records.";
    render();
  } catch {
    moLayoutStatus = "Repair could not be saved; the previous saved and in-memory layout remains unchanged.";
    moLayoutError = "MO_LAYOUT_REPAIR_SAVE_FAILED";
    render();
  }
}

function renderMoCleanPreview(editor: HTMLElement): void {
  document.querySelector(".mo-clean-preview")?.remove();
  const parent = editor.parentElement;
  if (!parent) return;
  const repairPreview = moLayoutRepairPreview;
  const sourceFrames = {
    front: editor.querySelector<HTMLIFrameElement>("#moLayoutFrontPreview"),
    back: editor.querySelector<HTMLIFrameElement>("#moLayoutBackPreview"),
  };
  const preview = document.createElement("section");
  preview.className = "mo-clean-preview";
  preview.id = "moFinalMoPreview";
  const header = document.createElement("header");
  const heading = document.createElement("div");
  heading.innerHTML = repairPreview
    ? "<h2>Repair Layout · Proposed Preview</h2><p>This is a temporary proposal. The saved layout and MO PDF/print output stay unchanged until Apply Repair is explicitly selected.</p>"
    : "<h2>Preview Final MO</h2><p>Clean A4 landscape preview of the same saved layout, selected records, original artwork and millimetre coordinates used by PDF/print.</p>";
  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.id = repairPreview ? "moCancelRepairPreview" : "moReturnToLayout";
  returnButton.textContent = repairPreview ? "Cancel Repair Preview" : "Return to Layout Editor";
  returnButton.addEventListener("click", () => { if (repairPreview) cancelMoLayoutRepairPreview(); else { moCleanPreview = false; render(); } });
  header.append(heading, returnButton);

  let repairSummary: HTMLElement | undefined;
  if (repairPreview) {
    repairSummary = document.createElement("section");
    repairSummary.className = "mo-repair-summary";
    repairSummary.id = "moRepairSummary";
    const unresolvedCount = repairPreview.plan.unresolved.length;
    const validation = repairPreview.validation === "pending" || repairPreview.validation === "checking"
      ? `Checking all ${currentMoProjection().candidates.length} selected records across front/back HTML sections…`
      : repairPreview.validation === "error"
        ? `Full-batch validation failed; output remains blocked. ${repairPreview.error ?? ""}`
        : repairPreview.report?.diagnostics.length
          ? `${repairPreview.report.diagnostics.length} blocking diagnostics remain after the proposed repairs; you can apply safe changes, then adjust listed fields directly. ${unresolvedCount ? `${unresolvedCount} ambiguous/Intimation placements were preserved.` : ""}`
          : `PASS · ${repairPreview.report?.checkedRecords ?? 0} selected records checked across ${repairPreview.report?.sheetCount ?? 0} sheets and ${repairPreview.report?.checkedFaceDocuments ?? 0} rendered front/back face documents (${Math.round(repairPreview.report?.validationDurationMs ?? 0)} ms; static artwork ${repairPreview.report?.staticArtworkGeometryMeasurements ?? 0} measured/${repairPreview.report?.staticArtworkGeometryCacheHits ?? 0} reused).${unresolvedCount ? ` ${unresolvedCount} ambiguous/Intimation fields were preserved for direct adjustment.` : ""}`;
    const changeItems = repairPreview.plan.changes.map((change) => {
      const label = MO_LAYOUT_SOURCES.find((source) => source.id === change.source)?.label ?? change.source;
      const bold = repairPreview.plan.layout.fields.find((field) => field.id === change.fieldId)?.bold ? "Bold retained" : "Regular retained";
      const before = `x${change.before.xMm.toFixed(1)} y${change.before.yMm.toFixed(1)} · ${change.before.widthMm.toFixed(1)}×${change.before.heightMm.toFixed(1)} mm · ${change.before.fontSizePt.toFixed(1)} pt · ${change.before.wrap ? "wrap" : "no wrap"}`;
      const after = `x${change.after.xMm.toFixed(1)} y${change.after.yMm.toFixed(1)} · ${change.after.widthMm.toFixed(1)}×${change.after.heightMm.toFixed(1)} mm · ${change.after.fontSizePt.toFixed(1)} pt · ${change.after.wrap ? "wrap" : "no wrap"}`;
      return `<li data-mo-repair-field="${esc(change.fieldId)}"><b>${esc(label)}</b>: ${esc(before)} → ${esc(after)} · ${esc(bold)}</li>`;
    }).join("");
    const unresolvedItems = repairPreview.plan.unresolved.map((issue) => {
      const label = MO_LAYOUT_SOURCES.find((source) => source.id === issue.source)?.label ?? issue.source;
      return `<li data-mo-repair-unresolved="${esc(issue.fieldId)}"><b>${esc(label)}</b>: ${esc(issue.message)} <button type="button" data-mo-repair-select="${esc(issue.fieldId)}">Select ${esc(label)} in editor</button></li>`;
    }).join("");
    const blockingItems = (repairPreview.report?.diagnostics ?? []).map((issue) => {
      const label = issue.source ? MO_LAYOUT_SOURCES.find((source) => source.id === issue.source)?.label ?? issue.source : "Mapped field";
      const select = issue.fieldId ? `<button type="button" data-mo-repair-select="${esc(issue.fieldId)}">Select ${esc(label)} in editor</button>` : "";
      return `<li>${esc(issue.message)} ${select}</li>`;
    }).join("");
    repairSummary.innerHTML = `<p id="moRepairBatchStatus" role="status">${esc(validation)}</p><h3>Proposed mapped-field changes (${repairPreview.plan.changes.length})</h3>${changeItems ? `<ul>${changeItems}</ul>` : "<p>No safe automatic changes proposed.</p>"}${blockingItems ? `<h3>Blocking issues (${repairPreview.report?.diagnostics.length ?? 0})</h3><ul>${blockingItems}</ul>` : ""}${unresolvedItems ? `<h3>Preserved for direct adjustment (${repairPreview.plan.unresolved.length})</h3><ul>${unresolvedItems}</ul>` : ""}`;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "mo-clean-preview-toolbar";
  const faceLabel = document.createElement("label");
  faceLabel.textContent = "Face";
  const faceSelect = document.createElement("select");
  faceSelect.id = "moCleanPreviewFace";
  faceSelect.innerHTML = `<option value="front" ${moCleanPreviewFace === "front" ? "selected" : ""}>Front · Section 1</option><option value="back" ${moCleanPreviewFace === "back" ? "selected" : ""}>Back · Section 2</option>`;
  faceLabel.append(faceSelect);
  faceSelect.addEventListener("change", () => {
    moCleanPreviewFace = faceSelect.value === "back" ? "back" : "front";
    const frame = preview.querySelector<HTMLIFrameElement>("#moFinalPreview");
    if (frame) {
      frame.srcdoc = sourceFrames[moCleanPreviewFace]?.srcdoc ?? "";
      frame.title = `MO-51 final ${moCleanPreviewFace} sheet preview`;
    }
  });
  toolbar.append(faceLabel);
  const sampleLabel = editor.querySelector<HTMLLabelElement>("#moLayoutSampleRecord")?.closest("label");
  const faceModeLabel = editor.querySelector<HTMLSelectElement>("#moPrintSideMode")?.closest("label");
  const rotationLabel = editor.querySelector<HTMLSelectElement>("#moLayoutBackRotation")?.closest("label");
  const zoomControls = editor.querySelector<HTMLElement>("#moEditorZoomControls");
  const cnicControls = document.querySelector<HTMLElement>(".mo-controls");
  const sheetNav = document.querySelector<HTMLElement>(".mo-sheet-nav");
  if (sampleLabel) toolbar.append(sampleLabel);
  if (!repairPreview && faceModeLabel) toolbar.append(faceModeLabel);
  if (!repairPreview && rotationLabel) toolbar.append(rotationLabel);
  if (zoomControls) toolbar.append(zoomControls);
  if (!repairPreview && cnicControls) toolbar.append(cnicControls);
  if (sheetNav) toolbar.append(sheetNav);
  if (repairPreview) {
    const cnicNote = document.createElement("p");
    cnicNote.className = "mo-repair-cnic-note";
    cnicNote.textContent = "Sender CNIC is not part of this layout repair preview; enter or clear the optional session-only value after applying.";
    toolbar.append(cnicNote);
  }

  const stageWrap = document.createElement("div");
  stageWrap.className = "mo-clean-preview-stage-wrap";
  const stage = document.createElement("div");
  stage.className = "mo-final-preview-stage";
  stage.id = "moFinalPreviewStage";
  const frame = document.createElement("iframe");
  frame.id = "moFinalPreview";
  frame.title = `MO-51 final ${moCleanPreviewFace} sheet preview`;
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.srcdoc = sourceFrames[moCleanPreviewFace]?.srcdoc ?? "";
  stage.append(frame);
  stageWrap.append(stage);

  const cleanWarning = document.createElement("p");
  cleanWarning.className = "mo-clean-preview-warning";
  const warningText = editor.querySelector<HTMLElement>(".mo-mapping-fit-error")?.textContent?.trim() ?? "";
  cleanWarning.textContent = warningText;
  cleanWarning.hidden = repairPreview !== undefined || !warningText;

  const actions = document.createElement("div");
  actions.className = "mo-clean-preview-actions";
  const layoutActions = editor.querySelector<HTMLElement>(".mo-layout-actions");
  const visibleButtons = ["#moLayoutSave", "#moLayoutReload", "#moRepairLayout", "#downloadMoPdf", "#downloadMoLayoutPdf", "#printMoBatch", "#cancelMoPdf"];
  if (repairPreview) {
    const apply = document.createElement("button");
    apply.type = "button";
    apply.id = "moApplyLayoutRepair";
    const blockedCount = repairPreview.report?.diagnostics.length ?? 0;
    const remainingCount = blockedCount + repairPreview.plan.unresolved.length;
    apply.textContent = remainingCount ? `Apply safe changes (${remainingCount} issues remain)` : `Apply Repair (${repairPreview.plan.changes.length} changes)`;
    apply.disabled = repairPreview.validation === "pending" || repairPreview.validation === "checking" || repairPreview.validation === "error" || repairPreview.plan.changes.length === 0;
    apply.addEventListener("click", applyMoLayoutRepair);
    actions.append(apply);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.id = "moCancelLayoutRepair";
    cancel.textContent = "Cancel without changing saved layout";
    cancel.addEventListener("click", cancelMoLayoutRepairPreview);
    actions.append(cancel);
  } else {
    for (const selector of visibleButtons) {
      const button = editor.querySelector<HTMLButtonElement>(selector) ?? document.querySelector<HTMLButtonElement>(selector);
      if (button) actions.append(button);
    }
  }
  const status = document.querySelector<HTMLElement>("#moPdfStatus");
  if (status) actions.append(status);
  void layoutActions;

  preview.append(header, ...(repairSummary ? [repairSummary] : []), toolbar, cleanWarning, stageWrap, actions);
  preview.querySelectorAll<HTMLButtonElement>("[data-mo-repair-select]").forEach((button) => button.addEventListener("click", () => {
    const fieldId = button.dataset.moRepairSelect;
    const field = moLayoutRepairPreview?.plan.layout.fields.find((candidate) => candidate.id === fieldId);
    moLayoutRepairPreview = undefined;
    moCleanPreview = false;
    if (field) {
      moSelectedLayoutFieldId = field.id;
      moLayoutEditMode = true;
      moLayoutStatus = `Selected ${MO_LAYOUT_SOURCES.find((source) => source.id === field.source)?.label ?? field.source} for direct adjustment. The proposed repair was not applied.`;
    }
    render();
  }));
  editor.insertAdjacentElement("afterend", preview);
  const hiddenSelectors = [".mo-heading", ".mo-warning", ".mo-summary", ".mo-required-fields", ".mo-manual-overrides", ".mo-mapping-review", ".mo-exclusions", ".mo-sheet-nav", ".mo-controls", ".mo-export-controls", "#moMappingFitError"];
  for (const selector of hiddenSelectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && !preview.contains(element)) element.hidden = true;
  }
  editor.hidden = true;
}

function updateMoLayoutField(fieldId: string, patch: Partial<Omit<MoLayoutField, "id">>): void {
  try {
    moLayout = updateLayoutFieldConfig(moLayout, fieldId, patch);
    moSelectedLayoutFieldId = fieldId;
    moLayoutStatus = "Unsaved layout changes (field values are not stored).";
    moLayoutError = "";
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_INVALID";
  }
  render();
}

function addMoLayoutSource(source: MoDataSource, face: MoLayoutFace, sheetXmm: number, yMm: number, slot: 0 | 1): void {
  let xMm = Math.max(0, Math.min(148.5, sheetXmm - slot * 148.5));
  let topMm = Math.max(0, Math.min(210, yMm));
  if (source === "senderCnic") {
    const anchor = findSenderCnicLayoutPosition(face, slot === 0 ? "left" : "right");
    if (!anchor) {
      moLayoutError = "Sender CNIC is pinned to its section-1 sender identity line; drop it on the front face only.";
      moLayoutStatus = "Field was not added.";
      render();
      return;
    }
    xMm = anchor.xMm;
    topMm = anchor.yMm;
    face = "front";
  }
  const field = newMoLayoutField(crypto.randomUUID(), source, face, xMm, topMm);
  xMm = field.xMm;
  topMm = field.yMm;
  const existing = moLayout.fields.find((current) => current.source === source && current.face === face && Math.abs(current.xMm - xMm) < 2 && Math.abs(current.yMm - topMm) < 2);
  if (existing) {
    moSelectedLayoutFieldId = existing.id;
    moPendingLayoutSource = undefined;
    moLayoutStatus = "That source is already placed here; the existing field is selected.";
    moLayoutError = "";
    render();
    return;
  }
  const bounded = validateMoLayout({ ...moLayout, fields: [...moLayout.fields, field] });
  moLayout = bounded;
  moSelectedLayoutFieldId = field.id;
  moLayoutStatus = "Unsaved layout changes (positions/source IDs only).";
  moLayoutError = "";
  moPendingLayoutSource = undefined;
  render();
}

function handleMoLayoutDrop(overlay: HTMLElement, event: DragEvent): void {
  event.preventDefault();
  if (!moLayoutEditMode || !event.dataTransfer) return;
  const rect = overlay.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const xAcross = Math.max(0, Math.min(297, (event.clientX - rect.left) * 297 / rect.width));
  const yMm = Math.max(0, Math.min(210, (event.clientY - rect.top) * 210 / rect.height));
  const slot = (xAcross >= 148.5 ? 1 : 0) as 0 | 1;
  const existingId = event.dataTransfer.getData("application/x-mo-layout-field");
  const source = event.dataTransfer.getData("application/x-mo-layout-source") as MoDataSource;
  const face = overlay.dataset.moEditorOverlay as MoLayoutFace;
  if (existingId) {
    const current = moLayout.fields.find((field) => field.id === existingId);
    if (!current) return;
    if (current.source === "senderCnic") {
      const anchor = findSenderCnicLayoutPosition(face, slot === 0 ? "left" : "right");
      if (!anchor) {
        moLayoutError = "Sender CNIC is pinned to the section-1 sender identity line; it cannot move to a receiver/back field.";
        render();
        return;
      }
      moSelectedLayoutFieldId = existingId;
      moLayoutStatus = "Sender CNIC remains anchored to the semantic Sender identity line.";
      moLayoutError = "";
      render();
      return;
    }
    const xMm = Math.max(0, Math.min(148.5 - current.widthMm, xAcross - slot * 148.5));
    const newY = Math.max(0, Math.min(210 - current.heightMm, yMm));
    updateMoLayoutField(existingId, { face, xMm, yMm: newY });
    return;
  }
  if (!MO_LAYOUT_SOURCES.some((item) => item.id === source)) return;
  addMoLayoutSource(source, face, xAcross, yMm, slot);
}

function updateMoLayoutPointer(event: PointerEvent): void {
  const pointer = moLayoutPointer;
  if (!pointer) return;
  if (pointer.field.source === "senderCnic") return;
  const overlay = document.querySelector<HTMLElement>(`[data-mo-editor-overlay="${pointer.face}"]`);
  if (!overlay) return;
  const rect = overlay.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const deltaX = (event.clientX - pointer.startX) * 297 / rect.width;
  const deltaY = (event.clientY - pointer.startY) * 210 / rect.height;
  let patch: Partial<Omit<MoLayoutField, "id">>;
  if (pointer.mode === "move") {
    const absoluteX = (event.clientX - rect.left) * 297 / rect.width;
    const slot = absoluteX >= 148.5 ? 1 : 0;
    const absoluteY = (event.clientY - rect.top) * 210 / rect.height;
    patch = {
      xMm: Math.max(0, Math.min(148.5 - pointer.field.widthMm, absoluteX - slot * 148.5 - pointer.grabXmm)),
      yMm: Math.max(0, Math.min(210 - pointer.field.heightMm, absoluteY - pointer.grabYmm)),
    };
  } else {
    patch = {
      widthMm: Math.max(4, Math.min(148.5 - pointer.field.xMm, pointer.field.widthMm + deltaX)),
      heightMm: Math.max(3, Math.min(210 - pointer.field.yMm, pointer.field.heightMm + deltaY)),
    };
  }
  try {
    moLayout = updateLayoutFieldConfig(moLayout, pointer.id, patch);
    moLayoutStatus = "Unsaved layout changes (positions/bindings only).";
    moLayoutError = "";
  } catch (error) {
    moLayoutError = error instanceof Error ? error.message : "MO_LAYOUT_INVALID";
    return;
  }
  const updated = moLayout.fields.find((field) => field.id === pointer.id);
  if (!updated) return;
  const pxPerMm = 96 / 25.4;
  for (const box of Array.from(document.querySelectorAll<HTMLElement>(`.mo-editor-field[data-mo-layout-id="${pointer.id}"]`))) {
    const slot = Number(box.dataset.moLayoutSlot) || 0;
    box.style.left = `${(slot * 148.5 + updated.xMm) * pxPerMm}px`;
    box.style.top = `${updated.yMm * pxPerMm}px`;
    box.style.width = `${updated.widthMm * pxPerMm}px`;
    box.style.height = `${updated.heightMm * pxPerMm}px`;
  }
}

function findSenderCnicLayoutPosition(face: "front" | "back", slot: "left" | "right"): Readonly<{ xMm: number; yMm: number }> | undefined {
  if (face !== "front") return undefined;
  const doc = document.querySelector<HTMLIFrameElement>("#moLayoutFrontPreview")?.contentDocument;
  const half = doc?.querySelector<HTMLElement>(`.mo-half[data-mo-slot="${slot}"]`);
  const line = half?.querySelector<HTMLElement>('[data-mo-party-block="sender"] [data-mo-sender-cnic-anchor]');
  if (!half || !line) return undefined;
  const halfRect = half.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  const mmPerPx = 148.5 / halfRect.width;
  return Object.freeze({ xMm: Math.max(0, (lineRect.left - halfRect.left + 2) * mmPerPx), yMm: Math.max(0, (lineRect.top - halfRect.top) * (210 / halfRect.height)) });
}

function updatePendingMoMapping(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("[data-mo-map-index][data-mo-map-key]")) return;
  const sourceIndex = Number(input.dataset.moMapIndex);
  const key = input.dataset.moMapKey as MoSessionMappingKey;
  if (!Number.isInteger(sourceIndex) || !key) return;
  const current = moPendingMappings.get(sourceIndex) ?? moSessionMappings.get(sourceIndex) ?? emptyMoSessionMapping();
  moPendingMappings.set(sourceIndex, Object.freeze({ ...current, [key]: input.value }));
  const status = document.querySelector<HTMLElement>("#moPdfStatus");
  if (status) status.textContent = "Unconfirmed MO-session edit; press Confirm to apply to this draft only.";
}

function confirmMoSessionChoices(): void {
  moSessionMappings = new Map(moPendingMappings);
  moPendingMappings = new Map(moSessionMappings);
  const selected = Array.from(moSessionMappings, ([index, mapping]) => ({ index, mapping }))
    .filter(({ mapping }) => hasMoSessionMapping(mapping));
  const partyChoices = selected.flatMap(({ index, mapping }) => [
    mapping.senderSource === "blank" ? "" : `${index}:sender=${mapping.senderSource}`,
    mapping.receiverSource === "blank" ? "" : `${index}:receiver=${mapping.receiverSource}`,
  ]).filter(Boolean);
  moPdfState = Object.freeze({
    exporting: false,
    message: `Confirmed ${selected.length} MO-session row choices. ${partyChoices.join(", ")}. Not postal-verified.`,
  });
  render();
}

function bindMoMappingHandlers(): void {
  if (moMappingHandlersBound) return;
  app.addEventListener("input", updatePendingMoMapping);
  app.addEventListener("change", updatePendingMoMapping);
  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const choice = target.closest<HTMLButtonElement>("[data-mo-map-choice-key][data-mo-map-choice-index][data-mo-map-choice-value]");
    if (choice) {
      event.preventDefault();
      const sourceIndex = Number(choice.dataset.moMapChoiceIndex);
      const key = choice.dataset.moMapChoiceKey as MoSessionMappingKey;
      const value = choice.dataset.moMapChoiceValue;
      if (!Number.isInteger(sourceIndex) || !key || value === undefined) return;
      const current = moPendingMappings.get(sourceIndex) ?? moSessionMappings.get(sourceIndex) ?? emptyMoSessionMapping();
      const confirmed = Object.freeze({ ...current, [key]: value });
      moPendingMappings.set(sourceIndex, confirmed);
      moSessionMappings.set(sourceIndex, confirmed);
      moPdfState = Object.freeze({ exporting: false, message: `Confirmed ${key} source for row ${sourceIndex + 1}; user-confirmed only, not postal-verified.` });
      render();
      return;
    }
    if (target.closest("#confirmMoMappings")) {
      event.preventDefault();
      confirmMoSessionChoices();
    }
  });
  moMappingHandlersBound = true;
}

async function downloadMoPdf(draftMode = false) {
  if (moPdfAbort || view !== "mo") return;
  const projection = currentMoProjection();
  if (!projection.candidates.length || formatSenderCnic(moSenderCnicInput).status === "invalid") return;
  if (draftMode && !projection.candidates.some((candidate) => hasMoSessionMapping(moSessionMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()))) return;
  if (draftMode) {
    const invalidMapping = projection.candidates.map((candidate) => moSessionMappingError(moSessionMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())).find(Boolean);
    if (invalidMapping) {
      moPdfState = Object.freeze({ exporting: false, error: invalidMapping });
      render();
      return;
    }
  }
  const controller = new AbortController();
  moPdfAbort = controller;
  moPdfState = Object.freeze({ exporting: true, message: draftMode ? "Preparing user-confirmed draft PDF…" : "Preparing blank manual-completion PDF…" });
  render();
  try {
    const { createMoPdfBlob } = await import("./mo/pdf");
    const blob = await createMoPdfBlob(projection.candidates, moSenderCnicInput, {
      signal: controller.signal,
      backRotation: moBackRotation,
      mappings: draftMode ? moSessionMappings : undefined,
      draftMode,
      onProgress: ({ completedPages, totalPages }) => {
        moPdfState = Object.freeze({ exporting: true, progress: Object.freeze({ completedPages, totalPages }) });
        const status = document.querySelector<HTMLElement>("#moPdfStatus");
        if (status) status.textContent = `Preparing blank forms: ${completedPages}/${totalPages} pages`;
      },
    });
    if (controller.signal.aborted) throw new DOMException("MO PDF export cancelled", "AbortError");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mo51-${draftMode ? "user-confirmed-draft" : "manual-completion"}-${projection.candidates.length}-forms.pdf`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    moPdfState = Object.freeze({ exporting: false, message: `Downloaded ${Math.ceil(projection.candidates.length / 2) * 2}-page ${draftMode ? "user-confirmed DRAFT" : "blank manual-completion"} packet.` });
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    if (moPdfAbort === controller) {
      const detail = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_LOCAL_ERROR";
      moPdfState = Object.freeze({
        exporting: false,
        error: cancelled ? "Export cancelled. No PDF was produced." : `MO PDF export failed (${detail}). No file was downloaded.`,
      });
    }
  } finally {
    if (moPdfAbort === controller) {
      moPdfAbort = undefined;
      render();
    }
  }
}

async function runMoLayoutOutput(printAfterBuild: boolean): Promise<void> {
  if (moPdfAbort || view !== "mo") return;
  const projection = currentMoProjection();
  if (!projection.candidates.length) {
    moLayoutError = "No eligible selected VPL/VPP records.";
    render();
    return;
  }
  if (!moLayout.fields.length) {
    moLayoutError = "Drag at least one source field onto the MO-51 artwork before batch output.";
    render();
    return;
  }
  if (formatSenderCnic(moSenderCnicInput).status === "invalid") {
    moLayoutError = "Sender CNIC is invalid; correct or clear it before output.";
    render();
    return;
  }
  const missing = projection.candidates.flatMap((candidate) => moLayout.fields
    .filter((field) => field.source !== "senderCnic" && !resolveMoLayoutSource(candidate, field.source, moSenderCnicInput, moSessionMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()))
    .map((field) => `source row ${candidate.sourceIndex + 1}: ${MO_LAYOUT_SOURCES.find((source) => source.id === field.source)?.label ?? "mapped field"}`));
  if (missing.length || moLayoutError) {
    moLayoutError = missing.length ? `Missing selected layout values: ${missing.join(", ")}` : moLayoutError;
    render();
    return;
  }

  const popup = printAfterBuild ? window.open("about:blank", "_blank") : null;
  if (printAfterBuild && !popup) {
    moLayoutError = "MO_PRINT_POPUP_BLOCKED: allow a local print tab, then retry.";
    render();
    return;
  }
  moPrintWindow = popup;
  const controller = new AbortController();
  moPdfAbort = controller;
  moPdfState = Object.freeze({ exporting: true, message: printAfterBuild ? "Preparing batch for the system print dialog…" : "Preparing mapped batch PDF…" });
  render();
  let url: string | undefined;
  try {
    const { createMoPdfBlob } = await import("./mo/pdf");
    const blob = await createMoPdfBlob(projection.candidates, moSenderCnicInput, {
      signal: controller.signal,
      backRotation: moBackRotation,
      mappings: moSessionMappings,
      layout: moLayout,
      sideMode: moPrintSideMode,
      onProgress: ({ completedPages, totalPages }) => {
        moPdfState = Object.freeze({ exporting: true, progress: Object.freeze({ completedPages, totalPages }) });
        const status = document.querySelector<HTMLElement>("#moPdfStatus");
        if (status) status.textContent = `Rendering mapped batch: ${completedPages}/${totalPages} pages`;
      },
    });
    if (controller.signal.aborted) throw new DOMException("MO layout output cancelled", "AbortError");
    if (blob.type !== "application/pdf") throw new Error("MO_OUTPUT_NOT_APPLICATION_PDF");
    const pageCount = Math.ceil(projection.candidates.length / 2) * (moPrintSideMode === "paired" ? 2 : 1);
    await logEvent("PDF_GENERATED", { rows: projection.candidates.length, pages: pageCount });
    if (controller.signal.aborted) throw new DOMException("MO layout output cancelled", "AbortError");
    url = URL.createObjectURL(blob);
    if (printAfterBuild && popup) {
      const printUrl = url;
      let targetTimer: number | undefined;
      let verificationTimer: number | undefined;
      let revokeFallbackTimer: number | undefined;
      let settled = false;
      const clearVerificationTimers = (): void => {
        if (targetTimer !== undefined) window.clearTimeout(targetTimer);
        if (verificationTimer !== undefined) window.clearInterval(verificationTimer);
        if (revokeFallbackTimer !== undefined) window.clearTimeout(revokeFallbackTimer);
      };
      const failClosed = (reason: string): void => {
        if (settled) return;
        settled = true;
        clearVerificationTimers();
        if (!popup.closed) popup.close();
        URL.revokeObjectURL(printUrl);
        moPrintWindow = null;
        moPdfState = Object.freeze({ exporting: false, error: `MO_PRINT_TARGET_REJECTED: ${reason}. No print was requested.` });
        render();
      };
      const verifyPopupTarget = (): void => {
        if (settled) return;
        if (popup.closed) {
          failClosed("the generated PDF popup closed before verification");
          return;
        }
        let actualUrl = "";
        let contentType = "";
        try {
          actualUrl = popup.location.href;
          contentType = popup.document.contentType;
        } catch {
          // Cross-origin or browser-internal pages are never valid print targets.
          failClosed("the print target is not an accessible same-origin PDF document");
          return;
        }
        if (actualUrl === "about:blank") return;
        if (actualUrl !== printUrl) {
          failClosed("popup did not resolve to the exact generated PDF blob");
          return;
        }
        if (!isExpectedMoPrintTarget(actualUrl, printUrl, contentType)) return;
        settled = true;
        clearVerificationTimers();
        // Chrome may replace the about:blank target with its PDF viewer; do not revoke on that target's pagehide.
        revokeFallbackTimer = window.setTimeout(() => {
          URL.revokeObjectURL(printUrl);
          if (moPrintWindow === popup) moPrintWindow = null;
        }, MO_PRINT_BLOB_URL_FALLBACK_MS);
        moPdfState = Object.freeze({ exporting: false, message: "Verified MO PDF opened; browser print dialog requested. Duplex calibration remains pending." });
        render();
        try {
          popup.focus();
          popup.print();
        } catch {
          URL.revokeObjectURL(printUrl);
          moPrintWindow = null;
          moPdfState = Object.freeze({ exporting: false, error: "MO_PRINT_TARGET_REJECTED: the verified PDF could not be opened for printing. No print was requested." });
          if (!popup.closed) popup.close();
          render();
        }
      };
      verificationTimer = window.setInterval(verifyPopupTarget, 100);
      targetTimer = window.setTimeout(() => failClosed("the generated PDF did not load in the print target"), 30000);
      popup.location.href = printUrl;
      moPdfState = Object.freeze({ exporting: false, message: "Waiting for the generated MO PDF target to verify before printing…" });
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = `mo51-layout-batch-${projection.candidates.length}-forms.pdf`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => { if (url) URL.revokeObjectURL(url); }, 1000);
      moPdfState = Object.freeze({ exporting: false, message: `Downloaded ${pageCount}-page mapped layout PDF.` });
    }
    moLayoutError = "";
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    if (popup && !popup.closed) popup.close();
    moPrintWindow = null;
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    moPdfState = Object.freeze({ exporting: false, error: cancelled ? "Output cancelled; no PDF was produced." : `MO layout output failed (${error instanceof Error ? error.message.slice(0, 120) : "local error"}); no file was emitted.` });
  } finally {
    if (moPdfAbort === controller) {
      moPdfAbort = undefined;
      if (!printAfterBuild || moPdfState.error) moPrintWindow = null;
      render();
    }
  }
}

function render() {
  const body =
    view === "upload"
      ? renderUpload()
      : view === "mapping"
        ? renderMapping()
        : view === "review"
          ? renderReview()
          : view === "preview"
            ? renderPreview()
            : view === "print"
              ? renderPrint()
              : view === "mo"
                ? renderMo()
                : renderAdmin();
  app.innerHTML = `${nav()}<main class="main">${body}</main><footer class="app-footer"><span>GARDEN SHOP LABEL PRINTER <i>·</i> TEMPLATE ${TEMPLATE_VERSION}</span><span>INDEPENDENT TOOL / NO ORDER SYSTEM CONNECTION</span></footer>`;
  if (["review", "preview", "print"].includes(view))
    app.querySelector(".main")?.insertAdjacentHTML("afterbegin", `<p class="reference-scope-notice" role="note">${esc(LABEL_REFERENCE_NOTICE)}</p>`);
  if (view === "print" && countLimit === 0) {
    const countInput = document.querySelector<HTMLInputElement>("#countLimit");
    if (countInput) countInput.value = "0";
  }
  if (view === "print" && countLimit < 0) {
    const countInput = document.querySelector<HTMLInputElement>("#countLimit");
    if (countInput) countInput.value = String(currentOrders().length);
  }
  if (view === "preview") drawBarcodes();
  bind();
  if (view === "admin") void loadAdmin();
}

function drawBarcodes() {
  document
    .querySelectorAll<HTMLCanvasElement>("canvas[data-barcode]")
    .forEach(async (canvas) => {
      const index = Number(canvas.dataset.barcode),
        tracking = rows[index]?.tracking;
      if (!tracking) return;
      try {
        await renderBarcode(canvas, tracking);
        if (!sizeBarcode(canvas, index)) return;
        void verifyBarcode(canvas, tracking).then(() => {
          canvas.dataset.verified = "true";
        }).catch(() => {
          canvas.dataset.verified = "false";
          flagLabel(canvas.closest<HTMLElement>(".label"), index, "Generated barcode could not be decoded; verify this tracking value before printing.");
        });
      } catch {
        flagLabel(canvas.closest<HTMLElement>(".label"), index, "Barcode generation failed.");
      }
    });
  requestAnimationFrame(() => measureLabels());
}

async function renderBarcode(canvas: HTMLCanvasElement, tracking: string) {
  const jsBarcode = await import("jsbarcode");
  jsBarcode.default(canvas, tracking, {
    format: "CODE128",
    displayValue: false,
    margin: 10,
    marginTop: CODE128_LAYOUT.verticalQuietZonePx,
    marginBottom: CODE128_LAYOUT.verticalQuietZonePx,
    marginLeft: CODE128_LAYOUT.horizontalQuietZonePx,
    marginRight: CODE128_LAYOUT.horizontalQuietZonePx,
    height: CODE128_LAYOUT.heightPx,
    width: CODE128_LAYOUT.moduleWidthPx,
  });
}

function sizeBarcode(canvas: HTMLCanvasElement, index: number): boolean {
  const box = labelBoxes(currentPaperPreset()).barcode;
  const pxPerMm = 96 / 25.4;
  const scale = Math.min(1, box.width * pxPerMm / canvas.width, box.height * pxPerMm / canvas.height);
  const moduleMm = scale * CODE128_LAYOUT.moduleWidthPx / pxPerMm;
  if (moduleMm < CODE128_LAYOUT.minimumModuleMm) {
    const label = canvas.closest<HTMLElement>(".label");
    canvas.style.visibility = "hidden";
    flagLabel(label, index, "Tracking barcode is too dense for the scan-safe width; edit this tracking value.");
    return false;
  }
  canvas.style.visibility = "visible";
  canvas.style.setProperty("--bar-width", `${canvas.width * scale / pxPerMm}mm`);
  canvas.style.setProperty("--bar-height", `${canvas.height * scale / pxPerMm}mm`);
  return true;
}

async function renderBarcodeSvg(tracking: string) {
  const jsBarcode = await import("jsbarcode");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  jsBarcode.default(svg, tracking, {
    format: "CODE128",
    displayValue: false,
    margin: 10,
    marginTop: CODE128_LAYOUT.verticalQuietZonePx,
    marginBottom: CODE128_LAYOUT.verticalQuietZonePx,
    marginLeft: CODE128_LAYOUT.horizontalQuietZonePx,
    marginRight: CODE128_LAYOUT.horizontalQuietZonePx,
    height: CODE128_LAYOUT.heightPx,
    width: CODE128_LAYOUT.moduleWidthPx,
    lineColor: "#000000",
    background: "#ffffff",
  });
  const width = Number.parseFloat(svg.getAttribute("width") ?? "0");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "0");
  const bars = [...svg.querySelectorAll("rect")]
    .filter((rect) => !["#fff", "#ffffff", "white"].includes((rect.getAttribute("fill") ?? "").toLowerCase()))
    .map((rect) => ({
      x: Number.parseFloat(rect.getAttribute("x") ?? "0"),
      y: Number.parseFloat(rect.getAttribute("y") ?? "0"),
      width: Number.parseFloat(rect.getAttribute("width") ?? "0"),
      height: Number.parseFloat(rect.getAttribute("height") ?? "0"),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!width || !height || !bars.length) throw new Error("BARCODE_VECTOR_GENERATION_FAILED");
  return { width, height, moduleWidth: CODE128_LAYOUT.moduleWidthPx, bars };
}

function barcodeCanvasInkBounds(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("BARCODE_CANVAS_CONTEXT_UNAVAILABLE");
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      if (data[pixel] < 128 && data[pixel + 1] < 128 && data[pixel + 2] < 128 && data[pixel + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
  }
  if (right < 0 || bottom < 0) throw new Error("BARCODE_CANVAS_EMPTY");
  return { left, top, right, bottom };
}

function measureLabels(root: ParentNode = document, canvasDocument: Document = document) {
  const context = canvasDocument.createElement("canvas").getContext("2d");
  if (!context) return;
  const preset = currentPaperPreset();
  root
    .querySelectorAll<HTMLElement>(".label[data-label-index]")
    .forEach((label) => {
      const rowIndex = Number(label.dataset.labelIndex),
        row = rows[rowIndex];
      label.classList.toggle("has-warning", Boolean(row?.warnings.length));
      let overflow = false;
      const setBox = (selector: string, box: { x: number; y: number; width: number; height: number }) => {
        const element = label.querySelector<HTMLElement>(selector);
        if (!element) return;
        element.style.setProperty("--box-x", `${box.x}mm`);
        element.style.setProperty("--box-y", `${box.y}mm`);
        element.style.setProperty("--box-width", `${box.width}mm`);
        element.style.setProperty("--box-height", `${box.height}mm`);
      };
      const display = row ? trackingLabelDisplay(row.tracking, row.cod) : trackingLabelDisplay("", "");
      const recipient = recipientBoxes(context, row?.name ?? "", preset);
      setBox(".receiver-name", recipient.name);
      setBox(".address-text", recipient.address);
      const destination = destinationBoxes(context, row?.city ?? "", row?.province ?? "", preset, display.expandDestination);
      setBox(".destination", destination.container);
      const destinationElement = label.querySelector<HTMLElement>(".destination");
      destinationElement?.style.setProperty("--city-row-height", `${destination.city.height}mm`);
      destinationElement?.style.setProperty("--province-row-height", `${destination.province.height}mm`);
      destinationElement?.classList.toggle("long-province", destination.province.height > 3.1);
      destinationElement?.classList.toggle("short-province", destination.province.height < 3.1);
      destinationElement?.classList.toggle("expanded-destination", display.expandDestination);
      const fit = (selector: string, text: string, max: number, min: number, bold = false, wrap = true, availableWidth?: number) => {
        const element = label.querySelector<HTMLElement>(selector);
        if (!element || !text) return;
        if (availableWidth !== undefined) {
          element.style.width = "max-content";
          element.style.maxWidth = `${availableWidth}px`;
          element.style.boxSizing = "border-box";
        }
        const style = canvasDocument.defaultView?.getComputedStyle(element);
        const reserved = 0;
        const width = (availableWidth ?? element.clientWidth) - (style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0) - reserved;
        const height = element.clientHeight - (style ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) : 0);
        const lineHeight = style?.lineHeight && style.lineHeight !== "normal"
          ? parseFloat(style.lineHeight) / Math.max(1, parseFloat(style.fontSize))
          : 1.15;
        const zoomScale = label.closest(".sheet") ? zoom : 1;
        const result = fitTextPx(context, text, width, height, max * zoomScale, min * zoomScale, bold, lineHeight, wrap);
        element.style.fontFamily = labelFontFamily(text);
        element.dir = usesArabicScript(text) ? "rtl" : "ltr";
        element.style.whiteSpace = wrap ? "pre-line" : "nowrap";
        element.textContent = result.lines.join("\n");
        element.style.fontSize = String(result.fontSize) + "px";
        const clipped = !result.fits || element.scrollWidth > element.clientWidth + 1;
        element.classList.toggle("text-overflow", clipped);
        if (clipped) element.setAttribute("data-text-overflow", "true");
        else element.removeAttribute("data-text-overflow");
        if (clipped) overflow = true;
      };
      fit(".tracking-value", row?.tracking || "", 9, 6.5, true, false);
      fit(".printed-reference", row?.printedReference || "", 11, 8, false, false);
      fit(".product-value", row?.product || "", 10, 6.5, true, false);
      if (display.showAmountBox) {
        fit(".vpl-prefix", display.prefix, 6.5, 5.5, true, false);
        const amount = label.querySelector<HTMLElement>(".vpl-declared");
        const commission = label.querySelector<HTMLElement>(".vpl-commission");
        const amountLine = label.querySelector<HTMLElement>(".vpl-amount");
        if (amount && amountLine && display.declaredAmount !== undefined && display.commission !== undefined) {
          amount.textContent = String(display.declaredAmount);
          if (commission) commission.textContent = `+${display.commission}`;
          const result = fitCommissionExpression(
            context,
            amount.textContent,
            display.commission,
            amountLine.clientWidth,
            amountLine.clientHeight,
            20 * (label.closest(".sheet") ? zoom : 1),
            8 * (label.closest(".sheet") ? zoom : 1),
          );
          amount.style.fontSize = `${result.fontSize}px`;
          if (commission) commission.style.fontSize = `${result.commissionFontSize}px`;
          amountLine.classList.toggle("text-overflow", !result.fits);
          if (!result.fits) overflow = true;
        } else if (amount) fit(".vpl-declared", "FIX AMOUNT", 12, 7, true, false);
      }
      fit(".city-text", row?.city || "", display.expandDestination ? 20 : usesArabicScript(row?.city || "") ? 10.5 : 15, 7, true);
      const provinceWidth = destination.province.width * 96 / 25.4;
      fit(".province-text", row?.province || "", 9.5, 6, true, false, provinceWidth);
      fit(".receiver-name", row?.name || "", 12, 9, true);
      fit(".address-text", label.querySelector<HTMLElement>(".address-text")?.textContent ?? "", 11, 8);
      fit(".nearby-label", "Near by:", 9.5, 7.5, true, false);
      fit(".landmark", row?.landmark || "", 9.5, 7.5);
      fit(".contact-number", normalizePakistaniPhone(row?.phone ?? "") ?? "", 12, 9, true, false);
      fit(".product-label", "Product:", 7.5, 6.5, true, false);
      fit(".footer-from", "From:", 12, 9, true, false);
      fit(".footer-sender", "Garden Shop", 10, 6.5, true, false);
      fit(".footer-address", LABEL_FOOTER_ADDRESS, 8, 6.5, false, false);
      label.classList.toggle("layout-overflow", overflow);
      if (overflow && row && !row.warnings.some((warning) => warning.startsWith("Text does not fit")))
        row.warnings.push("Text does not fit at minimum readable size; edit the record before printing.");
    });
}

function flagLabel(label: HTMLElement | null, index: number, warning: string) {
  if (!rows[index].warnings.includes(warning)) rows[index].warnings.push(warning);
  if (label) {
    label.classList.add("layout-overflow");
    label.classList.add("has-warning");
    measureLabels(label.ownerDocument, label.ownerDocument);
  }
}


function preparePrintLayout(popup: Window): Promise<void> {
  const fontStyles = popup.document.createElement("style");
  fontStyles.textContent = [...document.styleSheets]
    .flatMap((sheet) => {
      try { return [...sheet.cssRules]; } catch { return []; }
    })
    .filter((rule) => rule instanceof CSSFontFaceRule && rule.cssText.includes("Noto Naskh Arabic"))
    .map((rule) => rule.cssText)
    .join("\n");
  popup.document.head.append(fontStyles);
  const sharedStyles = popup.document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href="/label.css"]');
  if (!sharedStyles?.sheet) return Promise.reject(new Error("PRINT_STYLESHEET_FAILED"));
  return popup.document.fonts.ready.then(() => {
    measureLabels(popup.document, popup.document);
  });
}

function openPrintPopup(items: Array<{ row: Order; index: number }>, position: number) {
  const preset = currentPaperPreset();
  const hpP2055SafeCss = preset.id === "CUSTOM" && hpP2055SafeArea
    ? `<style>${Array.from({ length: preset.rows * preset.columns }, (_, slot) => {
      const transform = labelContentTransform(preset, slot, true);
      if (transform.offsetX === 0 && transform.offsetY === 0 && transform.scaleX === 1 && transform.scaleY === 1) return "";
      const css = (value: number) => Number(value.toFixed(8));
      const cell = `.print-sheet>.label:nth-child(${slot + 1})`;
      return `${cell}>.label-content{transform:translate(${css(transform.offsetX)}mm,${css(transform.offsetY)}mm) scale(${css(transform.scaleX)},${css(transform.scaleY)});transform-origin:top left}${cell}>.label-content .barcode-canvas{transform:scale(${css(1 / transform.scaleX)},${css(1 / transform.scaleY)});transform-origin:top left}`;
    }).join("\n")}</style>`
    : "";
  const popup = window.open("", "_blank");
  if (!popup) return undefined;
  const pages = pagesForCount(items.length, position);
  const sheets = Array.from({ length: pages }, (_, pageNo) =>
    `<main class="print-sheet ${pageNo < pages - 1 ? "page-break" : ""}">${Array.from({ length: 18 }, (_, slot) => {
      const index = pageNo * 18 + slot - (position - 1);
      return index >= 0 && items[index]
        ? labelMarkup(items[index].row, items[index].index)
        : '<div class="empty-label" aria-hidden="true"></div>';
    }).join("")}</main>`,
  ).join("");
  popup.document.open();
  const screenMargin = preset.id === "CUSTOM" ? "0" : "12mm";
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Garden Shop labels</title><link rel="stylesheet" href="/label.css"><style>@page{size:${preset.widthMm}mm ${preset.heightMm}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;width:${preset.widthMm}mm;height:${preset.heightMm}mm;background:#fff}.print-sheet{width:${preset.widthMm}mm;height:${preset.heightMm}mm;padding:${preset.rowStartsMm[0]}mm ${preset.columnStartsMm[0]}mm;display:grid;grid-template-columns:repeat(${preset.columns},${preset.labelWidthMm}mm);grid-template-rows:repeat(${preset.rows},${preset.labelHeightMm}mm);column-gap:${preset.columnGapMm}mm;row-gap:${preset.rowGapMm}mm;overflow:hidden}.page-break{break-after:page}.empty-label{width:${preset.labelWidthMm}mm;height:${preset.labelHeightMm}mm}@media screen{body{width:${preset.widthMm}mm;margin:${screenMargin} auto}}</style>${hpP2055SafeCss}</head><body>${sheets}</body></html>`);
  popup.addEventListener("load", async () => {
    await Promise.all(
      [...popup.document.querySelectorAll<HTMLCanvasElement>("canvas[data-barcode]")].map(async (canvas) => {
        const item = items.find(({ index }) => index === Number(canvas.dataset.barcode));
        if (item?.row.tracking) {
          await renderBarcode(canvas, item.row.tracking);
          sizeBarcode(canvas, item.index);
        }
      }),
    );
    try {
      await preparePrintLayout(popup);
      if (items.some(({ row }) => printBlocker(row))) {
        popup.close();
        statusMessage = "Review the highlighted label fields before printing.";
        render();
        return;
      }
      const counts = { labels: items.length, pages: pagesForCount(items.length, position) };
      await logEvent("LABELS_GENERATED", counts);
      await logEvent(printRequested ? "REPRINT_REQUESTED" : "PRINT_REQUESTED", counts);
      printRequested = true;
      popup.focus();
      popup.print();
    } catch {
      popup.close();
      statusMessage = "The print layout could not be prepared. The batch remains available for correction.";
      render();
    }
  }, { once: true });
  popup.document.close();
  return popup;
}

async function parseFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("FILE_SIZE_LIMIT_10MB");
  importedFileName = file.name;
  batchId = crypto.randomUUID();
  if (file.name.toLowerCase().endsWith(".csv")) {
    workbookDate1904 = false;
    const parsed = parseCsv(await file.text());
    headers = (parsed.shift() ?? []).map((value) =>
      value.replace(/^\uFEFF/, "").trim(),
    );
    rawRows = parsed;
  } else {
    const { readSheet } = await import("read-excel-file/browser");
    const fileBytes = await file.arrayBuffer();
    const matrix = (await readSheet(file)) as unknown[][];
    workbookDate1904 = restoreZeroFormattedCells(new Uint8Array(fileBytes), matrix);
    headers = (matrix.shift() ?? []).map((value) => String(value ?? "").trim());
    rawRows = matrix;
  }
  if (rawRows.length > 5000) throw new Error("ROW_LIMIT_5000");
  if (!headers.length || !rawRows.length) throw new Error("NO_ROWS_FOUND");
  mapping = detectMapping(headers);
  const saved = localStorage.getItem("gfs-label-mapping-v1");
  if (saved)
    try {
      const preset = JSON.parse(saved) as ImportMapping;
      for (const key of Object.keys(mapping) as Array<keyof ImportMapping>)
        if (headers.includes(preset[key])) mapping[key] = preset[key];
    } catch {
      localStorage.removeItem("gfs-label-mapping-v1");
    }
  await logEvent("FILE_PROCESSED", { rows: rawRows.length });
  view = "mapping";
  render();
}

function validateMoPreviewFit(): void {
  if (moLayoutRepairPreview) return;
  const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>("#moFrontPreview,#moBackPreview,#moLayoutFrontPreview,#moLayoutBackPreview"));
  void Promise.all(frames.map((frame) => frame.contentDocument?.fonts?.ready ?? Promise.resolve())).then(() => {
    const visible = frames.flatMap((frame) => frame.contentDocument ? findMoLayoutDiagnostics(frame.contentDocument) : []);
    const projection = currentMoProjection();
    if (moLayout.fields.length) scheduleMoLayoutBatchValidation(projection, moLayout, visible);
    else updateMoLayoutDiagnosticUi(visible, false);
  });
}

function uniqueMoLayoutDiagnostics(issues: readonly MoLayoutDiagnostic[]): MoLayoutDiagnostic[] {
  return issues.filter((issue, index, all) => all.findIndex((other) => other.code === issue.code && other.message === issue.message && other.fieldId === issue.fieldId && other.relatedFieldId === issue.relatedFieldId) === index);
}

function scheduleMoLayoutBatchValidation(projection: ReturnType<typeof currentMoProjection>, layout: MoLayout, visible: readonly MoLayoutDiagnostic[]): void {
  const signature = currentMoLayoutSignature(layout, projection);
  const state = moLayoutBatchState;
  if (state?.signature === signature && state.status === "valid") {
    updateMoLayoutDiagnosticUi([...visible, ...(state.report?.diagnostics ?? [])], false, state.report);
    return;
  }
  if (state?.signature === signature && (state.status === "pending" || state.status === "checking")) {
    updateMoLayoutDiagnosticUi(visible, true);
    return;
  }
  if (state?.signature === signature && (state.status === "blocked" || state.status === "error")) {
    updateMoLayoutDiagnosticUi([...visible, ...(state.report?.diagnostics ?? [])], false, state.report, state.error);
    return;
  }

  moLayoutBatchAbort?.abort();
  moLayoutBatchAbort = undefined;
  if (moLayoutBatchTimer !== undefined) window.clearTimeout(moLayoutBatchTimer);
  const generation = ++moLayoutBatchGeneration;
  moLayoutBatchState = Object.freeze({ signature, status: "pending" });
  updateMoLayoutDiagnosticUi(visible, true);
  const capturedLayout = layout;
  const capturedProjection = projection;
  moLayoutBatchTimer = window.setTimeout(() => {
    moLayoutBatchTimer = undefined;
    if (generation !== moLayoutBatchGeneration) return;
    const controller = new AbortController();
    moLayoutBatchAbort = controller;
    moLayoutBatchState = Object.freeze({ signature, status: "checking" });
    updateMoLayoutDiagnosticUi(visible, true);
    const cnic = formatSenderCnic(moSenderCnicInput);
    const senderCnic = cnic.status === "valid" ? cnic.formatted : "";
    const faces = moPrintSideMode === "front-only" ? ["front"] as const : moPrintSideMode === "back-only" ? ["back"] as const : ["front", "back"] as const;
    void validateMoBatchLayout(capturedProjection.candidates, senderCnic, moBackRotation, moSessionMappings, capturedLayout, faces, controller.signal, (checked, total) => {
      const progress = document.querySelector<HTMLElement>("#moMappingFitError p");
      if (progress && moLayoutBatchState?.signature === signature && moLayoutBatchGeneration === generation) progress.textContent = `Checking ${capturedProjection.candidates.length} records (${checked}/${total} rendered faces). Output remains blocked.`;
    }).then((report) => {
      if (controller.signal.aborted || generation !== moLayoutBatchGeneration || currentMoLayoutSignature(moLayout) !== signature) return;
      const status = report.diagnostics.length ? "blocked" : "valid";
      moLayoutBatchState = Object.freeze({ signature, status, report });
      updateMoLayoutDiagnosticUi([...visible, ...report.diagnostics], false, report);
    }).catch((error) => {
      if (controller.signal.aborted || generation !== moLayoutBatchGeneration) return;
      const message = error instanceof Error ? error.message : "MO_LAYOUT_BATCH_VALIDATION_FAILED";
      moLayoutBatchState = Object.freeze({ signature, status: "error", error: message });
      updateMoLayoutDiagnosticUi(visible, false, undefined, message);
    });
  }, 250);
}

function updateMoLayoutDiagnosticUi(issues: readonly MoLayoutDiagnostic[], pending: boolean, report?: MoBatchLayoutValidation, validationError?: string): void {
  const allIssues = [...issues];
  if (!currentMoProjection().candidates.length) allIssues.push({ code: "missing", message: "No eligible selected VPL/VPP records." });
  if (hasLegacyMoPartyPositions(moLayout)) allIssues.push({ code: "legacy", message: "Saved Sender/Receiver fields remain in legacy blocks; apply a correction before output." });
  if (validationError) allIssues.push({ code: "legacy", message: `Full-batch validation failed; output remains blocked (${validationError}).` });
  const unique = uniqueMoLayoutDiagnostics(allIssues);
  const cnicInvalid = Boolean(document.querySelector("#moSenderCnic[aria-invalid='true']"));
  moLayoutError = pending ? "Validating mapped fields across all selected records." : unique.length ? "Mapped layout fields require attention." : cnicInvalid ? "Correct or clear the optional Sender CNIC before output." : "";
  const editorAlert = document.querySelector<HTMLElement>(".mo-layout-editor > .mo-mapping-fit-error");
  if (editorAlert && !moLayoutRepairPreview) { editorAlert.textContent = moLayoutError; editorAlert.hidden = !moLayoutError; }
  const cleanWarning = document.querySelector<HTMLElement>(".mo-clean-preview-warning");
  if (cleanWarning && !moLayoutRepairPreview) { cleanWarning.textContent = moLayoutError; cleanWarning.hidden = !moLayoutError; }
  const oldStatus = document.querySelector<HTMLElement>("#moMappingFitError");
  if (oldStatus) {
    const status = document.createElement("div");
    status.id = "moMappingFitError";
    status.className = "mo-mapping-fit-error";
    status.setAttribute("role", pending ? "status" : unique.length || cnicInvalid ? "alert" : "status");
    const summary = document.createElement("p");
    if (pending) summary.textContent = `Checking ${currentMoProjection().candidates.length} selected records across every printed face. Download and print stay disabled until this check finishes.`;
    else if (unique.length) summary.textContent = "Mapped layout fields require attention. Review the affected source rows and select a field to repair it.";
    else if (cnicInvalid) summary.textContent = moLayoutError;
    else if (report) summary.textContent = `PASS · ${report.checkedRecords} eligible records checked on ${report.sheetCount} sheets (${report.checkedFaceDocuments} rendered face documents; ${Math.round(report.validationDurationMs)} ms; static artwork ${report.staticArtworkGeometryMeasurements} measured/${report.staticArtworkGeometryCacheHits} reused).`;
    if (summary.textContent) status.append(summary);
    if (pending && moLayoutBatchAbort) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.id = "cancelMoLayoutValidation";
      cancel.textContent = "Cancel full-batch validation";
      cancel.addEventListener("click", () => {
        const signature = currentMoLayoutSignature(moLayout);
        moLayoutBatchAbort?.abort();
        moLayoutBatchAbort = undefined;
        if (moLayoutBatchTimer !== undefined) window.clearTimeout(moLayoutBatchTimer);
        moLayoutBatchTimer = undefined;
        moLayoutBatchState = Object.freeze({ signature, status: "error", error: "MO_LAYOUT_BATCH_VALIDATION_CANCELLED" });
        updateMoLayoutDiagnosticUi(issues, false, undefined, "MO_LAYOUT_BATCH_VALIDATION_CANCELLED");
      });
      status.append(cancel);
    } else if (validationError === "MO_LAYOUT_BATCH_VALIDATION_CANCELLED") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.id = "retryMoLayoutValidation";
      retry.textContent = "Run full-batch validation again";
      retry.addEventListener("click", () => {
        moLayoutBatchState = undefined;
        moLayoutError = "";
        render();
      });
      status.append(retry);
    }
    if (unique.length) {
      const list = document.createElement("ul");
      for (const issue of unique) {
        const item = document.createElement("li");
        const message = document.createElement("span");
        message.textContent = issue.message;
        item.append(message);
        const fieldIds = [...new Set([issue.fieldId, issue.relatedFieldId].filter((id): id is string => Boolean(id)))];
        for (const fieldId of fieldIds) {
          const field = moLayout.fields.find((candidate) => candidate.id === fieldId);
          if (!field) continue;
          const label = MO_LAYOUT_SOURCES.find((source) => source.id === field.source)?.label ?? "mapped field";
          const select = document.createElement("button");
          select.type = "button";
          select.textContent = `Select ${label} (${field.face})`;
          select.addEventListener("click", () => {
            moSelectedLayoutFieldId = field.id;
            moLayoutEditMode = true;
            moCleanPreview = false;
            moLayoutStatus = `Selected ${label} for direct layout adjustment.`;
            render();
          });
          item.append(select);
        }
        list.append(item);
      }
      status.append(list);
    }
    oldStatus.replaceWith(status);
  }
  const blocked = pending || unique.length > 0 || cnicInvalid || Boolean(validationError);
  const draftButton = document.querySelector<HTMLButtonElement>("#downloadMoDraftPdf");
  if (draftButton) draftButton.disabled = blocked;
  const layoutDownload = document.querySelector<HTMLButtonElement>("#downloadMoLayoutPdf");
  if (layoutDownload) layoutDownload.disabled = blocked;
  const layoutPrint = document.querySelector<HTMLButtonElement>("#printMoBatch");
  if (layoutPrint) layoutPrint.disabled = blocked;
  const statusLine = document.querySelector<HTMLElement>(".mo-layout-status");
  if (statusLine && !pending && !unique.length && !validationError && report) statusLine.textContent = `Validated all ${report.checkedRecords} selected records across ${report.sheetCount} sheets.`;
}

function templateCsv() {
  const header = [
    "Sr. no",
    "Order ID",
    "Name",
    "consigneeEmail",
    "Cell #",
    "Address",
    "Facebook Name",
    "Tracking Number",
    "COD",
    "Product",
    "City",
    "Province",
    "Nearby Landmark",
    "Sender Name",
    "Sender Address",
  ];
  const csv = [
    header,
    [
      "1",
      "",
      "Sample Customer",
      "",
       "03001234567",
      "Street and house number",
      "",
      "TRACK123456",
      "1250",
      "Garden Seed Mix",
      "Sahiwal",
      "Punjab",
      "Near landmark",
      "Garden Shop",
      "C/o City Post Office, Sahiwal",
    ],
  ]
    .map((line) => line.map((cell) => safeCsvCell(cell)).join(","))
    .join("\r\n");
  download(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    "garden-shop-label-template.csv",
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  window.setTimeout(() => link.remove(), 30_000);
}

async function makePdf(items = currentOrders(), position = startPosition) {
  if (!items.length) throw new Error("NO_LABELS_SELECTED");
  const initialBlocker = items.map(({ row }) => printBlocker(row)).find(Boolean);
  if (initialBlocker) throw new Error(`LABEL_REQUIRES_CORRECTION: ${initialBlocker}`);
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const preset = currentPaperPreset();
  const scaleX = preset.labelWidthMm / 65;
  const scaleY = preset.labelHeightMm / 44;
  const mm = MM_TO_POINTS,
    pxPerMm = 96 / 25.4,
    pageH = pagePoints(preset).height;
  const boxes = labelBoxes(preset);
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("TEXT_MEASUREMENT_UNAVAILABLE");
  await document.fonts.ready;
  const totalPages = pagesForCount(items.length, position);
  for (let pageNo = 0; pageNo < totalPages; pageNo += 1) {
    const pdfPage = addA4Page(pdf, preset);
    for (let slot = 0; slot < 18; slot += 1) {
      const itemIndex = pageNo * 18 + slot - (position - 1),
        item = items[itemIndex];
      if (!item) continue;
      const geometry = labelBox(itemIndex, position, preset),
        xMm = geometry.x,
        yMm = geometry.y;
      const row = item.row;
      const trackingDisplay = trackingLabelDisplay(row.tracking, row.cod);
      const safeTransform = labelContentTransform(preset, geometry.slot, hpP2055SafeArea);
      const mapContentBox = (box: (typeof boxes)[keyof typeof boxes]) => transformLabelContentBox(box, safeTransform);
      const drawBoxText = async (
        text: string,
        box: (typeof boxes)[keyof typeof boxes],
        maxFont: number,
        minFont: number,
        isBold = false,
        color = rgb(0, 0, 0),
        align: "left" | "center" | "right" = "left",
        lineHeight = 1,
        wrap = true,
        fieldName = "label text",
      ) => {
        const safeBox = mapContentBox(box);
        const safeFontScale = Math.min(safeTransform.scaleX, safeTransform.scaleY);
        const fit = fitTextMm(measure, text, safeBox.width, safeBox.height, maxFont * safeFontScale, minFont * safeFontScale, isBold, lineHeight, wrap);
        if (!fit.fits) {
          if (!row.warnings.some((warning) => warning.startsWith("Text does not fit"))) row.warnings.push(`Text does not fit: ${fieldName}. Edit this record before printing.`);
          return;
        }
        if (usesComplexScript(text)) {
          await document.fonts.load(`${isBold ? "700 " : ""}${fit.fontSize}px "Noto Naskh Arabic"`);
          const scale = 4;
          const pxPerMm = 96 / 25.4;
          const widthPx = safeBox.width * pxPerMm;
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(widthPx * scale);
          canvas.height = Math.ceil(safeBox.height * pxPerMm * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("COMPLEX_TEXT_CANVAS_UNAVAILABLE");
          ctx.scale(scale, scale);
          ctx.fillStyle = "#000";
          ctx.font = `${isBold ? "900 " : "400 "}${fit.fontSize}px ${labelFontFamily(text)}`;
          const rtl = usesArabicScript(text);
          ctx.direction = rtl ? "rtl" : "ltr";
          ctx.textAlign = rtl ? "right" : align;
          ctx.textBaseline = "top";
          fit.lines.forEach((lineText, lineIndex) => {
            const left = align === "center" ? widthPx / 2 : align === "right" || rtl ? widthPx : 0;
            ctx.fillText(lineText, left, lineIndex * fit.fontSize * lineHeight, widthPx);
          });
          const image = await pdf.embedPng(canvas.toDataURL("image/png"));
          pdfPage.drawImage(image, {
            x: (xMm + safeBox.x) * mm,
            y: pageH - (yMm + safeBox.y + safeBox.height) * mm,
            width: safeBox.width * mm,
            height: safeBox.height * mm,
          });
          return;
        }
        const size = fit.fontSize * 0.75;
        const lineHeightMm = (fit.fontSize * lineHeight) / (96 / 25.4);
        fit.lines.forEach((lineText, lineIndex) => {
          const baselineMm = safeBox.y + (lineIndex + 0.86) * lineHeightMm;
          const textWidth = (isBold ? bold : font).widthOfTextAtSize(lineText, size);
          const boxWidth = safeBox.width * mm;
          const left = align === "center" ? (boxWidth - textWidth) / 2 : align === "right" ? boxWidth - textWidth : 0;
          pdfPage.drawText(lineText, {
            x: (xMm + safeBox.x) * mm + Math.max(0, left),
            y: pageH - (yMm + baselineMm) * mm,
            size,
            font: isBold ? bold : font,
            maxWidth: Math.max(1, boxWidth - Math.max(0, left)),
            color,
          });
        });
      };
      const fillRect = (box: { x: number; y: number; width: number; height: number }, color: ReturnType<typeof rgb>) => {
        const safeBox = mapContentBox(box);
        pdfPage.drawRectangle({ x: (xMm + safeBox.x) * mm, y: pageH - (yMm + safeBox.y + safeBox.height) * mm, width: safeBox.width * mm, height: safeBox.height * mm, color });
      };
      const drawCommissionExpression = (declared: number, commission: number, box: (typeof boxes)[keyof typeof boxes]) => {
        const safeBox = mapContentBox(box);
        const safeFontScale = Math.min(safeTransform.scaleX, safeTransform.scaleY);
        const fit = fitCommissionExpression(
          measure,
          String(declared),
          commission,
          safeBox.width * pxPerMm,
          safeBox.height * pxPerMm,
          20 * safeFontScale,
          8 * safeFontScale,
        );
        if (!fit.fits) {
          if (!row.warnings.some((warning) => warning.startsWith("Text does not fit"))) row.warnings.push("Text does not fit: declared amount and commission. Edit this record before printing.");
          return;
        }
        const amountSize = fit.fontSize * 0.75;
        const feeSize = fit.commissionFontSize * 0.75;
        const amountText = String(declared);
        const feeText = `+${commission}`;
        const amountWidth = bold.widthOfTextAtSize(amountText, amountSize);
        const feeWidth = font.widthOfTextAtSize(feeText, feeSize);
        const gap = 0.75;
        const boxWidth = safeBox.width * mm;
        const startX = (xMm + safeBox.x) * mm + Math.max(0, (boxWidth - amountWidth - gap - feeWidth) / 2);
        const baseline = pageH - (yMm + safeBox.y + safeBox.height / 2) * mm - amountSize * 0.3;
        pdfPage.drawText(amountText, { x: startX, y: baseline, size: amountSize, font: bold, maxWidth: amountWidth, color: rgb(0, 0, 0) });
        pdfPage.drawText(feeText, { x: startX + amountWidth + gap, y: baseline + (amountSize - feeSize) * 0.25, size: feeSize, font, maxWidth: feeWidth, color: rgb(0.28, 0.28, 0.28) });
      };
      const outline = (box: { x: number; y: number; width: number; height: number }, radius: number, stroke: number, color?: ReturnType<typeof rgb>, applySafeArea = true) => {
        const outlineBox = applySafeArea ? mapContentBox(box) : box;
        const left = (xMm + outlineBox.x) * mm;
        const top = pageH - (yMm + outlineBox.y) * mm;
        const r = radius * mm;
        const width = outlineBox.width * mm;
        const height = outlineBox.height * mm;
        pdfPage.drawSvgPath(`M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height - r} L 0 ${r} Q 0 0 ${r} 0 Z`, { x: left, y: top, borderColor: rgb(0, 0, 0), borderWidth: stroke * mm, ...(color ? { color } : {}) });
      };
      outline(boxes.outline, 1, 0.2, undefined, false);
      if (trackingDisplay.showAmountBox) outline(boxes.vpl, 1, 0.5);
      await drawBoxText(row.tracking, boxes.trackingText, 9, 6.5, true, rgb(0, 0, 0), "center", 1, false, "tracking value");
      if (trackingDisplay.showAmountBox) {
        await drawBoxText(trackingDisplay.prefix, { ...boxes.vpl, x: boxes.vpl.x + 0.3 * scaleX, y: boxes.vpl.y + 0.1 * scaleY, width: boxes.vpl.width - 0.6 * scaleX, height: 1.6 * scaleY }, 6.5, 5.5, true, rgb(0, 0, 0), "center", 0.95, false, `${trackingDisplay.prefix} heading`);
        if (trackingDisplay.declaredAmount !== undefined && trackingDisplay.commission !== undefined) {
          drawCommissionExpression(trackingDisplay.declaredAmount, trackingDisplay.commission, { ...boxes.vpl, x: boxes.vpl.x + 0.3 * scaleX, y: boxes.vpl.y + 1.8 * scaleY, width: boxes.vpl.width - 0.6 * scaleX, height: 5 * scaleY });
        }
      } else if (trackingDisplay.prefix === "UNKNOWN") {
        outline(boxes.vpl, 1, 0.5);
        await drawBoxText("CHECK PREFIX", boxes.vpl, 8, 6, true, rgb(0, 0, 0), "center", 1, false, "unsupported tracking prefix");
      }
      fillRect(boxes.trackingDivider, rgb(0, 0, 0));
      const destination = destinationBoxes(measure, row.city, row.province, preset, trackingDisplay.expandDestination);
      await drawBoxText(row.city, destination.city, usesArabicScript(row.city) ? 10.5 : 15, 7, true, rgb(0, 0, 0), "center", 0.95, true, "destination city");
      outline(destination.province, 1.2, 0.2, rgb(0, 0, 0));
      await drawBoxText(row.province, { ...destination.province, x: destination.province.x + 0.8 * scaleX, y: destination.province.y + 0.15 * scaleY, width: destination.province.width - 1.6 * scaleX, height: destination.province.height - 0.3 * scaleY }, 8.5, 6, true, rgb(1, 1, 1), "center", destination.province.height > 3.1 * scaleY ? 0.95 : 1, true, "destination province");

      outline(boxes.to, 1, 0.3);
      const tagBox = mapContentBox(boxes.toTag);
      const tagWidth = tagBox.width * mm;
      const tagHeight = tagBox.height * mm;
      pdfPage.drawSvgPath(`M 0 0 L ${tagWidth * 0.86} 0 L ${tagWidth} ${tagHeight / 2} L ${tagWidth * 0.86} ${tagHeight} L 0 ${tagHeight} Z`, { x: (xMm + tagBox.x) * mm, y: pageH - (yMm + tagBox.y) * mm, color: rgb(0.03, 0.03, 0.03) });
      await drawBoxText("To:", boxes.toTag, 12, 10, true, rgb(1, 1, 1), "center", 1, true, "To tag");
      const recipient = recipientBoxes(measure, row.name, preset);
      await drawBoxText(row.name, recipient.name, 12, 9, true, rgb(0, 0, 0), "left", 1, true, "receiver name");
      await drawBoxText(row.address, recipient.address, 11, 8, false, rgb(0, 0, 0), "left", 1.08, true, "address");
      await drawBoxText("Near by:", boxes.nearbyLabel, 9.5, 7.5, true, rgb(0, 0, 0), "left", 1, false, "Near by caption");
      await drawBoxText(row.landmark, boxes.landmark, 9.5, 7.5, false, rgb(0, 0, 0), "left", 1, true, "Near by value");
      outline(boxes.orderProduct, 0.8, 0.25);
      fillRect(boxes.contactDivider, rgb(0, 0, 0));
      const referenceHeading = { ...boxes.orderId, y: boxes.orderId.y + 0.1 * scaleY, height: 1.3 * scaleY };
      const referenceValue = { ...boxes.orderId, y: boxes.orderId.y + 1.35 * scaleY, height: boxes.orderId.height - 1.35 * scaleY };
      const contactHeading = { ...boxes.contact, y: boxes.contact.y + 0.1 * scaleY, height: 1.3 * scaleY };
      const contactValue = { ...boxes.contact, y: boxes.contact.y + 1.35 * scaleY, height: boxes.contact.height - 1.35 * scaleY };
      await drawBoxText("Order ID", referenceHeading, 6.3, 4.5, true, rgb(0, 0, 0), "left", 1, false, "Order ID caption");
      await drawBoxText(row.printedReference, referenceValue, 11, 8, false, rgb(0, 0, 0), "left", 1, false, "printed reference");
      await drawBoxText("Contact Number", contactHeading, 6.3, 4.5, true, rgb(0, 0, 0), "left", 1, false, "contact caption");
      await drawBoxText(normalizePakistaniPhone(row.phone)!, contactValue, 12, 9, true, rgb(0, 0, 0), "right", 1, false, "contact number");
      outline(boxes.product, 0, 0.2);
      await drawBoxText("Product:", boxes.productLabel, 7.5, 6.5, true, rgb(0, 0, 0), "left", 1, false, "Product caption");
      await drawBoxText(row.product, boxes.productValue, 10, 6.5, true, rgb(0, 0, 0), "left", 1, false, "product");
      fillRect({ ...boxes.footer, height: 0.2 }, rgb(0, 0, 0));
      await drawBoxText("From:", boxes.footerFrom, 9, 7, true, rgb(0, 0, 0), "left", 1, false, "From caption");
      await drawBoxText("Garden Shop", boxes.footerSender, 10, 7, true, colorAccent ? rgb(0.14, 0.38, 0.18) : rgb(0, 0, 0), "left", 1, false, "sender name");
      fillRect(boxes.footerDivider, rgb(0, 0, 0));
      await drawBoxText(LABEL_FOOTER_ADDRESS, boxes.footerAddress, 8, 6.5, false, rgb(0, 0, 0), "left", 1, false, "footer address");

      if (row.tracking) {
        const barcode = await renderBarcodeSvg(row.tracking);
        if (preset.id === "CUSTOM") {
          const canvasBarcode = document.createElement("canvas");
          await renderBarcode(canvasBarcode, row.tracking);
          const ink = barcodeCanvasInkBounds(canvasBarcode);
          const cssScale = Math.min(1, boxes.barcode.width * pxPerMm / canvasBarcode.width, boxes.barcode.height * pxPerMm / canvasBarcode.height);
          const canvasScaleMm = cssScale / pxPerMm;
          const moduleMm = CODE128_LAYOUT.moduleWidthPx * canvasScaleMm;
          if (moduleMm < CODE128_LAYOUT.minimumModuleMm) {
            if (!row.warnings.some((warning) => warning.startsWith("Tracking barcode is too dense"))) row.warnings.push("Tracking barcode is too dense for this label after the HP content inset; edit this tracking value.");
          } else {
            const imageWidthMm = canvasBarcode.width * canvasScaleMm;
            const imageHeightMm = canvasBarcode.height * canvasScaleMm;
            const imageLeft = boxes.barcode.x + (boxes.barcode.width - imageWidthMm) / 2;
            const imageTop = boxes.barcode.y + (boxes.barcode.height - imageHeightMm) / 2;
            const imageOrigin = transformLabelContentPoint({ x: imageLeft, y: imageTop }, safeTransform);
            const targetInkLeft = imageOrigin.x + ink.left * canvasScaleMm;
            const targetInkTop = imageOrigin.y + ink.top * canvasScaleMm;
            const targetInkWidth = (ink.right - ink.left) * canvasScaleMm;
            const targetInkHeight = (ink.bottom - ink.top) * canvasScaleMm;
            const svgLeft = Math.min(...barcode.bars.map((bar) => bar.x));
            const svgTop = Math.min(...barcode.bars.map((bar) => bar.y));
            const svgRight = Math.max(...barcode.bars.map((bar) => bar.x + bar.width));
            const svgBottom = Math.max(...barcode.bars.map((bar) => bar.y + bar.height));
            const scaleX = targetInkWidth * mm / (svgRight - svgLeft);
            const scaleY = targetInkHeight * mm / (svgBottom - svgTop);
            const left = (xMm + targetInkLeft) * mm - svgLeft * scaleX;
            const top = pageH - (yMm + targetInkTop) * mm + svgTop * scaleY;
            if (geometry.slot < 3) console.info("LP037_PDF_BARCODE_GEOMETRY", JSON.stringify({ slot: geometry.slot, canvasPx: [canvasBarcode.width, canvasBarcode.height], inkPx: ink, cssScale, canvasScaleMm, safeTransform, imageBoxMm: [imageLeft, imageTop, imageWidthMm, imageHeightMm], targetInkMm: [targetInkLeft, targetInkTop, targetInkWidth, targetInkHeight], svgInkPx: [svgLeft, svgTop, svgRight, svgBottom], vectorScalePtPerPx: [scaleX, scaleY], pdfOriginPt: [left, top] }));
            for (const bar of barcode.bars) {
              pdfPage.drawRectangle({ x: left + bar.x * scaleX, y: top - (bar.y + bar.height) * scaleY, width: bar.width * scaleX, height: bar.height * scaleY, color: rgb(0, 0, 0) });
            }
          }
          canvasBarcode.width = 0;
          canvasBarcode.height = 0;
        } else {
          const scale = Math.min(mm * boxes.barcode.width / barcode.width, mm * boxes.barcode.height / barcode.height);
          if (scale * barcode.moduleWidth * 25.4 / 72 < CODE128_LAYOUT.minimumModuleMm) {
            if (!row.warnings.some((warning) => warning.startsWith("Tracking barcode is too dense"))) row.warnings.push("Tracking barcode is too dense for this label; edit or use another layout.");
          } else {
          const barcodeWidth = barcode.width * scale;
          const barcodeHeight = barcode.height * scale;
            const barcodeOrigin = transformLabelContentPoint({
              x: boxes.barcode.x + (boxes.barcode.width - barcodeWidth / mm) / 2,
              y: boxes.barcode.y + (boxes.barcode.height - barcodeHeight / mm) / 2,
            }, safeTransform);
            const left = (xMm + barcodeOrigin.x) * mm;
            const top = pageH - (yMm + barcodeOrigin.y) * mm;
            for (const bar of barcode.bars) {
              pdfPage.drawRectangle({
                x: left + bar.x * scale,
                y: top - (bar.y + bar.height) * scale,
                width: bar.width * scale,
                height: bar.height * scale,
                color: rgb(0, 0, 0),
              });
            }
          }
        }
      }
    }
  }
  const renderingBlocker = items.map(({ row }) => printBlocker(row)).find(Boolean);
  if (renderingBlocker) throw new Error(`PDF_CONTENT_REQUIRES_REVIEW: ${renderingBlocker}`);
  const pdfBytes = await pdf.save();
  return new Blob(
    [
      pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      ) as ArrayBuffer,
    ],
    { type: "application/pdf" },
  );
}

async function verifyBarcode(canvas: HTMLCanvasElement, expected: string) {
  const {
    BarcodeFormat,
    BinaryBitmap,
    DecodeHintType,
    HTMLCanvasElementLuminanceSource,
    HybridBinarizer,
    MultiFormatReader,
  } = await import("@zxing/library");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BARCODE_CANVAS_UNAVAILABLE");
  const source = new HTMLCanvasElementLuminanceSource(canvas);
  const reader = new MultiFormatReader();
  reader.setHints(
    new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]),
  );
  const decoded = reader
    .decode(new BinaryBitmap(new HybridBinarizer(source)))
    .getText();
  if (decoded !== expected) throw new Error("BARCODE_VALUE_MISMATCH");
}

async function loadAdmin() {
  const root = document.querySelector<HTMLDivElement>("#adminReports");
  if (!root) return;
  if (!monitoringUrl) {
    root.innerHTML =
      '<div class="report-card error-card">Monitoring service is not configured for this local run.</div>';
    return;
  }
  try {
    const response = await fetch(`${monitoringUrl}/api/reports/summary`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? "Only Super Admin can view monitoring reports."
          : `Report unavailable (${response.status}).`,
      );
    const report = (await response.json()) as {
      today: number;
      week: number;
      month: number;
      printRequests: number;
      printConfirmed: number;
      reprints: number;
      errors: number;
      auditIntegrity: string;
      recent?: Array<Record<string, unknown>>;
      staff?: Array<Record<string, unknown>>;
    };
    root.innerHTML = `<div class="report-kpis">${[
      ["Today", report.today],
      ["This week", report.week],
      ["This month", report.month],
      ["Print requests (month)", report.printRequests],
      ["Staff confirmed (month)", report.printConfirmed],
      ["Reprints (month)", report.reprints],
      ["Warnings / errors (month)", report.errors],
    ]
      .map(
        ([label, count]) =>
          `<article class="report-card"><small>${label}</small><strong>${count}</strong></article>`,
      )
      .join(
        "",
      )}</div><p class="integrity ${report.auditIntegrity === "VERIFIED" ? "verified" : "integrity-error"}">Audit chain: ${esc(report.auditIntegrity)}</p><div class="report-columns"><article class="report-card"><h2>Recent batch activity</h2><div class="activity-list">${(report.recent ?? []).map((event: Record<string, unknown>) => `<div><span>${esc(event.eventType)} · ${esc(event.batchId)}</span><b>${esc(event.actor)}</b><time>${esc(new Date(String(event.createdAt)).toLocaleString())}</time><small>${esc(JSON.stringify(event.counts))}${event.errorCode ? ` · ${esc(event.errorCode)}` : ""}</small></div>`).join("") || "No recent activity."}</div></article><article class="report-card"><h2>Staff usage</h2><div class="activity-list">${(report.staff ?? []).map((actor: Record<string, unknown>) => `<div><span>${esc(actor.actor)}</span><b>${actor.labels} labels</b><small>${actor.batches} batches · ${actor.printRequests} print requests</small></div>`).join("") || "No activity yet."}</div></article></div><button class="button secondary" id="exportAudit">Export aggregate audit CSV</button>`;
    document.querySelector("#exportAudit")?.addEventListener("click", () => {
      void fetch(`${monitoringUrl}/api/reports/audit.csv`, {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("AUDIT_EXPORT_UNAVAILABLE");
          download(await response.blob(), "label-printer-audit-summary.csv");
        })
        .catch(() => {
          statusMessage = "Audit export could not be downloaded.";
        });
    });
  } catch (error) {
    root.innerHTML = `<div class="report-card error-card">${esc(error instanceof Error ? error.message : "Protected report unavailable")}</div>`;
  }
}

function bind() {
  bindMoMappingHandlers();
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((node) =>
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const target = (node as HTMLElement).dataset.view!;
      if (target === "preview" && !rows.length) return;
      if (target === "print" && !rows.length) return;
      if (target === "mo" && !rows.length) return;
      if (view === "mo" && target !== "mo") {
        moPdfAbort?.abort();
        moPdfAbort = undefined;
        moSenderCnicInput = "";
        moPdfState = Object.freeze({ exporting: false });
        moSessionMappings = new Map();
        moPendingMappings = new Map();
        moCleanPreview = false;
        moPendingLayoutSource = undefined;
        moEditorResizeObserver?.disconnect();
        moEditorResizeObserver = undefined;
      }
      if (target === "mo" && view !== "mo") {
        moSenderCnicInput = "";
        moSheetIndex = 0;
        moLayoutSampleSourceIndex = undefined;
        moBackRotation = "none";
        moPdfState = Object.freeze({ exporting: false });
        moSessionMappings = new Map();
        moPendingMappings = new Map();
        moCleanPreview = false;
        moCleanPreviewFace = "front";
        moPendingLayoutSource = undefined;
        moEditorZoom = 1;
      }
      view = target;
      render();
    }),
  );
  document.querySelector<HTMLInputElement>("#moSenderCnic")?.addEventListener("input", (event) => {
    moSenderCnicInput = (event.target as HTMLInputElement).value;
    const result = formatSenderCnic(moSenderCnicInput);
    const input = event.target as HTMLInputElement;
    input.setAttribute("aria-invalid", String(result.status === "invalid"));
    const error = document.querySelector<HTMLElement>("#moCnicError");
    if (error) error.textContent = result.status === "invalid" ? "Enter exactly 13 digits, optionally grouped 5-7-1, or clear the field." : "";
    if (result.status === "invalid") document.querySelector(".mo-face-list")?.remove();
  });
  document.querySelector<HTMLInputElement>("#moSenderCnic")?.addEventListener("change", () => render());
  document.querySelector("#moPrevSheet")?.addEventListener("click", () => {
    moSheetIndex = Math.max(0, moSheetIndex - 1);
    render();
  });
  document.querySelector("#moNextSheet")?.addEventListener("click", () => {
    const selectedIndexes = new Set(currentOrders().map(({ index }) => index));
    const projection = projectMoRecords(rows, { selectedSourceIndexes: selectedIndexes, requiredFields: [] });
    moSheetIndex = Math.min(Math.ceil(projection.candidates.length / 2) - 1, moSheetIndex + 1);
    render();
  });
  document.querySelector<HTMLSelectElement>("#moSheetSelect")?.addEventListener("change", (event) => {
    moSheetIndex = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector<HTMLSelectElement>("#moBackRotation")?.addEventListener("change", (event) => {
    moBackRotation = (event.target as HTMLSelectElement).value as MoBackPreviewRotation;
    render();
  });
  document.querySelector("#moLayoutSave")?.addEventListener("click", persistMoLayout);
  document.querySelector("#moLayoutReload")?.addEventListener("click", reloadMoLayout);
  document.querySelector("#moLayoutReset")?.addEventListener("click", resetMoLayoutSession);
  document.querySelector<HTMLSelectElement>("#moLayoutEditMode")?.addEventListener("change", (event) => {
    moLayoutEditMode = (event.target as HTMLSelectElement).value === "edit";
    render();
  });
  document.querySelector<HTMLSelectElement>("#moLayoutSampleRecord")?.addEventListener("change", (event) => {
    moLayoutSampleSourceIndex = Number((event.target as HTMLSelectElement).value);
    moSheetIndex = sampleSheetIndex(currentMoProjection(), moLayoutSampleSourceIndex);
    moSelectedLayoutFieldId = undefined;
    render();
  });
  document.querySelector<HTMLSelectElement>("#moLayoutBackRotation")?.addEventListener("change", (event) => {
    moBackRotation = (event.target as HTMLSelectElement).value as MoBackPreviewRotation;
    render();
  });
  document.querySelector<HTMLSelectElement>("#moPrintSideMode")?.addEventListener("change", (event) => {
    moPrintSideMode = (event.target as HTMLSelectElement).value as typeof moPrintSideMode;
    render();
  });
  const selectedLayoutField = document.querySelector<HTMLElement>("[data-mo-selected-layout-field]")?.dataset.moSelectedLayoutField;
  document.querySelector<HTMLSelectElement>("#moLayoutSource")?.addEventListener("change", (event) => applyLayoutProperty(selectedLayoutField ?? "", "source", (event.target as HTMLSelectElement).value));
  document.querySelectorAll<HTMLInputElement>("#moLayoutX,#moLayoutY,#moLayoutWidth,#moLayoutHeight,#moLayoutFontSize").forEach((input) => {
    input.addEventListener("change", () => applyLayoutProperty(selectedLayoutField ?? "", input.id === "moLayoutX" ? "xMm" : input.id === "moLayoutY" ? "yMm" : input.id === "moLayoutWidth" ? "widthMm" : input.id === "moLayoutHeight" ? "heightMm" : "fontSizePt", input.value));
  });
  document.querySelector<HTMLSelectElement>("#moLayoutAlignment")?.addEventListener("change", (event) => applyLayoutProperty(selectedLayoutField ?? "", "alignment", (event.target as HTMLSelectElement).value));
  document.querySelector<HTMLInputElement>("#moLayoutWrap")?.addEventListener("change", (event) => applyLayoutProperty(selectedLayoutField ?? "", "wrap", (event.target as HTMLInputElement).checked));
  document.querySelector("#moLayoutRemoveField")?.addEventListener("click", () => {
    if (!selectedLayoutField) return;
    replaceMoLayout(removeMoLayoutField(moLayout, selectedLayoutField));
    moSelectedLayoutFieldId = undefined;
  });
  document.querySelectorAll<HTMLElement>("[data-mo-layout-source]").forEach((chip) => chip.addEventListener("dragstart", (event) => {
    const transfer = (event as DragEvent).dataTransfer;
    if (!transfer) return;
    if (chip.classList.contains("mo-source-chip")) moLastSourceDragAt = performance.now();
    transfer.effectAllowed = "copy";
    transfer.setData("application/x-mo-layout-source", chip.dataset.moLayoutSource ?? "");
  }));
  document.querySelectorAll<HTMLElement>("[data-mo-editor-overlay]").forEach((overlay) => {
    overlay.addEventListener("dragover", (event) => {
      if (moLayoutEditMode) event.preventDefault();
    });
    overlay.addEventListener("drop", (event) => handleMoLayoutDrop(overlay, event as DragEvent));
  });
  document.querySelectorAll<HTMLElement>(".mo-editor-field[data-mo-layout-id]").forEach((fieldBox) => {
    fieldBox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event.target as HTMLElement).closest("[data-mo-resize-handle]")) return;
      moPendingLayoutSource = undefined;
      moSelectedLayoutFieldId = fieldBox.dataset.moLayoutId;
      render();
    });
    fieldBox.addEventListener("pointerdown", (event) => {
      if (!moLayoutEditMode || event.button !== 0) return;
      const id = fieldBox.dataset.moLayoutId;
      const field = moLayout.fields.find((item) => item.id === id);
      if (!id || !field) return;
      if (field.source === "senderCnic") return;
      const handle = Boolean((event.target as HTMLElement).closest("[data-mo-resize-handle]"));
      const overlay = document.querySelector<HTMLElement>(`[data-mo-editor-overlay="${field.face}"]`);
      const rect = overlay?.getBoundingClientRect();
      if (!rect?.width || !rect.height) return;
      event.preventDefault();
      event.stopPropagation();
      moPendingLayoutSource = undefined;
      moSelectedLayoutFieldId = id;
      const slot = Number(fieldBox.dataset.moLayoutSlot) || 0;
      const pointerXmm = (event.clientX - rect.left) * 297 / rect.width - slot * 148.5;
      const pointerYmm = (event.clientY - rect.top) * 210 / rect.height;
      fieldBox.setPointerCapture(event.pointerId);
      moLayoutPointer = Object.freeze({ id, face: field.face, slot, mode: handle ? "resize" : "move", startX: event.clientX, startY: event.clientY, grabXmm: pointerXmm - field.xMm, grabYmm: pointerYmm - field.yMm, field });
    });
    fieldBox.addEventListener("pointermove", (event) => {
      if (moLayoutPointer?.id === fieldBox.dataset.moLayoutId) updateMoLayoutPointer(event);
    });
    const finishPointer = () => {
      if (!moLayoutPointer || moLayoutPointer.id !== fieldBox.dataset.moLayoutId) return;
      moLayoutPointer = undefined;
      render();
    };
    fieldBox.addEventListener("pointerup", finishPointer);
    fieldBox.addEventListener("pointercancel", finishPointer);
  });
  document.querySelector("#downloadMoPdf")?.addEventListener("click", () => void downloadMoPdf());
  document.querySelector("#downloadMoLayoutPdf")?.addEventListener("click", () => void runMoLayoutOutput(false));
  document.querySelector("#printMoBatch")?.addEventListener("click", () => void runMoLayoutOutput(true));
  document.querySelector("#cancelMoPdf")?.addEventListener("click", () => {
    moPdfAbort?.abort();
    moPrintWindow?.close();
    moPrintWindow = null;
    const status = document.querySelector<HTMLElement>("#moPdfStatus");
    if (status) status.textContent = "Cancelling export…";
  });
  document.querySelector("#downloadMoDraftPdf")?.addEventListener("click", () => void downloadMoPdf(true));
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>("#moFrontPreview,#moBackPreview,#moLayoutFrontPreview,#moLayoutBackPreview"))) {
    frame.addEventListener("load", validateMoPreviewFit);
  }
  document
    .querySelector<HTMLInputElement>("#workbook")
    ?.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        await parseFile(file);
      } catch (error) {
        statusMessage =
          error instanceof Error ? error.message : "IMPORT_FAILED";
      await logEvent("APP_ERROR", {}, /^[A-Z0-9_]{1,64}$/.test(statusMessage) ? statusMessage : "IMPORT_FAILED");
        render();
      }
    });
  document.querySelector("#template")?.addEventListener("click", templateCsv);
  document.querySelector("#sample")?.addEventListener("click", async () => {
    headers = sampleHeaders;
    rawRows = sampleRows;
    importedFileName = "synthetic-sample.csv";
    batchId = crypto.randomUUID();
    mapping = detectMapping(headers);
    view = "mapping";
    statusMessage = "Synthetic sample data only.";
    await logEvent("FILE_PROCESSED", { rows: rawRows.length });
    render();
  });
  document.querySelectorAll("[data-map]").forEach((node) => {
    const select = node as HTMLSelectElement;
    select.addEventListener("change", () => {
      mapping[select.dataset.map as keyof ImportMapping] = select.value;
    });
  });
  document
    .querySelector("#applyMapping")
    ?.addEventListener("click", async () => {
      const save =
        document.querySelector<HTMLInputElement>("#savePreset")?.checked;
      if (save)
        localStorage.setItem("gfs-label-mapping-v1", JSON.stringify(mapping));
      rows = normalizeRows(
        headers,
        rawRows,
        mapping,
        importedFileName.toLowerCase().endsWith(".csv"),
        workbookDate1904,
      );
      await reserveRowReferences(rows);
      selected.clear();
      rows.forEach((_, i) => selected.add(i));
      view = "review";
      page = 0;
      activeLabel = rows.findIndex((row) => row.tracking);
      const failed = rows.filter((row) => printBlocker(row)).length;
      await logEvent("LABELS_GENERATED", {
        labels: rows.length - failed,
        warnings: rows.filter((row) => row.warnings.length).length,
        failed,
      });
      render();
    });
  document
    .querySelector<HTMLInputElement>("#rowSearch")
    ?.addEventListener("input", (event) => {
      const cursor = (event.target as HTMLInputElement).selectionStart;
      render();
      const input = document.querySelector<HTMLInputElement>("#rowSearch");
      input?.focus();
      input?.setSelectionRange(cursor, cursor);
    });
  document
    .querySelectorAll<HTMLInputElement>("[data-select]")
    .forEach((input) =>
      input.addEventListener("change", () => {
        const index = Number(input.dataset.select);
        input.checked ? selected.add(index) : selected.delete(index);
        render();
      }),
    );
  document.querySelector("#selectAll")?.addEventListener("click", () => {
    if (selected.size === rows.length) selected.clear();
    else rows.forEach((_, i) => selected.add(i));
    render();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-edit]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        editOrder(Number(button.dataset.edit)),
      ),
    );
  document.querySelector("#newBatch")?.addEventListener("click", () => {
    moPdfAbort?.abort();
    moPdfAbort = undefined;
    rows = [];
    rawRows = [];
    headers = [];
    moSenderCnicInput = "";
    moSheetIndex = 0;
    moBackRotation = "none";
    moLayoutSampleSourceIndex = undefined;
    moSelectedLayoutFieldId = undefined;
    moPendingLayoutSource = undefined;
    moCleanPreview = false;
    moCleanPreviewFace = "front";
    moEditorZoom = 1;
    moPdfState = Object.freeze({ exporting: false });
    moSessionMappings = new Map();
    moPendingMappings = new Map();
    selected.clear();
    countLimit = -1;
    printRequested = false;
    view = "upload";
    statusMessage = "Workbook data stays in this browser tab.";
    render();
  });
  document.querySelector("#zoomOut")?.addEventListener("click", () => {
    zoom = Math.max(0.5, zoom - 0.1);
    render();
  });
  document.querySelector("#zoomIn")?.addEventListener("click", () => {
    zoom = Math.min(1.5, zoom + 0.1);
    render();
  });
  document.querySelector("#prevPage")?.addEventListener("click", () => {
    page = Math.max(0, page - 1);
    render();
  });
  document.querySelector("#nextPage")?.addEventListener("click", () => {
    page += 1;
    render();
  });
  document
    .querySelector("#startPosition")
    ?.addEventListener("change", (event) => {
      startPosition = Number((event.target as HTMLSelectElement).value);
      page = 0;
      render();
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-focus-label]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        activeLabel = Number(button.dataset.focusLabel);
        render();
      }),
    );
  document.querySelector("#printStart")?.addEventListener("change", (event) => {
    startPosition = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector("#paperPreset")?.addEventListener("change", (event) => {
    paperPresetId = (event.target as HTMLSelectElement).value as PaperPresetId;
    page = 0;
    render();
  });
  document.querySelector("#hpP2055SafeArea")?.addEventListener("change", (event) => {
    hpP2055SafeArea = (event.target as HTMLInputElement).checked;
    render();
  });
  document.querySelector("#countLimit")?.addEventListener("change", (event) => {
    countLimit = Number((event.target as HTMLInputElement).value);
    render();
  });
  document.querySelector("#colorAccent")?.addEventListener("change", (event) => {
    colorAccent = (event.target as HTMLInputElement).checked;
    render();
  });
  document.querySelector("#printNow")?.addEventListener("click", async () => {
    const selectedItems = currentOrders();
    const items = selectedItems.filter(({ row }) => !printBlocker(row));
    if (!items.length) {
      statusMessage = selectedItems.length
        ? "No selected labels are currently printable; correct or exclude the flagged rows."
        : "Select at least one label before printing.";
      render();
      return;
    }
    const popup = openPrintPopup(items, startPosition);
    if (!popup) {
      statusMessage = "Allow pop-ups to print.";
      render();
      return;
    }
  });
  document.querySelector("#savePdf")?.addEventListener("click", async () => {
    try {
      const selectedItems = currentOrders();
      const items = selectedItems.filter(({ row }) => !printBlocker(row));
      if (!items.length) {
        statusMessage = selectedItems.length
          ? "No selected labels are currently printable; correct or exclude the flagged rows."
          : "Select at least one label before exporting.";
        render();
        return;
      }
      const blob = await makePdf(items);
      download(blob, `garden-shop-labels-${batchId.slice(0, 8)}.pdf`);
      await logEvent("PDF_GENERATED", {
        labels: items.length,
        pages: pagesForCount(items.length, startPosition),
      });
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "PDF generation failed. The editable batch remains available.";
      await logEvent("APP_ERROR", {}, "PDF_GENERATION_FAILED");
      render();
    }
  });
  document.querySelector("#printOne")?.addEventListener("click", async () => {
    if (activeLabel < 0) return;
    const order = rows[activeLabel];
    if (printBlocker(order)) {
      statusMessage = "Resolve the flagged required field, barcode, or layout issue before printing.";
      render();
      return;
    }
    const popup = openPrintPopup([{ row: order, index: activeLabel }], startPosition);
    if (!popup) {
      statusMessage = "Allow pop-ups to print.";
      render();
      return;
    }
  });
  document
    .querySelector("#confirmPrinted")
    ?.addEventListener("change", async (event) => {
      if ((event.target as HTMLInputElement).checked) {
        await logEvent("PRINT_CONFIRMED", { labels: currentOrders().length });
        statusMessage =
          "Staff-confirmed print completion recorded. This is not printer telemetry.";
        render();
      }
    });
  document
    .querySelector("#refreshAdmin")
    ?.addEventListener("click", () => void loadAdmin());
  bindMoEditorUi();
}

function editOrder(index: number) {
  const order = rows[index];
  const fields: Array<[keyof Order, string]> = [
    ["serial", "Sr. no"],
    ["orderId", "Order ID"],
    ["orderDate", "MO-51 Month Stamp (DD-MM-YY)"],
    ["name", "Receiver name"],
    ["email", "Email"],
    ["phone", "Contact number (text)"],
    ["address", "Full address"],
    ["facebookName", "Facebook Name"],
    ["tracking", "Tracking number"],
    ["product", "Product"],
    ["cod", "Declared amount (VPL/VPP only)"],
    ["city", "City"],
    ["province", "Province"],
    ["landmark", "Near by"],
    ["senderName", "Sender name"],
    ["senderAddress", "Sender address"],
  ];
  const form = document.createElement("form");
  form.className = "edit-form";
  form.innerHTML = `<dialog open><h2>Edit label details</h2><p>Edits stay local and are not sent to monitoring.</p>${order.sourceAddress !== order.address ? `<p class="source-note">The original imported address is retained for correction; only the print copy is normalized.</p><button class="button secondary" type="button" id="restoreSourceAddress">Restore imported source address</button>` : ""}${fields.map(([key, label]) => key === "address" ? `<label>${esc(label)}<textarea name="address" rows="3">${esc(order.address)}</textarea></label>` : `<label>${esc(label)}<input name="${key}" value="${esc(order[key])}" ${key === "phone" ? 'inputmode="tel"' : ""}></label>`).join("")}<div class="button-row"><button class="button secondary" type="button" data-cancel>Cancel</button><button class="button primary">Save changes</button></div></dialog>`;
  app.append(form);
  form
    .querySelector("[data-cancel]")
    ?.addEventListener("click", () => form.remove());
  form.querySelector("#restoreSourceAddress")?.addEventListener("click", () => {
    const address = form.querySelector<HTMLTextAreaElement | HTMLInputElement>('[name="address"]');
    if (address) address.value = order.sourceAddress;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const previousAddress = order.address;
    const data = new FormData(form);
    const nextOrderId = String(data.get("orderId") ?? "");
    const nextTracking = String(data.get("tracking") ?? "");
    try {
      if (!order.printedReference && nextTracking.trim()) {
        order.printedReference = await reserveLabelReference(nextOrderId, nextTracking);
      } else if (order.printedReference && nextTracking.trim() &&
        (nextOrderId !== order.orderId || nextTracking !== order.tracking)) {
        await updateLabelReferenceSource(order.printedReference, nextOrderId, nextTracking);
      }
    } catch {
      const dialog = form.querySelector("dialog");
      dialog?.querySelector(".reference-edit-error")?.remove();
      dialog?.insertAdjacentHTML("afterbegin", '<p class="mapping-warning reference-edit-error" role="alert">The printed reference could not be safely reserved or remapped. Keep the current value and correct the source fields.</p>');
      return;
    }
    for (const [key] of fields)
      order[key] = String(data.get(key) ?? "") as never;
    const enteredAddress = String(data.get("address") ?? "");
    if (enteredAddress !== previousAddress) order.sourceAddress = enteredAddress;
    order.address = normalizeAddressText(enteredAddress);
    const repeatedContact = safeContactRemoval(order.address, order.phone);
    if (repeatedContact.removed) order.address = repeatedContact.address;
    const normalizedPhone = normalizePakistaniPhone(order.phone);
    if (normalizedPhone) order.phone = normalizedPhone;
    order.warnings = order.warnings.filter(
      (warning) =>
        !warning.startsWith("Duplicate") &&
        !warning.startsWith("Exact contact match") &&
        !warning.startsWith("Phone cell was numeric") &&
        !warning.startsWith("Contact number is invalid") &&
        !warning.startsWith("Receiver name") &&
        !warning.startsWith("Contact number") &&
        !warning.startsWith("Delivery address") &&
        !warning.startsWith("Tracking number") &&
        !warning.startsWith("Source Order ID") &&
        !warning.startsWith("Printed reference") &&
        !warning.startsWith("VPL amount") &&
        !warning.startsWith("Declared VPL amount") &&
        !warning.startsWith("Declared VPP amount") &&
        !warning.startsWith("Unsupported tracking prefix") &&
        !warning.startsWith("Product description") &&
        !warning.startsWith("Destination city or province") &&
        !warning.startsWith("Text does not fit") &&
        !warning.startsWith("Tracking barcode is too dense") &&
        !warning.startsWith("Generated barcode"),
    );
    if (!order.name) order.warnings.push("Receiver name is required.");
    if (!order.orderId.trim()) order.warnings.push("Source Order ID is missing; the printed reference is local-only.");
    if (!order.printedReference) order.warnings.push("Printed reference has not been reserved in this browser.");
    if (!order.phone) order.warnings.push("Contact number is missing.");
    else if (!normalizedPhone) order.warnings.push("Contact number is invalid; enter a Pakistani mobile number with 11 digits.");
    if (repeatedContact.removed)
      order.warnings.push("Exact contact match removed from displayed address; original source is retained in the editor.");
    if (!order.address) order.warnings.push("Delivery address is required.");
    if (!order.product) order.warnings.push("Product description is required.");
    if (!order.tracking)
      order.warnings.push(
        "Tracking number is missing; barcode cannot be generated.",
      );
    else {
      const display = trackingLabelDisplay(order.tracking, order.cod);
      if (display.error) order.warnings.push(display.error);
    }
    if (!order.city || !order.province) order.warnings.push("Destination city or province is missing; confirm before printing.");
    if (repeatedContact.removed)
      order.warnings.push(
        "Exact contact match removed from displayed address; original source is available in the editor.",
      );
    for (const row of rows)
      row.warnings = row.warnings.filter(
        (warning) => !warning.startsWith("Duplicate"),
      );
    const duplicates = (
      field: "phone" | "tracking",
      normalize: (value: string) => string,
    ) => {
      const groups = new Map<string, Order[]>();
      rows.forEach((item) => {
        const normalized = normalize(item[field]);
        if (normalized)
          groups.set(normalized, [...(groups.get(normalized) ?? []), item]);
      });
      for (const group of groups.values())
        if (group.length > 1)
          group.forEach((item) =>
            item.warnings.push(
              `Duplicate ${field === "phone" ? "contact number" : "tracking number"}.`,
            ),
          );
    };
    duplicates("phone", (value) => value.replace(/\D/g, ""));
    duplicates("tracking", normalizeTrackingReference);
    form.remove();
    render();
  });
}

render();

declare global {
  interface ImportMetaEnv {
    readonly VITE_MONITOR_URL?: string;
    readonly VITE_ADMIN_URL?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
