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
    `Synthetic Receiver ${row}${long ? ` Extended Recipient ${suffix}` : ""}`,
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
      field("tracking", "tracking", 74, 45, 42, 8, 9),
      field("principal", "declaredPrincipal", 18, 50, 35, 5, 8.5, false, "center"),
      field("sender-name", "senderName", 7.7, 112.8, 100.7, 4.8, 8.5),
      field("sender-address", "senderAddress", 7.7, 117.6, 38, 4.8, 8),
      field("receiver-name", "name", 7.7, 85.8, 70, 4.8, 8.5, false, "left", true),
      field("receiver-address", "address", 7.7, 90.6, 74, 16, 7.5, true),
      field("receiver-phone", "phone", 83, 100.2, 25.4, 4.8, 7.5),
      field("receiver-city", "city", 7.7, 105, 50, 4.8, 7),
      field("receiver-province", "province", 60, 105, 48.4, 4.8, 7),
      field("order-date", "orderDate", 27, 18, 13.8, 10.5, 6.5, false, "center"),
      field("intimation-principal", "declaredPrincipal", 12, 150, 35, 8, 8),
      field("intimation-date", "orderDate", 12, 158, 35, 8, 7),
      field("intimation-tracking", "tracking", 12, 176, 42, 8, 8),
      field("intimation-receiver", "name", 12, 188, 42, 8, 8),
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
  await page.locator("#moRepairLayout").click();
  await page.locator("#moFinalPreview").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const status = document.querySelector("#moRepairBatchStatus")?.textContent ?? "";
    return status.startsWith("PASS ·") || status.includes("blocking diagnostics remain") || status.includes("Full-batch validation failed");
  }, undefined, { timeout: 180000 });
  const repairStatus = await page.locator("#moRepairBatchStatus").innerText();
  const storedDuringPreview = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  assert.equal(storedDuringPreview, storedBeforeRepair, "proposed positions must not overwrite the saved layout before Apply");
  assert.match(repairStatus, /^PASS · 100 selected records checked/u, `Repair proposal did not pass all N100 records: ${repairStatus}\n${await page.locator("#moRepairSummary").innerText()}`);
  assert.equal(await page.locator("#moApplyLayoutRepair").isEnabled(), true);
  const proposalText = await page.frameLocator("#moFinalPreview").locator(".mo-sheet").innerText();
  assert.match(proposalText, /VPL000001/u);
  assert.match(proposalText, /VPL000051/u);
  assert.match(proposalText, /Synthetic Receiver 1/u);
  assert.match(proposalText, /Synthetic Receiver 51/u);
  assert.ok((proposalText.match(/VPL000001/gu) ?? []).length >= 2, "exact tracking must fill both article-number and lower Intimation number fields");
  assert.ok((proposalText.match(/20100/gu) ?? []).length >= 2, "validated principal must be repeated in lower Intimation without adding commission");
  assert.ok((proposalText.match(/Synthetic Receiver 1/gu) ?? []).length >= 2, "Receiver name must appear in the upper party block and lower Intimation line");
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
  assert.equal(savedLayout.fields.length, 14);
  assert.equal(savedLayout.fields.find((field) => field.id === "tracking").xMm, 103);
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
  const diagnosticLines = beforeRepair.diagnostics.split(/\n/u).filter((line) => line.startsWith("Source row "));
  console.log(JSON.stringify({ lp061N100: {
    beforeRepair: { selectedRows: beforeRepair.visiblePair, count: diagnosticLines.length, firstIssues: diagnosticLines.slice(0, 4), downloadDisabled: beforeRepair.downloadDisabled, printDisabled: beforeRepair.printDisabled },
    repairStatus, savedFieldCount: savedLayout.fields.length,
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
