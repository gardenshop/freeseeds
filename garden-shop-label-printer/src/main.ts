import {
  FIELDS,
  type AuditEvent,
  type ImportMapping,
  type Order,
} from "./types";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-700.css";
import {
  A4_POINTS,
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
import { CODE128_LAYOUT, destinationBoxes, fitTextMm, fitTextPx, formatVpl, labelBoxes, labelFontFamily, LABEL_FOOTER_ADDRESS, recipientBoxes, usesArabicScript, usesComplexScript } from "./layout";
import { restoreZeroFormattedCells } from "./xlsx";

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
    "TRK000001",
    "1250",
    "Garden Seed Mix",
    "Sahiwal",
    "Punjab",
    "Clock Tower",
  ],
  [
    "",
    "Zara Example",
    "03001234568",
    "Street 8, Satellite Town",
    "",
    "TRK000002",
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
    "TRK000003",
    "1800",
    "Tomato Seeds x 4",
    "Okara",
    "Punjab",
    "Main bazaar",
  ],
];
let headers: string[] = [];
let rawRows: unknown[][] = [];
let rows: Order[] = [];
let mapping: ImportMapping = detectMapping([]);
let batchId = crypto.randomUUID();
let view = "upload";
let selected = new Set<number>();
let page = 0;
let zoom = 1;
let startPosition = 1;
let countLimit = -1;
let activeLabel = -1;
let importedFileName = "";
let printRequested = false;
let statusMessage = "Workbook data stays in this browser tab.";

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

function currentOrders(): Array<{ row: Order; index: number }> {
  const ids = [...selected];
  const chosen = ids
    .map((index) => ({ row: rows[index], index }))
    .filter((item) => item.row);
  return countLimit >= 0 ? chosen.slice(0, countLimit) : chosen;
}

