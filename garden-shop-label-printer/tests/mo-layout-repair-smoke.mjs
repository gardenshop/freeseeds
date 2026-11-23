import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseUrl = "http://127.0.0.1:4176";
const evidence = resolve(process.env.LP_TEST_EVIDENCE_DIR ?? "C:\\Users\\nazim\\AppData\\Local\\Temp\\kilo");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const auditEvents = [];
const monitoring = createServer((request, response) => {
  response.setHeader("access-control-allow-origin", baseUrl);
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
  if (request.method !== "POST" || request.url !== "/api/events") { response.writeHead(404).end(); return; }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    let event;
    try { event = JSON.parse(body); } catch { response.writeHead(400).end(); return; }
    auditEvents.push({ eventType: event.eventType, rows: event.counts?.rows, pages: event.counts?.pages });
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
  });
});
const server = spawn(process.execPath, [join(project, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
  cwd: project,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, VITE_MONITOR_URL: "http://127.0.0.1:4177" },
});

const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark", "Order Date", "Sender", "S.Address"];
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const dateFor = (index) => {
  const date = new Date(Date.UTC(2026, 0, index + 1));
  return `${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCFullYear()).slice(-2)}`;
};
const syntheticRows = Array.from({ length: 100 }, (_, index) => {
  const row = index + 1;
  const long = row === 1 || row === 51;
  const suffix = row === 1 ? "پتہ آزمائشی Urdu" : row === 51 ? "طویل وصول کنندہ پتہ Urdu" : "";
  return [
    `LP061-SYN-${String(row).padStart(3, "0")}`,
    `Synthetic Receiver ${row}${long ? ` Extended ${row === 1 ? "دوست" : "وصول"}` : ""}`,
    `03${String(100000000 + row).padStart(9, "0")}`,
    `Synthetic Street ${row}${long ? ` Block ${row} ${"Address Segment ".repeat(5)}${suffix}` : ""}`,
    `${row % 2 ? "VPL" : "VPP"}${String(row).padStart(6, "0")}`,
    String(20000 + row * 100),
    `Synthetic Parcel ${row}`,
    row === 51 ? "Gujranwala" : row === 1 ? "گوجرانوالہ" : "Sahiwal",
    row === 51 ? "Khyber Pakhtunkhwa (KPK)" : "Punjab",
    `Synthetic Landmark ${row}`,
    dateFor(index),
    `Synthetic Sender ${row}`,
    `Synthetic Sender Return ${row}`,
  ];
});

function badExistingLayout() {
  const field = (id, source, xMm, yMm, widthMm, heightMm, fontSizePt, wrap = false, alignment = "left", bold = false) => ({ id, source, face: "front", xMm, yMm, widthMm, heightMm, fontSizePt, bold, alignment, wrap });
  return {
    version: 2,
    partyPositionVersion: 2,
    fields: [
      field("saved-tracking-top", "tracking", 85.5561, 42.4496, 49.2662, 4.5869, 10, false, "left", true),
      field("saved-order-date-intimation", "orderDate", 39, 168.8, 38.6602, 4.5, 8, false, "center", true),
      field("saved-principal-top", "declaredPrincipal", 13.5, 43.5, 43.4, 12.6, 27, false, "center", true),
      field("saved-sender-name-top", "senderName", 7.4077, 117.0735, 100.7, 4.8, 13, false, "left", true),
      field("saved-sender-address-top", "senderAddress", 7.7, 123.4186, 100.7, 4.8, 10, false, "left", true),
      field("saved-receiver-name-top", "name", 7.9645, 85.271, 101.1176, 5.2176, 12),
      field("saved-receiver-address-top", "address", 7.4216, 91.296, 100.9784, 9.0432, 7.5, true),
      field("saved-receiver-phone-top", "phone", 82.7355, 104.9131, 25.4, 4.8, 8, false, "left", true),
      field("saved-city-top", "city", 7.9784, 100.1304, 50, 4.8, 10),
      field("saved-province-top", "province", 59.5824, 100.6176, 48.4, 4.8, 10),
      field("saved-principal-intimation", "declaredPrincipal", 87.9363, 150.6234, 42, 5.6196, 9, false, "center"),
      field("saved-tracking-intimation", "tracking", 81.0601, 172.8401, 42.2645, 4.2972, 9, false, "left", true),
      field("saved-phone-intimation", "phone", 39.5383, 183.1322, 41.7355, 5.0907, 9, false, "left", true),
      field("saved-original-amount-intimation", "sourceAmount", 92.0933, 166.1246, 42, 4.8262, 10, false, "left", true),
      field("saved-receiver-name-intimation", "name", 39.8028, 177.233, 94.1006, 5.0907, 10),
      field("saved-sender-name-intimation", "senderName", 3.6151, 181.7309, 32.5259, 7.5013, 15, false, "center", true),
      field("saved-sender-cnic", "senderCnic", 8.1825, 122.6734, 42, 5, 10),
    ],
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("LP061_REPAIR_SMOKE_VITE_TIMEOUT");
}

async function rasterPdfPage(pdf, pageNumber, path) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.35 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  globalThis.DOMMatrix ??= DOMMatrix;
  globalThis.ImageData ??= ImageData;
  globalThis.Path2D ??= Path2D;
  const renderTask = page.render({
    canvasContext: context,
    viewport,
    canvasFactory: {
      create: (width, height) => { const value = createCanvas(width, height); return { canvas: value, context: value.getContext("2d") }; },
      reset: (target, width, height) => { target.canvas.width = width; target.canvas.height = height; },
      destroy: (target) => { target.canvas.width = 0; target.canvas.height = 0; },
    },
  });
  await renderTask.promise;
  await writeFile(path, canvas.toBuffer("image/png"));
  const operators = await page.getOperatorList();
  return { width: viewport.width, height: viewport.height, containsRaster: operators.fnArray.some((operator) => operator === OPS.paintImageXObject || operator === OPS.paintInlineImageXObject) };
}