function nav() {
  return `<header class="topbar"><a class="brand" href="#upload" data-view="upload"><span class="brand-mark">GS</span><span><b>Garden Shop</b><small>LABEL STUDIO / INTERNAL</small></span></a><a class="admin-return" id="backToAdmin" href="${esc(adminUrl)}" rel="noopener noreferrer">← Back to Admin</a><nav aria-label="Main navigation">${[
    ["upload", "Import"],
    ["review", "Review"],
    ["preview", "Sheet preview"],
    ["print", "Print & export"],
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
  return `<section class="section-heading"><div><p class="kicker">DISPATCH / DATA REVIEW</p><h1>Review every parcel.</h1><p>${rows.length} imported · ${rows.filter((row) => row.warnings.length).length} flagged · ${rows.length - selected.size} available to select</p></div><button class="button secondary" id="newBatch">Start another batch</button></section><div class="toolbar"><label class="search">⌕ <input id="rowSearch" type="search" placeholder="Search name, city, product…" value="${esc(q)}"></label><button class="button ghost" id="selectAll">${selected.size === rows.length ? "Clear selection" : "Select all"}</button><span class="selection-count">${selected.size} selected</span></div><div class="table-wrap"><table><thead><tr><th></th><th>ORDER / NAME</th><th>CITY</th><th>TRACKING</th><th>PRODUCT</th><th>COD</th><th>VALIDATION</th></tr></thead><tbody>${filtered.map(({ row, index }) => `<tr><td><input type="checkbox" data-select="${index}" ${selected.has(index) ? "checked" : ""} aria-label="Select row ${index + 1}"></td><td><button class="row-edit" data-edit="${index}"><b>${esc(row.orderId || "No Order ID")}</b><span>${esc(row.name || "Unnamed receiver")}</span></button></td><td>${esc([row.city, row.province].filter(Boolean).join(", ") || "—")}</td><td>${esc(row.tracking || "—")}</td><td>${esc(row.product || "—")}</td><td>${esc(row.cod || "—")}</td><td>${row.warnings.length ? `<span class="warning-badge" title="${esc(row.warnings.join("; "))}">${row.warnings.length} check${row.warnings.length > 1 ? "s" : ""}</span>` : '<span class="ok-badge">Ready</span>'}</td></tr>`).join("") || '<tr><td colspan="7" class="empty-row">No matching orders.</td></tr>'}</tbody></table></div><div class="button-row end"><button class="button primary" data-view="preview">Open A4 preview <span>→</span></button></div><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function boxStyle(box: { x: number; y: number; width: number; height: number }) {
  return `style="--box-x:${box.x}mm;--box-y:${box.y}mm;--box-width:${box.width}mm;--box-height:${box.height}mm"`;
}

function labelMarkup(row: Order, index: number, _compact = false) {
  const boxes = labelBoxes();
  const phone = normalizePakistaniPhone(row.phone);
  const vpl = row.cod.trim() ? formatVpl(row.cod) : "VPL";
  const vplAmount = vpl.replace(/^VPL\s*/u, "");
  return `<article class="label" data-label-index="${index}">
    <div class="order-product-frame layout-box" ${boxStyle(boxes.orderProduct)} aria-hidden="true"></div>
    <div class="order-id layout-box" ${boxStyle(boxes.orderId)}><span class="field-heading">Order ID</span><strong>${esc(row.orderId)}</strong></div>
    <div class="product-text layout-box" ${boxStyle(boxes.product)}><span class="field-heading">Product</span><strong>${esc(row.product)}</strong></div>
    <div class="vpl-box layout-box" ${boxStyle(boxes.vpl)} aria-label="${esc(vpl)}"><span class="vpl-prefix">VPL</span><strong class="vpl-amount">${esc(vplAmount)}</strong></div>
    <span class="tracking-caption layout-box" ${boxStyle(boxes.trackingCaption)}>TRACKING NUMBER</span>
    <strong class="tracking-text layout-box" ${boxStyle(boxes.tracking)}>${esc(row.tracking)}</strong>
    <canvas class="barcode-canvas layout-box" ${boxStyle(boxes.barcode)} data-barcode="${index}" aria-label="Code 128 tracking ${esc(row.tracking)}"></canvas>
    <span class="tracking-divider layout-box" ${boxStyle(boxes.trackingDivider)} aria-hidden="true"></span>
    <div class="destination layout-box" ${boxStyle(boxes.destination)}><strong class="city-text">${esc(row.city)}</strong><span class="province-text">${esc(row.province)}</span></div>
    <div class="to-border layout-box" ${boxStyle(boxes.to)} aria-hidden="true"></div>
    <b class="to-heading layout-box" ${boxStyle(boxes.toTag)}>To:</b>
    <strong class="receiver-name layout-box" ${boxStyle(boxes.name)}>${esc(row.name)}</strong>
    <div class="address-text layout-box" ${boxStyle(boxes.address)}>${esc(row.address)}</div>
    <strong class="nearby-label layout-box" ${boxStyle(boxes.nearbyLabel)}>Near by:</strong>
    <div class="landmark layout-box" ${boxStyle(boxes.landmark)}>${esc(row.landmark)}</div>
    <span class="contact-divider layout-box" ${boxStyle(boxes.contactDivider)} aria-hidden="true"></span>
    <div class="contact layout-box" ${boxStyle(boxes.contact)}>${phone ? `<strong class="phone-number">${esc(phone)}</strong>` : ""}</div>
    <div class="footer-rule layout-box" ${boxStyle(boxes.footer)} aria-hidden="true"></div>
    <strong class="footer-from layout-box" ${boxStyle(boxes.footerFrom)}>From:</strong>
    <b class="footer-sender layout-box" ${boxStyle(boxes.footerSender)}>${esc(row.senderName || "Garden Shop")}</b>
    <span class="footer-divider layout-box" ${boxStyle(boxes.footerDivider)} aria-hidden="true"></span>
    <span class="footer-address layout-box" ${boxStyle(boxes.footerAddress)}>${LABEL_FOOTER_ADDRESS}</span>
  </article>`;
}

function hasLayoutOverflow(row: Order): boolean {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return true;
  const boxes = labelBoxes();
  const recipient = recipientBoxes(context, row.name);
  const destination = destinationBoxes(context, row.city, row.province);
  const check = (text: string, box: { width: number; height: number }, max: number, min: number, bold = false, wrap = true) =>
    !text.trim() || fitTextMm(context, text, box.width, box.height, max, min, bold, 1.08, wrap).fits;
  return ![
    check(row.orderId, boxes.orderId, 9, 6.5, true, false),
    check(row.product, boxes.product, 8.5, 6.5, true),
    check(row.cod ? formatVpl(row.cod).replace(/^VPL\s*/u, "") : "", { width: boxes.vpl.width - 5.45, height: boxes.vpl.height - 0.5 }, 16, 9.5, true, false),
    check(row.tracking, boxes.tracking, 10, 8, true, false),
    check(row.city, destination.city, 13, 9, true),
    check(row.province, destination.province, 8.5, 6.5, true),
    check(row.name, recipient.name, 12, 9, true),
    check(row.address, recipient.address, 11, 8),
    check(row.landmark, boxes.landmark, 9.5, 7.5),
    check(normalizePakistaniPhone(row.phone) ?? "", boxes.contact, 11, 9, true, false),
    check("From:", boxes.footerFrom, 9, 7, true, false),
    check("Garden Shop", boxes.footerSender, 10, 6.5, true, false),
    check(LABEL_FOOTER_ADDRESS, boxes.footerAddress, 8, 6.5, false, false),
  ].every(Boolean);
}

function printBlocker(row: Order): string | undefined {
  if (!row.name) return "Receiver name is required.";
  if (!normalizePakistaniPhone(row.phone)) return "Correct invalid contact numbers before printing.";
  if (!row.address) return "Delivery address is required.";
  if (!row.tracking) return "Tracking number is required for the barcode.";
  if (!row.city || !row.province) return "Destination city and province are required.";
  if (hasLayoutOverflow(row)) return "Correct text that cannot fit at the readable minimum.";
  if (row.warnings.some((warning) => /^(Text does not fit|Tracking barcode is too dense|Generated barcode)/u.test(warning)))
    return "Correct the flagged layout or barcode before printing.";
  return undefined;
}

function renderPreview() {
  const chosen = currentOrders();
  const pages = Math.max(1, pagesForCount(chosen.length, startPosition));
  const currentPage = Math.min(page, pages - 1);
  page = currentPage;
  const pageItems = Array.from({ length: 18 }, (_, slot) => {
    const orderIndex = currentPage * 18 + slot - (startPosition - 1);
    return orderIndex >= 0 && chosen[orderIndex]
      ? labelMarkup(chosen[orderIndex].row, chosen[orderIndex].index)
      : '<div class="empty-label" aria-hidden="true"></div>';
  });
  const row = activeLabel >= 0 ? rows[activeLabel] : undefined;
  return `<section class="section-heading"><div><p class="kicker">LAYOUT / A4 PORTRAIT</p><h1>Sheet preview.</h1><p>65 × 44 mm labels · 3 columns × 6 rows · monochrome</p></div><div class="preview-controls"><button class="button secondary" id="zoomOut" aria-label="Zoom out">−</button><span>${Math.round(zoom * 100)}%</span><button class="button secondary" id="zoomIn" aria-label="Zoom in">+</button></div></section><div class="preview-layout"><div class="sheet-scroller"><div class="sheet" style="--zoom:${zoom}">${pageItems.join("")}</div></div><aside class="preview-aside"><span class="kicker">BATCH SHEET</span><strong>${chosen.length} <small>labels</small></strong><div class="page-nav"><button id="prevPage" ${currentPage <= 0 ? "disabled" : ""}>←</button><span>Page ${currentPage + 1} / ${pages}</span><button id="nextPage" ${currentPage >= pages - 1 ? "disabled" : ""}>→</button></div><label>Start at position<select id="startPosition">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${startPosition === i + 1 ? "selected" : ""}>Label ${i + 1}</option>`).join("")}</select></label>${row ? `<div class="individual-preview"><span class="kicker">INDIVIDUAL LABEL · ROW ${row.rowNumber}</span>${labelMarkup(row, activeLabel, true)}</div>` : '<p class="micro">Click an order below or in Review to inspect its label.</p>'}<button class="button primary full" data-view="print">Continue to print <span>→</span></button></aside></div><div class="preview-selection">${chosen
    .slice(currentPage * 18, currentPage * 18 + 18)
    .map(
      ({ row, index }) =>
        `<button data-focus-label="${index}" class="preview-chip ${activeLabel === index ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span>${esc(row.name || "Unnamed")}</button>`,
    )
    .join(
      "",
    )}</div><p class="status-line" role="status">${esc(statusMessage)}</p>`.replace("monochrome", "black print · Garden Shop green accent");
}

function renderPrint() {
  const chosen = currentOrders();
  const pages = pagesForCount(chosen.length, startPosition);
  const blocked = chosen.some(({ row }) => printBlocker(row));
  return `<section class="section-heading"><div><p class="kicker">OUTPUT / ACTUAL SIZE</p><h1>Ready for the printer.</h1><p>${chosen.length} labels · ${pages} A4 page${pages === 1 ? "" : "s"} · unused slots stay blank</p></div><div class="output-badge">100%<small>PHYSICAL SCALE</small></div></section>
    <section class="print-panel"><div class="print-summary"><h2>Print setup</h2><p>Use A4 portrait and Actual size / 100% in the printer dialog. Turn off browser headers and footers.</p>
    ${blocked ? '<p class="mapping-warning" role="alert">Resolve every flagged required field, barcode, or layout overflow before printing or exporting.</p>' : ""}
    <label>Start at position<select id="printStart">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${startPosition === i + 1 ? "selected" : ""}>Label ${i + 1}</option>`).join("")}</select></label>
    <label>Number of labels<input id="countLimit" type="number" min="0" max="${chosen.length}" value="${countLimit || chosen.length}" aria-describedby="countHelp"></label><small id="countHelp">Set to ${chosen.length} to print the full selection.</small>
    <div class="print-actions"><button class="button primary" id="printNow" ${blocked ? "disabled" : ""}>Print ${chosen.length} labels</button><button class="button secondary" id="savePdf" ${blocked ? "disabled" : ""}>Download PDF</button><button class="button ghost" id="printOne" ${activeLabel < 0 || !rows[activeLabel] || printBlocker(rows[activeLabel]) ? "disabled" : ""}>Print individual</button></div>
    <label class="confirm-print"><input id="confirmPrinted" type="checkbox"> I confirm the print job completed on the printer.</label></div>
    <div class="print-notice"><b>Print requests are not print proof.</b><p>Browser print is logged as a request. Only the separate confirmation above records staff-confirmed completion; neither signal comes from printer telemetry.</p><p>Check one test sheet with a ruler before using pre-cut stock. Physical dimensions depend on printer and driver.</p></div></section><p class="status-line" role="status">${esc(statusMessage)}</p>`;
}