let browser;
try {
  await mkdir(evidence, { recursive: true });
  await new Promise((resolveListen, reject) => {
    monitoring.once("error", reject);
    monitoring.listen(4177, "127.0.0.1", resolveListen);
  });
  await waitForServer();
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  await context.addInitScript(() => Object.defineProperty(window, "print", { configurable: true, value: () => { window.__moPrintRequested = true; } }));
  await context.route("**/*", (route) => {
    const hostname = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(hostname) ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#sample").click();
  await page.locator("#applyMapping").click();
  await page.locator("button[data-edit]").first().waitFor({ timeout: 30000 });
  await page.locator("#newBatch").click();
  const csv = [headers, ...syntheticRows].map((row) => row.map(quote).join(",")).join("\r\n");
  await page.locator("#workbook").setInputFiles({ name: "lp061-synthetic-n100.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("#applyMapping").click();
  await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
  await page.locator('[data-view="mo"]').click();
  await page.locator(".mo-summary").waitFor({ timeout: 30000 });
  assert.match(await page.locator(".mo-summary").innerText(), /100\s+eligible VPL\/VPP rows/u);
  await page.evaluate((layout) => localStorage.setItem("gfs-mo51-layout-v1", JSON.stringify(layout)), badExistingLayout());
  await page.locator("#moLayoutReload").click();
  await page.waitForFunction(() => document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector(".mo-sheet") && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.fonts.status === "loaded", { timeout: 30000 });
  await page.waitForFunction(() => {
    const text = document.querySelector("#moMappingFitError")?.textContent?.trim() ?? "";
    return text.length > 0 && !text.startsWith("Checking ");
  }, undefined, { timeout: 180000 });
  const beforeRepair = await page.evaluate(() => ({
    rows: document.querySelector(".mo-summary")?.textContent,
    diagnostics: document.querySelector("#moMappingFitError")?.innerText,
    downloadDisabled: document.querySelector("#downloadMoLayoutPdf")?.disabled ?? null,
    printDisabled: document.querySelector("#printMoBatch")?.disabled ?? null,
    visiblePair: [...(document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelectorAll(".mo-half[data-mo-source-index]") ?? [])].map((half) => Number(half.getAttribute("data-mo-source-index")) + 1),
  }));
  const artworkAnchors = await page.frameLocator("#moLayoutFrontPreview").locator('.mo-half[data-mo-slot="left"]').evaluate((half) => {
    const halfRect = half.getBoundingClientRect();
    const mmRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Number(((rect.left - halfRect.left) * 148.5 / halfRect.width).toFixed(2)),
        y: Number(((rect.top - halfRect.top) * 210 / halfRect.height).toFixed(2)),
        width: Number((rect.width * 148.5 / halfRect.width).toFixed(2)),
        height: Number((rect.height * 210 / halfRect.height).toFixed(2)),
        text: element.textContent?.trim().replace(/\s+/gu, " ").slice(0, 60),
      };
    };
    const labels = [...half.querySelectorAll("span")];
    const trackingLabel = labels.find((element) => element.textContent?.trim() === "No. of V. P. Article");
    const dateLabel = labels.find((element) => element.textContent?.trim().toLowerCase() === "date");
    const partyLines = ["receiver", "sender"].map((party) => {
      const block = half.querySelector(`[data-mo-party-block="${party}"]`);
      const rows = [...(block?.children[2]?.children ?? [])].map(mmRect);
      return { party, rows };
    });
    const page = half.querySelector(".page");
    const principal = page?.querySelector('div[style*="width:172px"]');
    const articleNumber = trackingLabel?.parentElement?.children[1];
    const topDateLine = dateLabel?.parentElement?.children[3];
    const intimationText = labels.find((element) => element.textContent?.includes("INTIMATION"));
    const intimationArea = intimationText?.parentElement?.parentElement;
    const headingIndex = intimationText?.parentElement ? [...(intimationArea?.children ?? [])].indexOf(intimationText.parentElement) : -1;
    const intimationRows = [...(intimationArea?.children ?? [])].slice(headingIndex + 1).map((row) => ({
      label: row.textContent?.trim().replace(/\s+/gu, " ").slice(0, 75),
      underlines: [...row.querySelectorAll("span,div")].filter((item) => item.style.borderBottom).map(mmRect),
      postalBoxes: [...row.querySelectorAll("div[style*='height: 16px']")].map(mmRect),
    }));
    return { partyLines, principal: principal ? mmRect(principal) : null, tracking: articleNumber ? mmRect(articleNumber) : null, topDate: topDateLine ? mmRect(topDateLine) : null, intimationRows };
  });
  console.log(JSON.stringify({ lp061N100BeforeRepair: beforeRepair, artworkAnchors, pageErrors }));
  assert.deepEqual(beforeRepair.visiblePair, [1, 51]);
  assert.equal(beforeRepair.downloadDisabled, true);
  assert.equal(beforeRepair.printDisabled, true);
  assert.match(beforeRepair.diagnostics, /Source row 1/u);
  assert.match(beforeRepair.diagnostics, /Source row 51/u);
  assert.ok(!pageErrors.length, `unexpected synthetic page errors: ${pageErrors.join(" | ")}`);

  const storedBeforeRepair = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  await page.evaluate(() => {
    window.__lp064RepairProgress = [];
    const observe = () => {
      const text = document.querySelector("#moRepairBatchStatus")?.textContent ?? "";
      const match = /\((\d+)\/(\d+) front\/back face documents\)/u.exec(text);
      if (match) window.__lp064RepairProgress.push(`${match[1]}/${match[2]}`);
    };
    window.__lp064RepairProgressObserver = new MutationObserver(observe);
    window.__lp064RepairProgressObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.locator("#moRepairLayout").click();
  await page.locator("#moFinalPreview").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const status = document.querySelector("#moRepairBatchStatus")?.textContent ?? "";
    return status.startsWith("PASS ·") || status.includes("blocking diagnostics remain") || status.includes("Full-batch validation failed");
  }, undefined, { timeout: 180000 });
  const firstRepairStatus = await page.locator("#moRepairBatchStatus").innerText();
  const storedDuringPreview = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  assert.equal(storedDuringPreview, storedBeforeRepair, "proposed positions must not overwrite the saved layout before Apply");
  assert.match(firstRepairStatus, /blocking diagnostics remain/u, `the copied saved SenderName field should remain blocked rather than be moved over stamp artwork: ${firstRepairStatus}`);
  const senderNameIssue = page.locator('#moRepairSummary [data-mo-repair-unresolved="saved-sender-name-intimation"]');
  assert.equal(await senderNameIssue.count(), 1, "unplaceable lower Intimation SenderName must be identified with a direct correction control");
  assert.equal(await senderNameIssue.locator('[data-mo-repair-select="saved-sender-name-intimation"]').count(), 1);
  assert.equal(await page.locator("#moApplyLayoutRepair").isEnabled(), true, "supported fields may be previewed/applied without hiding the unresolved field");

  // In this synthetic fixture only, explicitly remove the duplicate lower-Intimation SenderName field.
  // The production proposal never removes this custom binding automatically.
  await senderNameIssue.locator('[data-mo-repair-select="saved-sender-name-intimation"]').click();
  await page.locator("#moLayoutRemoveField").waitFor({ timeout: 30000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), storedBeforeRepair, "selecting the direct correction must not persist automatically");
  await page.locator("#moLayoutRemoveField").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), storedBeforeRepair, "removing the synthetic duplicate remains unsaved until Save Layout");
  await page.locator("#moLayoutSave").click();
  const manuallyCorrectedLayout = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  assert.ok(manuallyCorrectedLayout);
  assert.equal(JSON.parse(manuallyCorrectedLayout).fields.length, 16);
  assert.ok(JSON.parse(manuallyCorrectedLayout).fields.some((field) => field.id === "saved-sender-name-top" && field.source === "senderName"), "the lower Sender block retains the SenderName source binding");
  await page.waitForFunction(() => {
    const status = document.querySelector("#moMappingFitError")?.textContent ?? "";
    return status.includes("Mapped layout fields require attention") && !status.startsWith("Checking ");
  }, undefined, { timeout: 180000 });

  await page.evaluate(() => { window.__lp064RepairProgress.length = 0; });
  await page.locator("#moRepairLayout").click();
  await page.locator("#moFinalPreview").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#moRepairBatchStatus")?.textContent?.startsWith("PASS · 100 selected records checked"), undefined, { timeout: 180000 });
  const repairStatus = await page.locator("#moRepairBatchStatus").innerText();
  const repairProgress = await page.evaluate(() => { window.__lp064RepairProgressObserver?.disconnect(); return window.__lp064RepairProgress; });
  const distinctRepairProgress = repairProgress.filter((value, index) => index === 0 || value !== repairProgress[index - 1]);
  assert.deepEqual(distinctRepairProgress, Array.from({ length: 100 }, (_, index) => `${index + 1}/100`), "N100 progress must report every face and yield between checks");
  assert.match(repairStatus, /static artwork 4 measured\/196 reused/u, "static artwork geometry should be measured once per face/slot and safely reused");
  const storedBeforeApply = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  assert.equal(storedBeforeApply, manuallyCorrectedLayout, "the corrected layout definition remains unchanged during the second proposal preview");
  const proposalText = await page.frameLocator("#moFinalPreview").locator(".mo-sheet").innerText();
  assert.match(proposalText, /VPL000001/u);
  assert.match(proposalText, /VPL000051/u);
  assert.match(proposalText, /Synthetic Receiver 1/u);
  assert.match(proposalText, /Synthetic Receiver 51/u);
  assert.ok((proposalText.match(/VPL000001/gu) ?? []).length >= 2, "exact tracking must fill both article-number and lower Intimation number fields");
  assert.ok((proposalText.match(/20100/gu) ?? []).length >= 2, "validated principal must be repeated in lower Intimation without adding commission");
  assert.ok((proposalText.match(/Synthetic Receiver 1/gu) ?? []).length >= 2, "Receiver name must appear in the upper party block and lower Intimation line");
  const expectedFrontFieldIds = JSON.parse(manuallyCorrectedLayout).fields.filter((field) => field.face === "front" && field.source !== "senderCnic").map((field) => field.id).sort();
  const renderStructure = await page.frameLocator("#moFinalPreview").locator(".mo-half[data-mo-source-index]").evaluateAll((halves) => halves.map((half) => {
    const fields = [...half.querySelectorAll(":scope > .mo-layout-field")];
    const ids = fields.map((field) => field.dataset.moLayoutField);
    const placements = new Map();
    for (const field of fields) {
      const key = [field.dataset.moLayoutSource, field.style.left, field.style.top, field.style.width, field.style.height].join("|");
      placements.set(key, (placements.get(key) ?? 0) + 1);
    }
    return {
      fieldCount: fields.length,
      ids: ids.sort(),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      duplicateSourcePlacements: [...placements].filter(([, count]) => count > 1).map(([key]) => key),
      valuesPerField: fields.map((field) => field.querySelectorAll(":scope > [data-mo-layout-text]").length),
      editorOnlyNodes: half.querySelectorAll(".mo-editor-field,.mo-editor-binding,[data-mo-resize-handle],[data-mo-editor-only]").length,
    };
  }));
  assert.equal(renderStructure.length, 2, "the first and source-51 forms must each have one clean output half");
  for (const form of renderStructure) {
    assert.equal(form.fieldCount, expectedFrontFieldIds.length, "one layout node must be rendered for each configured non-CNIC field");
    assert.deepEqual(form.ids, expectedFrontFieldIds, "each intended field ID must render exactly once per form");
    assert.deepEqual(form.duplicateIds, [], "a duplicated field ID must never render twice in one form");
    assert.deepEqual(form.duplicateSourcePlacements, [], "repeated sources are allowed only at distinct designated MO positions");
    assert.ok(form.valuesPerField.every((count) => count === 1), "every configured layout box must contain exactly one value node");
    assert.equal(form.editorOnlyNodes, 0, "clean preview contains no editor values, labels, handles or selections");
  }
  const proposedPair = await page.frameLocator("#moFinalPreview").locator(".mo-half[data-mo-source-index]").evaluateAll((halves) => halves.map((half) => Number(half.getAttribute("data-mo-source-index")) + 1));
  assert.deepEqual(proposedPair, [1, 51]);
  assert.equal(await page.frameLocator("#moFinalPreview").locator(".mo-editor-field,.mo-editor-binding,[data-mo-resize-handle]").count(), 0, "repair proposal preview must contain no editing handles/tags");
  await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp061-n100-proposed-firstpair.png") });
  await page.locator("#moApplyLayoutRepair").click();
  await page.waitForFunction(() => {
    const download = document.querySelector("#downloadMoLayoutPdf");
    const print = document.querySelector("#printMoBatch");
    return download && print && !download.disabled && !print.disabled;
  }, undefined, { timeout: 180000 });
  const savedAfterRepair = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  assert.ok(savedAfterRepair, "explicit Apply Repair must save the MO layout definition");
  assert.doesNotMatch(savedAfterRepair, /LP061-SYN|Synthetic Receiver|Synthetic Street|03100000001|00000-1234567-8/u, "saved MO layout must contain no imported values or Sender CNIC");
  const savedLayout = JSON.parse(savedAfterRepair);
  assert.equal(savedLayout.fields.length, 16, "the explicit direct correction removes only the unfit duplicate; all other saved definitions remain");
  assert.equal(savedLayout.fields.find((field) => field.id === "saved-tracking-top").xMm, 103);
  assert.equal(savedLayout.fields.find((field) => field.id === "saved-principal-top").fontSizePt, 10);
  assert.equal(savedLayout.fields.find((field) => field.id === "saved-principal-top").bold, true);
  assert.equal(savedLayout.fields.find((field) => field.id === "saved-sender-name-top").fontSizePt, 9.5);
  assert.equal(savedLayout.fields.some((field) => field.id === "saved-sender-name-intimation"), false, "the unsafe duplicate lower SenderName was removed only by the explicit synthetic direct correction");
  assert.deepEqual({ xMm: savedLayout.fields.find((field) => field.id === "saved-original-amount-intimation").xMm, yMm: savedLayout.fields.find((field) => field.id === "saved-original-amount-intimation").yMm }, { xMm: 39.22, yMm: 169.11 }, "the original amount remains on the separate Price Payable line, never in declared principal");
  assert.deepEqual({ xMm: savedLayout.fields.find((field) => field.id === "saved-phone-intimation").xMm, yMm: savedLayout.fields.find((field) => field.id === "saved-phone-intimation").yMm }, { xMm: 108.72, yMm: 180.14 });
  assert.deepEqual(auditEvents.filter((event) => event.eventType === "PDF_GENERATED"), [], "repair preview alone must not claim a PDF was generated");

  const downloadEvent = page.waitForEvent("download", { timeout: 180000 });
  await page.locator("#downloadMoLayoutPdf").click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /mo51-layout-batch-100-forms\.pdf/u);
  const pdfPath = join(evidence, "lp061-n100-repaired.pdf");
  await download.saveAs(pdfPath);
  const pdfBytes = await readFile(pdfPath);
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 100, "N100 paired output must contain 50 sheets × 2 pages");
  const mediaBox = pdf.getPage(0).getSize();
  assert.ok(Math.abs(mediaBox.width * 25.4 / 72 - 297) < 0.1 && Math.abs(mediaBox.height * 25.4 / 72 - 210) < 0.1, "downloaded PDF must use A4 landscape MediaBox");
  const pdfJs = await getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true, useSystemFonts: true }).promise;
  const firstRaster = await rasterPdfPage(pdfJs, 1, join(evidence, "lp061-n100-pdf-front-first-1-51.png"));
  const lastRaster = await rasterPdfPage(pdfJs, 99, join(evidence, "lp061-n100-pdf-front-last-50-100.png"));
  assert.equal(firstRaster.containsRaster, true, "actual downloaded PDF front page must contain rendered MO artwork/content");
  assert.equal(lastRaster.containsRaster, true);
  await page.evaluate(() => {
    const original = window.setTimeout;
    Object.defineProperty(window, "__moOriginalWindowSetTimeout", { value: original, configurable: true });
    window.setTimeout = function (handler, timeout, ...args) {
      if (timeout === 30 * 60 * 1000) Object.defineProperty(window, "__moPdfBlobCleanupDelayMs", { value: timeout, writable: true, configurable: true });
      return original.call(window, handler, timeout, ...args);
    };
  });
  const popupEvent = page.waitForEvent("popup", { timeout: 180000 });
  await page.locator("#printMoBatch").click();
  const popup = await popupEvent;
  await page.waitForFunction(() => document.querySelector("#moPdfStatus")?.textContent?.startsWith("Verified MO PDF opened;") === true, undefined, { timeout: 180000 }).catch(async (error) => {
    throw new Error(`${error.message}\nPrint status=${await page.locator("#moPdfStatus").innerText()}\nPopup=${popup.url()}`);
  });
  await popup.waitForURL((url) => url.href.startsWith("blob:"), { timeout: 30000 });
  const popupDetails = { url: popup.url(), type: await popup.evaluate(() => document.contentType), printed: await popup.evaluate(() => window.__moPrintRequested === true) };
  assert.equal(new URL(popupDetails.url).protocol, "blob:");
  assert.equal(popupDetails.type, "application/pdf");
  assert.equal(popupDetails.printed, true, "Print MO Batch must call print only on the verified generated PDF target");
  assert.equal(await page.evaluate(() => window.__moPdfBlobCleanupDelayMs), 1800000);
  const popupFetch = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return { ok: response.ok, type: response.headers.get("content-type"), bytes: bytes.length, base64: btoa(binary) };
  }, popupDetails.url);
  assert.equal(popupFetch.ok, true);
  assert.equal(popupFetch.type, "application/pdf");
  assert.ok(popupFetch.bytes > 0);
  const popupPdf = await PDFDocument.load(Buffer.from(popupFetch.base64, "base64"));
  assert.equal(popupPdf.getPageCount(), 100, "Print MO Batch popup must display the same 100-page generated PDF");
  delete popupFetch.base64;
  await popup.close();
  const popupFetchAfterClose = await page.evaluate(async (url) => { try { const response = await fetch(url); return response.ok && (await response.arrayBuffer()).byteLength > 0; } catch { return false; } }, popupDetails.url);
  assert.equal(popupFetchAfterClose, true, "popup.closed after verification must not revoke the PDF blob");
  await page.evaluate(() => { window.setTimeout = window.__moOriginalWindowSetTimeout; delete window.__moOriginalWindowSetTimeout; delete window.__moPdfBlobCleanupDelayMs; });
  const generatedAudit = auditEvents.filter((event) => event.eventType === "PDF_GENERATED");
  assert.equal(generatedAudit.length, 2, "only actual download and print PDF generation should emit the local synthetic audit event");
  assert.deepEqual(generatedAudit.map((event) => ({ rows: event.rows, pages: event.pages })), [{ rows: 100, pages: 100 }, { rows: 100, pages: 100 }]);
  assert.deepEqual(pageErrors, []);
  await page.locator("#moPrintSideMode").selectOption("front-only");
  await page.locator("#cancelMoLayoutValidation").waitFor({ timeout: 30000 });
  const cancelProgress = await page.locator("#moMappingFitError").innerText();
  assert.match(cancelProgress, /Checking 100 records \(\d+\/50 rendered faces\)/u);
  await page.locator("#cancelMoLayoutValidation").click();
  await page.locator("#retryMoLayoutValidation").waitFor({ timeout: 30000 });
  assert.match(await page.locator("#moMappingFitError").innerText(), /MO_LAYOUT_BATCH_VALIDATION_CANCELLED/u);
  assert.equal(await page.locator("#downloadMoLayoutPdf").isDisabled(), true, "cancelled validation keeps download blocked");
  assert.equal(await page.locator("#printMoBatch").isDisabled(), true, "cancelled validation keeps print blocked");
  const diagnosticLines = beforeRepair.diagnostics.split(/\n/u).filter((line) => line.startsWith("Source row "));
  console.log(JSON.stringify({ lp061N100: {
    beforeRepair: { selectedRows: beforeRepair.visiblePair, count: diagnosticLines.length, firstIssues: diagnosticLines.slice(0, 4), downloadDisabled: beforeRepair.downloadDisabled, printDisabled: beforeRepair.printDisabled },
    initialRepairStatus: firstRepairStatus, directCorrection: "removed duplicate lower Intimation SenderName only in this synthetic acceptance fixture", repairStatus, savedFieldCount: savedLayout.fields.length,
    fieldRenderStructure: renderStructure.map(({ fieldCount, duplicateIds, duplicateSourcePlacements, editorOnlyNodes }) => ({ fieldCount, duplicateIds, duplicateSourcePlacements, editorOnlyNodes })),
    download: { filename: download.suggestedFilename(), pageCount: pdf.getPageCount(), mediaBox, firstRaster, lastRaster },
    print: { popupUrlScheme: new URL(popupDetails.url).protocol, contentType: popupDetails.type, printRequested: popupDetails.printed, popupFetch, popupFetchAfterClose },
    pdfGeneratedAuditCounts: generatedAudit.map(({ rows, pages }) => ({ rows, pages })), evidence,
  } }));
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  monitoring.close();
}