function renderAdmin() {
  return `<section class="section-heading"><div><p class="kicker">RESTRICTED / SUPER ADMIN</p><h1>Operational activity.</h1><p>Reports are provided by the separately authenticated monitoring Worker. This page does not grant access by itself.</p></div><button class="button secondary" id="refreshAdmin">Refresh report</button></section><div id="adminReports" class="admin-reports"><div class="report-card">Loading protected report…</div></div><p class="status-line" role="status">${esc(statusMessage)}</p>`;
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
              : renderAdmin();
  app.innerHTML = `${nav()}<main class="main">${body}</main><footer class="app-footer"><span>GARDEN SHOP LABEL PRINTER <i>·</i> TEMPLATE ${TEMPLATE_VERSION}</span><span>INDEPENDENT TOOL / NO ORDER SYSTEM CONNECTION</span></footer>`;
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
  const box = labelBoxes().barcode;
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

function measureLabels(root: ParentNode = document, canvasDocument: Document = document) {
  const context = canvasDocument.createElement("canvas").getContext("2d");
  if (!context) return;
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
      const recipient = recipientBoxes(context, row?.name ?? "");
      setBox(".receiver-name", recipient.name);
      setBox(".address-text", recipient.address);
      const destination = destinationBoxes(context, row?.city ?? "", row?.province ?? "");
      const destinationElement = label.querySelector<HTMLElement>(".destination");
      destinationElement?.style.setProperty("--city-row-height", `${destination.city.height}mm`);
      destinationElement?.style.setProperty("--province-row-height", `${destination.province.height}mm`);
      destinationElement?.classList.toggle("long-province", destination.province.height > 3.1);
      destinationElement?.classList.toggle("short-province", destination.province.height < 3.1);
      const fit = (selector: string, text: string, max: number, min: number, bold = false, wrap = true) => {
        const element = label.querySelector<HTMLElement>(selector);
        if (!element || !text) return;
        const style = canvasDocument.defaultView?.getComputedStyle(element);
        const reserved = 0;
        const width = element.clientWidth - (style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0) - reserved;
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
        element.classList.toggle("text-overflow", !result.fits);
        const placeholder = element.querySelector(".overflow-placeholder");
        if (!result.fits && !placeholder)
          element.insertAdjacentHTML("beforeend", '<span class="overflow-placeholder">TEXT TOO LONG · EDIT RECORD</span>');
        if (result.fits) {
          element.querySelector(".overflow-placeholder")?.remove();
          element.style.fontSize = `${result.fontSize}px`;
        }
        if (!result.fits) overflow = true;
      };
      fit(".order-id strong", row?.orderId || "", 9, 6.5, true, false);
      fit(".product-text strong", row?.product || "", 8.5, 6.5, true);
      fit(".vpl-prefix", "VPL", 9, 7.5, true, false);
      const vpl = row?.cod?.trim() ? formatVpl(row.cod) : "VPL";
      fit(".vpl-amount", vpl.replace(/^VPL\s*/u, ""), 16, 9.5, true, false);
      fit(".tracking-caption", "TRACKING NUMBER", 7, 6, true, false);
      fit(".tracking-text", row?.tracking || "", 10, 8, true, false);
      fit(".city-text", row?.city || "", 13, 9, true);
      fit(".province-text", row?.province || "", 8.5, 6.5, true);
      fit(".receiver-name", row?.name || "", 12, 9, true);
      fit(".address-text", row?.address || "", 11, 8);
      fit(".nearby-label", "Near by:", 9.5, 7.5, true, false);
      fit(".landmark", row?.landmark || "Not provided", 9.5, 7.5);
      fit(".phone-number", normalizePakistaniPhone(row?.phone ?? "") ?? "INVALID PHONE · EDIT", 16, 12, true, false);
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


function preparePrintLayout(popup: Window) {
  const fontStyles = popup.document.createElement("style");
  fontStyles.textContent = [...document.styleSheets]
    .flatMap((sheet) => {
      try { return [...sheet.cssRules]; } catch { return []; }
    })
    .filter((rule) => rule instanceof CSSFontFaceRule && rule.cssText.includes("Noto Naskh Arabic"))
    .map((rule) => rule.cssText)
    .join("\n");
  popup.document.head.append(fontStyles);
  const sharedStyles = popup.document.createElement("link");
  sharedStyles.rel = "stylesheet";
  sharedStyles.href = "/label.css";
  sharedStyles.addEventListener("load", () => {
    measureLabels(popup.document, popup.document);
    popup.requestAnimationFrame(() => popup.print());
  }, { once: true });
  sharedStyles.addEventListener("error", () => popup.close(), { once: true });
  popup.document.head.append(sharedStyles);
}

function openPrintPopup(items: Array<{ row: Order; index: number }>, position: number) {
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
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Garden Shop labels</title><link rel="stylesheet" href="/label.css"><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;width:210mm;height:297mm;background:#fff}.print-sheet{width:210mm;height:297mm;padding:14mm 6.5mm;display:grid;grid-template-columns:repeat(3,65mm);grid-template-rows:repeat(6,44mm);column-gap:1mm;row-gap:1mm;overflow:hidden}.page-break{break-after:page}.empty-label{width:65mm;height:44mm}@media screen{body{width:210mm;margin:12mm auto}}</style></head><body>${sheets}</body></html>`);
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
    preparePrintLayout(popup);
  }, { once: true });
  popup.document.close();
  return popup;
}

async function parseFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("FILE_SIZE_LIMIT_10MB");
  importedFileName = file.name;
  batchId = crypto.randomUUID();
  if (file.name.toLowerCase().endsWith(".csv")) {
    const parsed = parseCsv(await file.text());
    headers = (parsed.shift() ?? []).map((value) =>
      value.replace(/^\uFEFF/, "").trim(),
    );
    rawRows = parsed;
  } else {
    const { readSheet } = await import("read-excel-file/browser");
    const fileBytes = await file.arrayBuffer();
    const matrix = (await readSheet(file)) as unknown[][];
    restoreZeroFormattedCells(new Uint8Array(fileBytes), matrix);
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
  if (items.some(({ row }) => printBlocker(row))) throw new Error("LABEL_REQUIRES_CORRECTION");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mm = MM_TO_POINTS,
    pageH = A4_POINTS.height;
  const boxes = labelBoxes();
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("TEXT_MEASUREMENT_UNAVAILABLE");
  await document.fonts.ready;
  const totalPages = pagesForCount(items.length, position);
  for (let pageNo = 0; pageNo < totalPages; pageNo += 1) {
    const pdfPage = addA4Page(pdf);
    for (let slot = 0; slot < 18; slot += 1) {
      const itemIndex = pageNo * 18 + slot - (position - 1),
        item = items[itemIndex];
      if (!item) continue;
      const geometry = labelBox(itemIndex, position),
        xMm = geometry.x,
        yMm = geometry.y;
      const row = item.row;
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
      ) => {
        const fit = fitTextMm(measure, text, box.width, box.height, maxFont, minFont, isBold, lineHeight, wrap);
        if (!fit.fits) {
          if (!row.warnings.some((warning) => warning.startsWith("Text does not fit"))) row.warnings.push("Text does not fit at minimum readable size; edit this record before printing.");
          return;
        }
        if (usesComplexScript(text)) {
          await document.fonts.load(`${isBold ? "700 " : ""}${fit.fontSize}px "Noto Naskh Arabic"`);
          const scale = 4;
          const pxPerMm = 96 / 25.4;
          const widthPx = box.width * pxPerMm;
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(widthPx * scale);
          canvas.height = Math.ceil(box.height * pxPerMm * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("COMPLEX_TEXT_CANVAS_UNAVAILABLE");
          ctx.scale(scale, scale);
          ctx.fillStyle = "#000";
          ctx.font = `${isBold ? "700 " : "400 "}${fit.fontSize}px ${labelFontFamily(text)}`;
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
            x: (xMm + box.x) * mm,
            y: pageH - (yMm + box.y + box.height) * mm,
            width: box.width * mm,
            height: box.height * mm,
          });
          return;
        }
        const size = fit.fontSize * 0.75;
        const lineHeightMm = (fit.fontSize * lineHeight) / (96 / 25.4);
        fit.lines.forEach((lineText, lineIndex) => {
          const baselineMm = box.y + (lineIndex + 0.86) * lineHeightMm;
          const textWidth = (isBold ? bold : font).widthOfTextAtSize(lineText, size);
          const boxWidth = box.width * mm;
          const left = align === "center" ? (boxWidth - textWidth) / 2 : align === "right" ? boxWidth - textWidth : 0;
          pdfPage.drawText(lineText, {
            x: (xMm + box.x) * mm + Math.max(0, left),
            y: pageH - (yMm + baselineMm) * mm,
            size,
            font: isBold ? bold : font,
            maxWidth: Math.max(1, boxWidth - Math.max(0, left)),
            color,
          });
        });
      };
      const fillRect = (box: { x: number; y: number; width: number; height: number }, color: ReturnType<typeof rgb>) =>
        pdfPage.drawRectangle({ x: (xMm + box.x) * mm, y: pageH - (yMm + box.y + box.height) * mm, width: box.width * mm, height: box.height * mm, color });
      const outline = (box: { x: number; y: number; width: number; height: number }, radius: number, stroke: number, color?: ReturnType<typeof rgb>) => {
        const left = (xMm + box.x) * mm;
        const top = pageH - (yMm + box.y) * mm;
        const r = radius * mm;
        const width = box.width * mm;
        const height = box.height * mm;
        pdfPage.drawSvgPath(`M ${r} 0 L ${width - r} 0 Q ${width} 0 ${width} ${r} L ${width} ${height - r} Q ${width} ${height} ${width - r} ${height} L ${r} ${height} Q 0 ${height} 0 ${height - r} L 0 ${r} Q 0 0 ${r} 0 Z`, { x: left, y: top, borderColor: rgb(0, 0, 0), borderWidth: stroke * mm, ...(color ? { color } : {}) });
      };
      const headerText = async (title: string, data: string, box: { x: number; y: number; width: number; height: number }, maxFont: number, wrapData = true, dataLineHeight = 1) => {
        const strip = { x: box.x, y: box.y, width: box.width, height: 2 };
        fillRect(strip, rgb(0.03, 0.03, 0.03));
        pdfPage.drawRectangle({ x: (xMm + box.x) * mm, y: pageH - (yMm + box.y + box.height) * mm, width: box.width * mm, height: box.height * mm, borderColor: rgb(0, 0, 0), borderWidth: 0.2 * mm });
        await drawBoxText(title, { ...strip, y: strip.y + 0.05, height: strip.height - 0.1 }, 6.2, 5.7, true, rgb(1, 1, 1), "left", 1, false);
        await drawBoxText(data, { ...box, x: box.x + 0.45, y: box.y + 2, width: box.width - 0.8, height: box.height - 2.1 }, maxFont, 7.5, true, rgb(0, 0, 0), "left", dataLineHeight, wrapData);
      };

      outline(boxes.outline, 1, 0.2);
      outline(boxes.vpl, 1, 0.5);
      const vpl = row.cod.trim() ? formatVpl(row.cod) : "VPL";
      const vplAmount = vpl.replace(/^VPL\s*/u, "");
      await drawBoxText("VPL", { ...boxes.vpl, x: boxes.vpl.x + 0.25, y: boxes.vpl.y + 0.25, width: 4.8, height: boxes.vpl.height - 0.5 }, 8, 7.5, true, rgb(0, 0, 0), "left", 1, false);
      await drawBoxText(vplAmount, { ...boxes.vpl, x: boxes.vpl.x + 5.2, y: boxes.vpl.y + 0.25, width: boxes.vpl.width - 5.45, height: boxes.vpl.height - 0.5 }, 16, 9.5, true, rgb(0, 0, 0), "center", 0.95, false);

      await drawBoxText("TRACKING NUMBER", boxes.trackingCaption, 7, 6, true, rgb(0, 0, 0), "center", 1, false);
      await drawBoxText(row.tracking, boxes.tracking, 10, 8, true, rgb(0, 0, 0), "center", 1, false);
      fillRect(boxes.trackingDivider, rgb(0, 0, 0));
      const destination = destinationBoxes(measure, row.city, row.province);
      await drawBoxText(row.city, destination.city, 15, 9, true, rgb(0, 0, 0), "center", 0.95);
      outline(destination.province, 1.2, 0.2, rgb(0, 0, 0));
      await drawBoxText(row.province, { ...destination.province, x: destination.province.x + 0.8, y: destination.province.y + 0.15, width: destination.province.width - 1.6, height: destination.province.height - 0.3 }, 8.5, 6.5, true, rgb(1, 1, 1), "center", destination.province.height > 3.1 ? 0.95 : 1);

      outline(boxes.to, 1, 0.3);
      const tagWidth = boxes.toTag.width * mm;
      const tagHeight = boxes.toTag.height * mm;
      pdfPage.drawSvgPath(`M 0 0 L ${tagWidth * 0.86} 0 L ${tagWidth} ${tagHeight / 2} L ${tagWidth * 0.86} ${tagHeight} L 0 ${tagHeight} Z`, { x: (xMm + boxes.toTag.x) * mm, y: pageH - (yMm + boxes.toTag.y) * mm, color: rgb(0.03, 0.03, 0.03) });
      await drawBoxText("To:", boxes.toTag, 12, 10, true, rgb(1, 1, 1), "center");
      const recipient = recipientBoxes(measure, row.name);
      await drawBoxText(row.name, recipient.name, 12, 9, true, rgb(0, 0, 0), "left", 1);
      await drawBoxText(row.address, recipient.address, 11, 8, false, rgb(0, 0, 0), "left", 1.08);
      await drawBoxText("Near by:", boxes.nearbyLabel, 9.5, 7.5, true, rgb(0, 0, 0), "left", 1, false);
      await drawBoxText(row.landmark, boxes.landmark, 9.5, 7.5);
      fillRect(boxes.contactDivider, rgb(0, 0, 0));
      await drawBoxText(normalizePakistaniPhone(row.phone)!, boxes.contact, 11, 9, true, rgb(0, 0, 0), "center", 1, false);
      outline(boxes.orderProduct, 0, 0.2);
      await headerText("Order ID", row.orderId, boxes.orderId, 9, false);
      await headerText("Product", row.product, boxes.product, 8.5, true, 0.95);
      fillRect({ ...boxes.footer, height: 0.2 }, rgb(0, 0, 0));
      fillRect(boxes.footerFrom, rgb(0.03, 0.03, 0.03));
      await drawBoxText("From:", boxes.footerFrom, 9, 7, true, rgb(1, 1, 1), "center", 1, false);
      await drawBoxText("Garden Shop", boxes.footerSender, 10, 7, true, rgb(0.14, 0.38, 0.18), "left", 1, false);
      fillRect(boxes.footerDivider, rgb(0, 0, 0));
      await drawBoxText(LABEL_FOOTER_ADDRESS, boxes.footerAddress, 8, 6.5, false, rgb(0, 0, 0), "left", 1, false);

      if (row.tracking) {
        const barcode = await renderBarcodeSvg(row.tracking);
        const scale = Math.min(
          mm * boxes.barcode.width / barcode.width,
          mm * boxes.barcode.height / barcode.height,
        );
        if (scale * barcode.moduleWidth * 25.4 / 72 < CODE128_LAYOUT.minimumModuleMm) {
          if (!row.warnings.some((warning) => warning.startsWith("Tracking barcode is too dense"))) row.warnings.push("Tracking barcode is too dense for this label; edit or use another layout.");
        } else {
          const barcodeWidth = barcode.width * scale;
          const barcodeHeight = barcode.height * scale;
          const left = (xMm + boxes.barcode.x) * mm + (boxes.barcode.width * mm - barcodeWidth) / 2;
          const top = pageH - (yMm + boxes.barcode.y) * mm - (boxes.barcode.height * mm - barcodeHeight) / 2;
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
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((node) =>
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const target = (node as HTMLElement).dataset.view!;
      if (target === "preview" && !rows.length) return;
      if (target === "print" && !rows.length) return;
      view = target;
      render();
    }),
  );
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
      );
      selected.clear();
      rows.forEach((_, i) => selected.add(i));
      view = "review";
      page = 0;
      activeLabel = rows.findIndex((row) => row.tracking);
      const failed = rows.filter((row) => !row.name || !normalizePakistaniPhone(row.phone) || !row.address || !row.tracking).length;
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
    rows = [];
    rawRows = [];
    headers = [];
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
  document.querySelector("#countLimit")?.addEventListener("change", (event) => {
    countLimit = Number((event.target as HTMLInputElement).value);
    render();
  });
  document.querySelector("#printNow")?.addEventListener("click", async () => {
    const items = currentOrders();
    if (!items.length) {
      statusMessage = "Select at least one label before printing.";
      render();
      return;
    }
    if (items.some(({ row }) => printBlocker(row))) {
      statusMessage = "Resolve flagged required fields, barcode, or layout issues before printing.";
      render();
      return;
    }
    const popup = openPrintPopup(items, startPosition);
    if (!popup) {
      statusMessage = "Allow pop-ups to print.";
      render();
      return;
    }
    await logEvent(printRequested ? "REPRINT_REQUESTED" : "PRINT_REQUESTED", {
      labels: items.length,
      pages: pagesForCount(items.length, startPosition),
    });
    printRequested = true;
    await logEvent("LABELS_GENERATED", {
      labels: items.length,
      pages: pagesForCount(items.length, startPosition),
    });
  });
  document.querySelector("#savePdf")?.addEventListener("click", async () => {
    try {
      const items = currentOrders(),
        blocked = items.some(({ row }) => printBlocker(row));
      if (blocked) {
        statusMessage = "Resolve flagged required fields, barcode, or layout issues before exporting a PDF.";
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
      statusMessage =
        "PDF generation failed. Your editable batch remains available.";
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
    await logEvent(printRequested ? "REPRINT_REQUESTED" : "PRINT_REQUESTED", {
      labels: 1,
      pages: 1,
    });
    printRequested = true;
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
}

function editOrder(index: number) {
  const order = rows[index];
  const fields: Array<[keyof Order, string]> = [
    ["serial", "Sr. no"],
    ["orderId", "Order ID"],
    ["name", "Receiver name"],
    ["email", "Email"],
    ["phone", "Contact number (text)"],
    ["address", "Full address"],
    ["facebookName", "Facebook Name"],
    ["tracking", "Tracking number"],
    ["product", "Product"],
    ["cod", "VPL COD amount"],
    ["city", "City"],
    ["province", "Province"],
    ["landmark", "Near by"],
    ["senderName", "Sender name"],
    ["senderAddress", "Sender address"],
  ];
  const form = document.createElement("form");
  form.className = "edit-form";
  form.innerHTML = `<dialog open><h2>Edit label details</h2><p>Edits stay local and are not sent to monitoring.</p>${order.sourceAddress !== order.address ? `<p class="source-note">The imported address value is retained below for editing and audit; only the display copy is normalized.</p><button class="button secondary" type="button" id="restoreSourceAddress">Restore imported source address</button>` : ""}${fields.map(([key, label]) => `<label>${esc(label)}<input name="${key}" value="${esc(order[key])}" ${key === "phone" ? 'inputmode="tel"' : ""}></label>`).join("")}<div class="button-row"><button class="button secondary" type="button" data-cancel>Cancel</button><button class="button primary">Save changes</button></div></dialog>`;
  app.append(form);
  form
    .querySelector("[data-cancel]")
    ?.addEventListener("click", () => form.remove());
  form.querySelector("#restoreSourceAddress")?.addEventListener("click", () => {
    const address = form.querySelector<HTMLInputElement>('input[name="address"]');
    if (address) address.value = order.sourceAddress;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const previousAddress = order.address;
    const data = new FormData(form);
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
        !warning.startsWith("Contact number is invalid") &&
        !warning.startsWith("Receiver name") &&
        !warning.startsWith("Contact number") &&
        !warning.startsWith("Delivery address") &&
        !warning.startsWith("Tracking number") &&
        !warning.startsWith("Text does not fit") &&
        !warning.startsWith("Tracking barcode is too dense") &&
        !warning.startsWith("Generated barcode"),
    );
    if (!order.name) order.warnings.push("Receiver name is required.");
    if (!order.phone) order.warnings.push("Contact number is missing.");
    else if (!normalizedPhone) order.warnings.push("Contact number is invalid; enter a Pakistani mobile number with 11 digits.");
    if (repeatedContact.removed)
      order.warnings.push("Exact contact match removed from displayed address; original source is retained in the editor.");
    if (!order.address) order.warnings.push("Delivery address is required.");
    if (!order.tracking)
      order.warnings.push(
        "Tracking number is missing; barcode cannot be generated.",
      );
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
    duplicates("tracking", (value) => value.trim().toUpperCase());
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
