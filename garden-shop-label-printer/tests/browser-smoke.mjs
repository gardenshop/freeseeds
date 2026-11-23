import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { createCanvas, DOMMatrix, ImageData, loadImage, Path2D } from "@napi-rs/canvas";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, MultiFormatReader } from "@zxing/library";
import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evidence = resolve(process.env.LP_TEST_EVIDENCE_DIR ?? join(project, "test-evidence"));
const temporary = resolve(process.env.LP_TEST_TMP_DIR ?? "D:\\Temp\\kilo");
const baseUrl = "http://127.0.0.1:4174";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const hpSafeEdgeMm = 4.233 + 1;
const server = spawn(process.execPath, [join(project, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "4174", "--strictPort"], { cwd: project, stdio: "ignore", windowsHide: true, env: { ...process.env, VITE_MONITOR_URL: "http://127.0.0.1:4175" } });
const mappedPdfAuditEvents = [];
let captureMappedPdfAudit = false;
const monitoringStub = createServer((request, response) => {
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:4174");
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("vary", "Origin");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/events") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    let event;
    try { event = JSON.parse(body); } catch { response.writeHead(400).end(); return; }
    if (captureMappedPdfAudit && event.eventType === "PDF_GENERATED") {
      mappedPdfAuditEvents.push(event);
      console.log(JSON.stringify({ syntheticAuditCapture: event.eventType, rows: event.counts?.rows, pages: event.counts?.pages }));
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "SYNTHETIC_MONITOR_UNAVAILABLE" }));
  });
});
let browser;

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("VITE_SERVER_START_TIMEOUT");
}

function syntheticXlsx() {
  const xml = (value) => new TextEncoder().encode(value);
  return zipSync({
    "[Content_Types].xml": xml('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    "_rels/.rels": xml('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": xml('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": xml('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    "xl/styles.xml": xml('<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="00000000000"/></numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>'),
    "xl/worksheets/sheet1.xml": xml('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Order ID</t></is></c><c r="B1" t="inlineStr"><is><t>Name</t></is></c><c r="C1" t="inlineStr"><is><t>Cell #</t></is></c><c r="D1" t="inlineStr"><is><t>Address</t></is></c><c r="E1" t="inlineStr"><is><t>Tracking Number</t></is></c><c r="F1" t="inlineStr"><is><t>COD</t></is></c><c r="G1" t="inlineStr"><is><t>Product</t></is></c><c r="H1" t="inlineStr"><is><t>City</t></is></c><c r="I1" t="inlineStr"><is><t>Province</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>XLSX-SYN-001</t></is></c><c r="B2" t="inlineStr"><is><t>مصنوعی گاہک</t></is></c><c r="C2" s="1"><v>3330000000</v></c><c r="D2" t="inlineStr"><is><t>گلی نمبر ایک، نمونہ پتہ، مکان ۱۲</t></is></c><c r="E2" t="inlineStr"><is><t>VPL000001</t></is></c><c r="F2"><v>1250</v></c><c r="G2" t="inlineStr"><is><t>Synthetic Product</t></is></c><c r="H2" t="inlineStr"><is><t>Sahiwal</t></is></c><c r="I2" t="inlineStr"><is><t>Punjab</t></is></c></row></sheetData></worksheet>'),
  });
}

async function loadPdf(path, screenshotName) {
  const bytes = new Uint8Array(await readFile(path));
  const pdf = await PDFDocument.load(bytes);
  const rendered = await getDocument({ data: bytes, disableWorker: true, useSystemFonts: true }).promise;
  const firstPage = await rendered.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.4 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  globalThis.DOMMatrix ??= DOMMatrix;
  globalThis.ImageData ??= ImageData;
  globalThis.Path2D ??= Path2D;
  await firstPage.render({ canvasContext: context, viewport, canvasFactory: { create: (width, height) => { const value = createCanvas(width, height); return { canvas: value, context: value.getContext("2d") }; }, reset: (target, width, height) => { target.canvas.width = width; target.canvas.height = height; }, destroy: (target) => { target.canvas.width = 0; target.canvas.height = 0; } } }).promise;
  await import("node:fs/promises").then(({ writeFile }) => writeFile(join(evidence, screenshotName), canvas.toBuffer("image/png")));
  const textContent = await firstPage.getTextContent();
  const text = textContent.items.map((item) => item.str).join(" ");
  const operators = await firstPage.getOperatorList();
  return { pdf, page: pdf.getPage(0), pageCount: pdf.getPageCount(), text, hasRasterImage: operators.fnArray.some((op) => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) };
}

async function saveGeneratedPdf(page, path, timeout = 300000) {
  assert.equal(await page.locator("#savePdf").isDisabled(), false, `PDF control is disabled: ${await page.locator("body").innerText()}`);
  const downloadEvent = page.waitForEvent("download", { timeout });
  await page.locator("#savePdf").click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /^garden-shop-labels-[a-f0-9]+\.pdf$/u);
  await download.saveAs(path);
}

async function saveMoGeneratedPdf(page, path, expectedPages, kind = "blank") {
  const control = page.locator(kind === "draft" ? "#downloadMoDraftPdf" : "#downloadMoPdf");
  assert.equal(await control.isDisabled(), false, `MO PDF control is disabled: ${await page.locator("body").innerText()}`);
  const downloadEvent = page.waitForEvent("download", { timeout: 90000 }).then((download) => ({ download }), (error) => ({ error: error.message }));
  await control.click();
  await page.waitForFunction(() => {
    const status = document.querySelector("#moPdfStatus")?.textContent ?? "";
    return status.startsWith("MO PDF export failed") || status.startsWith("Export cancelled") || status.startsWith("Downloaded ");
  }, { timeout: 90000 }).catch(async (error) => { throw new Error(`${error.message}\nMO status=${await page.locator("#moPdfStatus").innerText()}`); });
  const status = await page.locator("#moPdfStatus").innerText();
  if (status.startsWith("MO PDF export failed") || status.startsWith("Export cancelled")) throw new Error(status);
  const result = await downloadEvent;
  if (result.error) throw new Error(`${result.error}\nMO status=${status}`);
  const download = result.download;
  assert.match(download.suggestedFilename(), kind === "draft" ? /^mo51-user-confirmed-draft-\d+-forms\.pdf$/u : /^mo51-manual-completion-\d+-forms\.pdf$/u);
  assert.doesNotMatch(download.suggestedFilename(), /\d{13}/u, "CNIC must not enter the generated filename");
  await download.saveAs(path);
  assert.equal(await page.locator('iframe[title="Temporary MO-51 PDF rasterizer"]').count(), 0, "successful export must remove temporary rasterizer frames");
  const bytes = Buffer.from(await readFile(path));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), expectedPages);
  for (const pdfPage of document.getPages()) {
    const { width, height } = pdfPage.getSize();
    assert.ok(Math.abs(width - (297 * 72 / 25.4)) < 0.01, `MO page width ${width}pt is not A4 landscape`);
    assert.ok(Math.abs(height - (210 * 72 / 25.4)) < 0.01, `MO page height ${height}pt is not A4 landscape`);
    assert.equal(pdfPage.getRotation().angle, 0, "physical page rotation remains unset");
  }
  assert.match(document.getTitle(), kind === "draft" ? /user-confirmed .*draft/u : /blank manual-completion/u);
  assert.doesNotMatch(`${document.getTitle()} ${document.getSubject() ?? ""} ${document.getKeywords() ?? ""}`, /0000012345678|00000-1234567-8/u, "CNIC must not enter PDF metadata");
  return { bytes, document };
}

async function saveMoLayoutPdf(page, path, expectedPages, timeout = 300000) {
  await page.waitForFunction(() => {
    const button = document.querySelector("#downloadMoLayoutPdf");
    const status = document.querySelector("#moMappingFitError")?.textContent ?? "";
    return Boolean(button && !button.disabled) || status.includes("Mapped layout fields require attention") || status.includes("Full-batch validation failed");
  }, undefined, { timeout: Math.min(timeout, 180000) });
  assert.equal(await page.locator("#downloadMoLayoutPdf").isDisabled(), false, `MO layout PDF disabled: ${await page.locator("#moMappingFitError").innerText()}`);
  assert.equal(await page.locator("#printMoBatch").isDisabled(), false, `Print MO Batch disabled after full-batch validation: ${await page.locator("#moMappingFitError").innerText()}`);
  const downloadEvent = page.waitForEvent("download", { timeout });
  let statusTimer;
  const exportFailure = new Promise((resolve) => {
    statusTimer = setInterval(async () => {
      const status = await page.locator("#moPdfStatus").innerText().catch(() => "");
      if (status.startsWith("MO PDF export failed") || status.startsWith("MO layout output failed") || status.startsWith("MO_PRINT_TARGET_REJECTED:") || status.startsWith("Export cancelled")) resolve({ error: status });
    }, 100);
  });
  let download;
  try {
    await page.locator("#downloadMoLayoutPdf").click();
    const outcome = await Promise.race([downloadEvent.then((result) => ({ download: result })), exportFailure]);
    if (outcome.error) throw new Error(outcome.error);
    download = outcome.download;
  } finally {
    clearInterval(statusTimer);
  }
  assert.match(download.suggestedFilename(), /^mo51-layout-batch-\d+-forms\.pdf$/u);
  const pathValue = path;
  await download.saveAs(pathValue);
  const bytes = Buffer.from(await readFile(pathValue));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), expectedPages);
  assert.equal(document.getTitle(), "MO-51 user-defined layout batch");
  for (const pdfPage of document.getPages()) {
    const { width, height } = pdfPage.getSize();
    assert.ok(Math.abs(width - (297 * 72 / 25.4)) < 0.01);
    assert.ok(Math.abs(height - (210 * 72 / 25.4)) < 0.01);
    assert.equal(pdfPage.getRotation().angle, 0);
  }
  return { bytes, document };
}

async function addMoLayoutField(page, source, xMm, yMm, widthMm = 42, heightMm = 8, fontSizePt = 10, wrap = false, alignment = "left", options = {}) {
  const face = options.face ?? "front";
  const overlay = page.locator(`[data-mo-editor-overlay="${face}"]`);
  if (options.nativeDrag) {
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("MO_LAYOUT_DROP_TARGET_MISSING");
    await page.locator(`.mo-source-chip[data-mo-layout-source="${source}"]`).first().dragTo(overlay, {
      targetPosition: { x: xMm / 297 * bounds.width, y: yMm / 210 * bounds.height },
    });
  } else {
    await page.evaluate(({ sourceId, faceName, x, y }) => {
      const chip = document.querySelector(`.mo-source-chip[data-mo-layout-source="${sourceId}"]`);
      const target = document.querySelector(`[data-mo-editor-overlay="${faceName}"]`);
      if (!chip || !target) throw new Error("MO_LAYOUT_DROP_TARGET_MISSING");
      const transfer = new DataTransfer();
      transfer.setData("application/x-mo-layout-source", sourceId);
      const rect = target.getBoundingClientRect();
      const drop = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperties(drop, {
        dataTransfer: { value: transfer },
        clientX: { value: rect.left + x / 297 * rect.width },
        clientY: { value: rect.top + y / 210 * rect.height },
      });
      target.dispatchEvent(drop);
    }, { sourceId: source, faceName: face, x: xMm, y: yMm });
  }
  await page.locator("#moLayoutWidth").waitFor();
  for (const [selector, value] of [["#moLayoutX", xMm], ["#moLayoutY", yMm], ["#moLayoutWidth", widthMm], ["#moLayoutHeight", heightMm], ["#moLayoutFontSize", fontSizePt]]) {
    const input = page.locator(selector);
    await input.fill(String(value));
    await input.press("Tab");
  }
  await page.locator("#moLayoutAlignment").selectOption(alignment);
  const wrapInput = page.locator("#moLayoutWrap");
  if (wrap) await wrapInput.check();
  else await wrapInput.uncheck();
  if (options.bold) {
    const bold = page.locator("#moLayoutBold");
    if ((await bold.getAttribute("aria-pressed")) !== "true") await bold.click();
  }
}

async function assertMoPointerGestures(page, source) {
  const selector = `.mo-editor-field[data-mo-layout-source="${source}"]`;
  const field = page.locator(selector).last();
  await field.click();
  const startX = Number(await page.locator("#moLayoutX").inputValue());
  const box = await field.boundingBox();
  assert.ok(box, "placed MO field must have a pointer hitbox");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 8, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction((before) => Number(document.querySelector("#moLayoutX")?.value) !== before, startX, { timeout: 5000 });
  const movedX = Number(await page.locator("#moLayoutX").inputValue());
  assert.notEqual(movedX, startX, "native pointer drag must move a placed field in millimetres");

  const beforeWidth = Number(await page.locator("#moLayoutWidth").inputValue());
  const beforeHeight = Number(await page.locator("#moLayoutHeight").inputValue());
  const handle = page.locator(`${selector} [data-mo-resize-handle]`).last();
  const handleBox = await handle.boundingBox();
  assert.ok(handleBox && handleBox.width >= 12 && handleBox.height >= 12, "selected field must expose a visible resize handle");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 24, handleBox.y + handleBox.height / 2 + 14, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction((before) => Number(document.querySelector("#moLayoutWidth")?.value) > before, beforeWidth, { timeout: 5000 });
  const afterWidth = Number(await page.locator("#moLayoutWidth").inputValue());
  const afterHeight = Number(await page.locator("#moLayoutHeight").inputValue());
  assert.ok(afterHeight > beforeHeight, "pointer resize must update field height");
  return { movedXmm: movedX, resizedWidthMm: afterWidth, resizedHeightMm: afterHeight };
}

async function assertMoEditorViewport(page) {
  const measurements = [];
  for (const width of [800, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator("#moFitToWidth").click();
    const geometry = await page.evaluate(() => {
      const editor = document.querySelector(".mo-layout-editor");
      const surface = document.querySelector(".mo-layout-surfaces");
      const stage = document.querySelector(".mo-editor-stage");
      const rect = (element) => { const box = element?.getBoundingClientRect(); return box ? { left: box.left, right: box.right, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth } : null; };
      return { viewport: innerWidth, editor: rect(editor), surface: rect(surface), stage: rect(stage), paletteVisible: Boolean(document.querySelector(".mo-layout-palette")?.getClientRects().length), propertiesVisible: Boolean(document.querySelector(".mo-layout-properties")?.getClientRects().length), bodyWidth: document.documentElement.scrollWidth };
    });
    assert.ok(geometry.editor && geometry.editor.left >= -1 && geometry.editor.right <= width + 1, `MO editor must fit viewport ${width}px: ${JSON.stringify(geometry.editor)}`);
    assert.ok(geometry.surface && geometry.stage && geometry.stage.left >= geometry.surface.left - 1 && geometry.stage.right <= geometry.surface.right + 1, `both A5 halves must fit the canvas at ${width}px: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.paletteVisible && geometry.propertiesVisible, `source and property panels remain reachable at ${width}px`);
    assert.ok(geometry.bodyWidth <= width + 1, `normal page zoom must not create horizontal body clipping at ${width}px`);
    const screenshot = `lp051-mo-editor-${width}.png`;
    await page.locator("#moLayoutEditor").screenshot({ path: join(evidence, screenshot) });
    measurements.push({ viewport: width, stageWidth: Math.round(geometry.stage.width), scalePercent: Math.round(geometry.stage.width / 1123 * 100), screenshot });
    await page.locator("#moLayoutEditor").screenshot({ path: join(evidence, `lp051-mo-editor-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.locator("#moFitToWidth").click();
  const beforeZoom = await page.locator(".mo-editor-stage").first().evaluate((stage) => stage.getBoundingClientRect().width);
  const coordinateBefore = await page.locator("#moLayoutX").inputValue();
  await page.locator("#moZoomIn").click();
  const afterZoom = await page.locator(".mo-editor-stage").first().evaluate((stage) => stage.getBoundingClientRect().width);
  assert.ok(afterZoom > beforeZoom, "zoom-in must enlarge the screen preview");
  assert.equal(await page.locator("#moLayoutX").inputValue(), coordinateBefore, "screen zoom must not change millimetre coordinates");
  await page.locator("#moZoomReset").click();
  const resetWidth = await page.locator(".mo-editor-stage").first().evaluate((stage) => stage.getBoundingClientRect().width);
  assert.ok(Math.abs(resetWidth - beforeZoom) < 1, "Reset Zoom must return to Fit to Width");
  return measurements;
}

async function assertMoOddBlank(download, count) {
  if (count % 2 !== 1) return;
  const lastPage = download.document.getPageCount();
  assertBlankRightHalf(await rasterPdfPage(download.bytes, 2, lastPage - 1));
  assertBlankRightHalf(await rasterPdfPage(download.bytes, 2, lastPage));
}

async function rasterPdfPage(bytes, scale = 4, pageNumber = 1) {
  globalThis.DOMMatrix ??= DOMMatrix;
  globalThis.ImageData ??= ImageData;
  globalThis.Path2D ??= Path2D;
  const document = await getDocument({ data: Uint8Array.from(bytes), disableWorker: true, useSystemFonts: true }).promise;
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvasFactory: { create: (width, height) => { const value = createCanvas(width, height); return { canvas: value, context: value.getContext("2d") }; }, reset: (target, width, height) => { target.canvas.width = width; target.canvas.height = height; }, destroy: (target) => { target.canvas.width = 0; target.canvas.height = 0; } } }).promise;
  return canvas;
}

function assertBlankRightHalf(canvas) {
  const split = Math.floor(canvas.width / 2);
  const image = canvas.getContext("2d").getImageData(split, 0, canvas.width - split, canvas.height).data;
  let inkPixels = 0;
  for (let index = 0; index < image.length; index += 4) {
    if (image[index] < 250 || image[index + 1] < 250 || image[index + 2] < 250) inkPixels += 1;
  }
  assert.equal(inkPixels, 0, `odd unused PDF half must be blank; found ${inkPixels} ink pixels`);
}

async function compareMoPdfWithPreview(page, face, pdfBytes, pageNumber, layout = false) {
  const cleanPreview = layout && await page.locator("#moFinalPreview").count() > 0 && await page.locator(".mo-clean-preview").isVisible();
  const previewFrame = cleanPreview
    ? "#moFinalPreview"
    : face === "front"
      ? layout ? "#moLayoutFrontPreview" : "#moFrontPreview"
      : layout ? "#moLayoutBackPreview" : "#moBackPreview";
  const previewBytes = await page.frameLocator(previewFrame).locator(".mo-sheet").screenshot();
  const previewImage = await loadImage(previewBytes);
  const raster = await rasterPdfPage(pdfBytes, 1, pageNumber);
  const normalized = createCanvas(raster.width, raster.height);
  normalized.getContext("2d").drawImage(previewImage, 0, 0, raster.width, raster.height);
  const left = raster.getContext("2d").getImageData(0, 0, raster.width, raster.height).data;
  const right = normalized.getContext("2d").getImageData(0, 0, normalized.width, normalized.height).data;
  let difference = 0;
  for (let index = 0; index < left.length; index += 4) {
    difference += Math.abs(left[index] - right[index]) + Math.abs(left[index + 1] - right[index + 1]) + Math.abs(left[index + 2] - right[index + 2]);
  }
  const meanDifference = difference / (raster.width * raster.height * 3 * 255);
  assert.ok(meanDifference < 0.1, `${face} PDF raster should match its preview; normalized mean difference ${meanDifference}`);
  return raster;
}

async function setMoMapping(page, sourceIndex, key, value) {
  const overrides = page.locator(".mo-manual-overrides,.mo-mapping-review");
  if (await overrides.count() && (await overrides.first().getAttribute("open")) === null) await overrides.first().locator(":scope > summary").click();
  const card = page.locator(`[data-mo-review-index="${sourceIndex}"]`);
  if ((await card.getAttribute("open")) === null) await card.locator("summary").click();
  const choice = card.locator(`[data-mo-map-choice-key="${key}"][data-mo-map-choice-value="${value}"]`);
  let expectedStatePosition;
  if (await choice.count()) {
    await choice.click();
    const statePosition = { articleNumberSource: 0, principalSource: 1, senderSource: 2, receiverSource: 3 }[key];
    expectedStatePosition = statePosition;
    if (statePosition !== undefined) {
      await page.waitForFunction(({ index, position, expected }) => {
        const item = (document.querySelector("[data-mo-view]")?.getAttribute("data-mo-pending-state") ?? "").split("|").find((entry) => entry.startsWith(`${index}:`));
        return item?.split(":")[1]?.split("/")[position] === expected;
      }, { index: sourceIndex, position: statePosition, expected: value }).catch(async (error) => {
        throw new Error(`${error.message}\nPending=${await page.locator("[data-mo-view]").getAttribute("data-mo-pending-state")}\nConfirmed=${await page.locator("[data-mo-view]").getAttribute("data-mo-mapping-state")}\nChoice buttons=${await page.locator(`[data-mo-review-index="${sourceIndex}"] [data-mo-map-choice-key="${key}"]`).count()}`);
      });
      await page.waitForFunction(({ index, position, expected }) => {
        const item = (document.querySelector("[data-mo-view]")?.getAttribute("data-mo-mapping-state") ?? "").split("|").find((entry) => entry.startsWith(`${index}:`));
        return item?.split(":")[1]?.split("/")[position] === expected;
      }, { index: sourceIndex, position: statePosition, expected: value });
    }
  } else {
    const control = card.locator(`[data-mo-map-key="${key}"]`);
    await control.fill(value);
    await page.locator("#confirmMoMappings").click();
    await page.waitForFunction(() => /Confirmed \d+ MO-session row choices/u.test(document.querySelector("#moPdfStatus")?.textContent ?? ""));
  }
  if (expectedStatePosition !== undefined) {
    await page.waitForFunction(({ index, position, expected }) => {
      const item = (document.querySelector("[data-mo-view]")?.getAttribute("data-mo-mapping-state") ?? "").split("|").find((entry) => entry.startsWith(`${index}:`));
      return item?.split(":")[1]?.split("/")[position] === expected;
    }, { index: sourceIndex, position: expectedStatePosition, expected: value }, { timeout: 5000 }).catch(async (error) => {
      throw new Error(`${error.message}\nPending=${await page.locator("[data-mo-view]").getAttribute("data-mo-pending-state")}\nConfirmed=${await page.locator("[data-mo-view]").getAttribute("data-mo-mapping-state")}\nStatus=${await page.locator("#moPdfStatus").innerText()}`);
    });
  }
  const fieldByChoice = {
    articleNumberSource: "articleNumber",
    principalSource: "principal",
    senderSource: "senderName",
    receiverSource: "receiverName",
    manualArticleNumber: "articleNumber",
    manualPrincipal: "principal",
    manualSenderName: "senderName",
    manualSenderAddress: "senderAddress",
    manualSenderPhone: "senderPhone",
    manualReceiverName: "receiverName",
    manualReceiverAddress: "receiverAddress",
    manualReceiverPhone: "receiverPhone",
  };
  const field = value && value !== "blank" && !(value === "manual" && key.endsWith("Source")) ? fieldByChoice[key] ?? null : null;
  await page.waitForFunction(({ index, expectedField }) => {
    const form = document.querySelector("#moFrontPreview")?.contentDocument?.querySelector(`.page[data-mo-source-index="${index}"]`);
    return Boolean(form) && (expectedField === null || form.dataset.moVisibleFields?.split(",").includes(expectedField));
  }, { index: sourceIndex, expectedField: field }).catch(async (error) => {
    throw new Error(`${error.message}\nConfirm status=${await page.locator("#moPdfStatus").innerText()}\nMO mapping state=${await page.locator("[data-mo-view]").getAttribute("data-mo-mapping-state")}\nCard state=${JSON.stringify({ sender: await page.locator(`[data-mo-review-index="${sourceIndex}"]`).getAttribute("data-mo-sender-source"), receiver: await page.locator(`[data-mo-review-index="${sourceIndex}"]`).getAttribute("data-mo-receiver-source"), resolved: await page.locator(`[data-mo-review-index="${sourceIndex}"]`).getAttribute("data-mo-resolved-fields") })}\nControls=${JSON.stringify(await page.locator("[data-mo-map-index][data-mo-map-key]").evaluateAll((controls) => controls.map((input) => ({ key: input.getAttribute("data-mo-map-key"), index: input.getAttribute("data-mo-map-index") }))))}`);
  });
}

async function compareMoPdfPages(firstBytes, secondBytes, pageNumber) {
  const first = await rasterPdfPage(firstBytes, 1, pageNumber);
  const second = await rasterPdfPage(secondBytes, 1, pageNumber);
  const left = first.getContext("2d").getImageData(0, 0, first.width, first.height).data;
  const right = second.getContext("2d").getImageData(0, 0, second.width, second.height).data;
  let difference = 0;
  for (let index = 0; index < left.length; index += 4) difference += Math.abs(left[index] - right[index]) + Math.abs(left[index + 1] - right[index + 1]) + Math.abs(left[index + 2] - right[index + 2]);
  return difference / (first.width * first.height * 3 * 255);
}

function rasterDarkBounds(canvas, box, scale = 4) {
  const pxPerMm = scale * 72 / 25.4;
  const x1 = Math.max(0, Math.floor(box.x * pxPerMm));
  const y1 = Math.max(0, Math.floor(box.y * pxPerMm));
  const x2 = Math.min(canvas.width, Math.ceil((box.x + box.width) * pxPerMm));
  const y2 = Math.min(canvas.height, Math.ceil((box.y + box.height) * pxPerMm));
  const data = canvas.getContext("2d").getImageData(x1, y1, x2 - x1, y2 - y1).data;
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  for (let y = 0; y < y2 - y1; y += 1) for (let x = 0; x < x2 - x1; x += 1) {
    const pixel = (y * (x2 - x1) + x) * 4;
    if (data[pixel] < 64 && data[pixel + 1] < 64 && data[pixel + 2] < 64) { minX = Math.min(minX, x + x1); minY = Math.min(minY, y + y1); maxX = Math.max(maxX, x + x1); maxY = Math.max(maxY, y + y1); }
  }
  assert.ok(maxX >= 0, "barcode bars must exist within their expected PDF cell");
  const result = { left: minX / pxPerMm, top: minY / pxPerMm, right: (maxX + 1) / pxPerMm, bottom: (maxY + 1) / pxPerMm };
  return { ...result, quiet: { left: result.left - box.x, right: box.x + box.width - result.right, top: result.top - box.y, bottom: box.y + box.height - result.bottom } };
}

try {
  await mkdir(evidence, { recursive: true });
  await mkdir(temporary, { recursive: true });
  await writeFile(join(temporary, "garden-shop-label-printer-synthetic.xlsx"), Buffer.from(syntheticXlsx()));
  await new Promise((resolveListen, rejectListen) => {
    monitoringStub.once("error", rejectListen);
    monitoringStub.listen(4175, "127.0.0.1", resolveListen);
  });
  await waitForServer();
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.UTC(2026, 10, 15, 12);
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    Object.defineProperty(window, "Date", { configurable: true, value: FixedDate });
    const nativeRandom = Crypto.prototype.getRandomValues;
    let state = 0x6d2b79f5;
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      writable: true,
      value(array) {
        if (array instanceof Uint32Array && array.length === 1) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          array[0] = state >>> 0;
          return array;
        }
        return nativeRandom.call(this, array);
      },
    });
  });
  const errors = [];
  const failedRequests = [];
  const allRequests = [];
  let moSourceDataRequested = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("request", (request) => {
    allRequests.push(request.url());
    const content = `${request.url()} ${request.postData() ?? ""}`;
    if (/Synthetic Receiver|Synthetic address|آزمائشی|0000012345678|00000-1234567-8|\b03\d{9}\b|VPL000001|VPP000022|20100/u.test(content)) moSourceDataRequested = true;
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#backToAdmin").getAttribute("href"), "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/");
  await page.locator("#workbook").setInputFiles({ name: "synthetic-import.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(syntheticXlsx()) });
  await page.locator("#applyMapping").waitFor().catch(async (error) => { throw new Error(`${error.message}\nWorkbook mapping page: ${await page.locator("body").innerText()}`); });
  await page.locator("#applyMapping").click();
  await page.waitForTimeout(1500);
  assert.ok((await page.locator("body").innerText()).includes("Monitoring unavailable. Label work is safe and was not lost."), JSON.stringify({ body: await page.locator("body").innerText(), failedRequests }));
  assert.match(await page.locator("body").innerText(), /XLSX-SYN-001/);
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => document.querySelector(".sheet canvas[data-barcode]")?.dataset.verified === "true", { timeout: 30000 });
  const firstPrintedReference = await page.locator(".sheet .printed-reference").first().innerText();
  assert.match(firstPrintedReference, /^FS-2611-\d{5}$/u);
  const importedReferences = await page.locator(".sheet .printed-reference").allInnerTexts();
  assert.equal(new Set(importedReferences).size, importedReferences.length, "distinct source orders must have unique printed references");
  assert.equal(await page.locator(".sheet .contact-number").first().innerText(), "03330000000");
  assert.equal(await page.locator(".sheet .tracking-value").first().innerText(), "VPL000001");
  const trackingGeometry = await page.locator(".sheet .tracking-value").first().evaluate((el) => { const value = el.getBoundingClientRect(); const barcode = el.parentElement.querySelector(".barcode-canvas").getBoundingClientRect(); return { valueBottom: value.bottom, barcodeTop: barcode.top, delta: barcode.top - value.bottom }; });
  assert.ok(trackingGeometry.delta >= -2, `tracking value must sit above the barcode: ${JSON.stringify(trackingGeometry)}`);
  assert.doesNotMatch(await page.locator(".sheet").innerText(), /TRACKING NUMBER/u);
  assert.equal(await page.locator(".sheet .label-warning").count(), 0, "warnings must stay out of the label");
  assert.equal(await page.locator(".sheet .printed-reference").first().evaluate((el) => getComputedStyle(el).fontWeight), "500");
  const contactFit = await page.locator(".sheet .contact-number").first().evaluate((el) => ({ overflow: el.classList.contains("text-overflow"), text: el.textContent, fontSize: getComputedStyle(el).fontSize, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }));
  assert.equal(contactFit.overflow, false, JSON.stringify(contactFit));
  assert.ok(await page.locator(".sheet .contact-number").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "normalized mobile must fit completely in the contact row");
  assert.match(await page.locator(".sheet .receiver-name").first().innerText(), /مصنوعی/);
  assert.match(await page.locator(".sheet .address-text").first().innerText(), /گلی نمبر ایک/);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#workbook").setInputFiles({ name: "synthetic-import.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(syntheticXlsx()) });
  await page.locator("#applyMapping").click();
  await page.locator('[data-view="preview"]').first().click();
  assert.equal(await page.locator(".sheet .printed-reference").first().innerText(), firstPrintedReference, "reimports and reprints must keep the original printed reference");
  await page.locator('[data-view="review"]').first().click();
  await page.locator("#newBatch").click();
  await page.locator("#sample").click();
  await page.locator("#applyMapping").click();
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 3 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  const samplePrintedReference = await page.locator(".sheet .printed-reference").first().innerText();
  const geometry = await page.locator(".sheet").evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    const label = sheet.querySelector(".label").getBoundingClientRect();
    const slots = [...sheet.children];
    const mm = (px) => px * 25.4 / 96;
    const offset = (index) => { const box = slots[index].getBoundingClientRect(); return [mm(box.left - rect.left), mm(box.top - rect.top)]; };
    return { sheetWidthMm: mm(rect.width), sheetHeightMm: mm(rect.height), labelWidthMm: mm(label.width), labelHeightMm: mm(label.height), slotCount: slots.length, firstRow: [offset(0)[0], offset(1)[0], offset(2)[0]], firstColumn: [offset(0)[1], offset(3)[1], offset(6)[1], offset(9)[1], offset(12)[1], offset(15)[1]] };
  });
  assert.ok(Math.abs(geometry.sheetWidthMm - 210) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.sheetHeightMm - 297) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.labelWidthMm - 65) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.labelHeightMm - 44) < 0.1, JSON.stringify(geometry));
  assert.equal(geometry.slotCount, 18);
  assert.deepEqual(geometry.firstRow.map((value) => Math.round(value * 10) / 10), [6.5, 72.5, 138.5]);
  assert.deepEqual(geometry.firstColumn.map((value) => Math.round(value)), [14, 59, 104, 149, 194, 239]);
  assert.ok(Math.abs(geometry.firstRow[1] - geometry.firstRow[0] - 65 - 1) < 0.02);
  assert.ok(Math.abs(geometry.firstRow[2] - geometry.firstRow[1] - 65 - 1) < 0.02);
  assert.ok(Math.abs(geometry.firstColumn[1] - geometry.firstColumn[0] - 44 - 1) < 0.02);
  assert.ok(await page.getByText("Near by:").count() > 0);
  assert.ok(await page.getByText("TO:").count() > 0);
  assert.equal(await page.locator(".sheet .vpl-box").first().getAttribute("aria-label"), "VPL 1250+75");
  assert.equal((await page.locator(".sheet .vpl-amount").first().innerText()).replace(/\s+/gu, ""), "1250+75");
  assert.equal(await page.locator(".sheet .vpl-amount").first().evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator(".sheet .vpl-amount").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "VPL amount must not clip inside its capsule");
  assert.equal(await page.locator(".sheet .footer-from").first().innerText(), "From:");
  assert.equal(await page.locator(".sheet .footer-sender").first().innerText(), "Garden Shop");
  assert.equal(await page.locator(".sheet .footer-address").first().innerText(), "C/o City Post Office, Sahiwal");
  assert.equal(await page.locator(".sheet .city-text").first().evaluate((el) => getComputedStyle(el, "::before").content), "none");
  assert.equal(await page.locator(".individual-preview .contact-number").first().innerText(), "03001234567");
  assert.equal(await page.locator(".individual-preview .contact-number").first().evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator(".individual-preview .contact-number").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "individual phone value must not clip");
  await page.screenshot({ path: join(evidence, "label-preview-synthetic.png"), fullPage: true });
  const labelScreenshot = await page.locator('.sheet .label[data-label-index="0"]').screenshot({ animations: "disabled" });
  await writeFile(join(evidence, "label-output-synthetic.png"), labelScreenshot);
  const labelBaselinePath = join(project, "test-evidence", "approved-label-layout.png");
  if (process.env.UPDATE_LABEL_BASELINE === "1") {
    await writeFile(labelBaselinePath, labelScreenshot);
  } else {
    assert.ok(existsSync(labelBaselinePath), "approved-label-layout.png baseline is required; do not silently regenerate it");
    const [actualImage, baselineImage] = await Promise.all([loadImage(labelScreenshot), loadImage(labelBaselinePath)]);
    assert.deepEqual([actualImage.width, actualImage.height], [baselineImage.width, baselineImage.height], "approved label screenshot dimensions changed");
    const canvas = createCanvas(actualImage.width, actualImage.height);
    const context = canvas.getContext("2d");
    context.drawImage(actualImage, 0, 0);
    const actualPixels = context.getImageData(0, 0, actualImage.width, actualImage.height).data;
    context.clearRect(0, 0, actualImage.width, actualImage.height);
    context.drawImage(baselineImage, 0, 0);
    const baselinePixels = context.getImageData(0, 0, baselineImage.width, baselineImage.height).data;
    let changedPixels = 0;
    for (let offset = 0; offset < actualPixels.length; offset += 4)
      if (Math.max(Math.abs(actualPixels[offset] - baselinePixels[offset]), Math.abs(actualPixels[offset + 1] - baselinePixels[offset + 1]), Math.abs(actualPixels[offset + 2] - baselinePixels[offset + 2])) > 32) changedPixels += 1;
    const difference = changedPixels / (actualImage.width * actualImage.height);
    assert.ok(difference <= 0.015, `approved label screenshot differs by ${(difference * 100).toFixed(2)}%`);
  }
  const previewFieldsBeforePrint = await page.locator(".sheet .label").first().evaluate((label) => {
    const mm = (px) => px * 25.4 / 96;
    const labelBox = label.getBoundingClientRect();
    return [".vpl-box", ".barcode-canvas", ".order-product-frame", ".contact-divider", ".to-border", ".receiver-name", ".address-text", ".product-row-frame", ".footer-address"].map((selector) => {
      const box = label.querySelector(selector).getBoundingClientRect();
      return [mm(box.left - labelBox.left), mm(box.top - labelBox.top), mm(box.width), mm(box.height)];
    });
  });
  const readFields = (root) => root.evaluate((label) => {
    const mm = (px) => px * 25.4 / 96;
    const labelBox = label.getBoundingClientRect();
    return [".vpl-box", ".barcode-canvas", ".order-product-frame", ".contact-divider", ".to-border", ".receiver-name", ".address-text", ".product-row-frame", ".footer-address"].map((selector) => {
      const box = label.querySelector(selector).getBoundingClientRect();
      return [mm(box.left - labelBox.left), mm(box.top - labelBox.top), mm(box.width), mm(box.height)];
    });
  });
  const previewFields = previewFieldsBeforePrint;
  await page.locator('[data-view="print"]').first().click();
  const printDisabled = await page.locator("#printNow").isDisabled();
  assert.equal(printDisabled, false, `sample records unexpectedly blocked: ${await page.locator("body").innerText()}`);
  const colorToggle = page.locator("#colorAccent");
  assert.equal(await colorToggle.isChecked(), false, "black-and-white is the default print mode");
  await colorToggle.check();
  await page.locator('[data-view="preview"]').first().click();
  assert.equal(await page.locator(".sheet .footer-sender").first().evaluate((el) => getComputedStyle(el).color), "rgb(35, 97, 45)");
  await page.locator('[data-view="print"]').first().click();
  await page.locator("#colorAccent").uncheck();
  const printPopupEvent = page.waitForEvent("popup");
  await page.locator("#printNow").click();
  const printPopup = await printPopupEvent;
  await printPopup.waitForLoadState("load");
  await printPopup.waitForFunction(() => [...document.styleSheets].some((sheet) => sheet.href?.endsWith("/label.css")) && document.querySelector(".print-sheet .label .to-heading"));
  const printGeometry = await printPopup.locator(".print-sheet").evaluate((sheet) => {
    const mm = (px) => px * 25.4 / 96;
    const page = sheet.getBoundingClientRect();
    const label = sheet.querySelector(".label").getBoundingClientRect();
    return { pageWidthMm: mm(page.width), pageHeightMm: mm(page.height), labelWidthMm: mm(label.width), labelHeightMm: mm(label.height) };
  });
  assert.ok(Math.abs(printGeometry.pageWidthMm - 210) < 0.1, JSON.stringify(printGeometry));
  assert.ok(Math.abs(printGeometry.pageHeightMm - 297) < 0.1, JSON.stringify(printGeometry));
  assert.ok(Math.abs(printGeometry.labelWidthMm - 65) < 0.1, JSON.stringify(printGeometry));
  assert.ok(Math.abs(printGeometry.labelHeightMm - 44) < 0.1, JSON.stringify(printGeometry));
  const printFields = await readFields(printPopup.locator(".print-sheet .label").first());
  previewFields.forEach((field, index) => field.forEach((value, coordinate) => assert.ok(Math.abs(value - printFields[index][coordinate]) < 0.15, `preview/print geometry mismatch ${index}/${coordinate}: preview ${value}, print ${printFields[index][coordinate]}`)));
  await printPopup.screenshot({ path: join(evidence, "browser-print-sheet.png"), fullPage: true });
  await printPopup.close();
  const samplePath = join(evidence, "synthetic-sample.pdf");
  await saveGeneratedPdf(page, samplePath);
  const samplePdf = await loadPdf(samplePath, "pdf-sample-page.png");
  assert.equal(samplePdf.pageCount, 1);
  assert.ok(Math.abs(samplePdf.page.getSize().width - 595.2756) < 0.01);
  assert.ok(Math.abs(samplePdf.page.getSize().height - 841.8898) < 0.01);
  assert.match(samplePdf.text, /FS-\d{4}-\d{5}/);
  assert.doesNotMatch(samplePdf.text, /GS-TEST-001/);
  assert.match(samplePdf.text, /VPL/);
  assert.match(samplePdf.text, /1250/u);
  assert.match(samplePdf.text, /\+75/u);
  assert.match(samplePdf.text, /VPL000001/);
  assert.match(samplePdf.text, /Near by:/);
  assert.match(samplePdf.text, /To:/);
  assert.match(samplePdf.text, /C\/o City Post Office, Sahiwal/);
  assert.doesNotMatch(samplePdf.text, /C\/o City Post Office, Sahiwal, Punjab/);
  assert.doesNotMatch(samplePdf.text, /EDIT REQUIRED/);
  assert.equal(samplePdf.hasRasterImage, false, "PDF barcode must stay vector");

  const prefixPage = await browser.newPage({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  await prefixPage.addInitScript(() => Object.defineProperty(window, "print", { configurable: true, value: () => { window.__labelPrintRequested = true; } }));
  await prefixPage.goto(baseUrl, { waitUntil: "networkidle" });
  const prefixHeaders = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark"];
  const prefixRows = [
    ["PREFIX-RGL", "Synthetic RGL Receiver", "03300000031", "Synthetic RGL Road", "rgl001", "50000", "RGL Product", "Sahiwal", "Punjab", "RGL Market"],
    ["PREFIX-UMS", "Synthetic UMS Receiver", "03300000032", "Synthetic UMS Road", "ums002", "", "UMS Product", "Multan", "Punjab", "UMS Market"],
    ["PREFIX-VPL", "Synthetic VPL Receiver", "03300000033", "Synthetic VPL Road", "vpl003", "25,000", "VPL Product", "Okara", "Punjab", "VPL Market"],
    ["PREFIX-VPP", "Synthetic VPP Receiver", "03300000034", "Synthetic VPP Road", "vpp004", "65000", "VPP Product", "Lahore", "Punjab", "VPP Market"],
  ];
  const prefixQuote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const prefixCsv = [prefixHeaders, ...prefixRows].map((row) => row.map(prefixQuote).join(",")).join("\r\n");
  await prefixPage.locator("#workbook").setInputFiles({ name: "synthetic-prefixes.csv", mimeType: "text/csv", buffer: Buffer.from(prefixCsv) });
  await prefixPage.locator("#applyMapping").waitFor();
  await prefixPage.locator("#applyMapping").click();
  await prefixPage.locator('[data-view="preview"]').first().click();
  await prefixPage.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 4 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 }).catch(async (error) => { throw new Error(`${error.message}\nPrefix preview: ${await prefixPage.locator("body").innerText()}\nBarcodes: ${JSON.stringify(await prefixPage.locator(".sheet canvas[data-barcode]").evaluateAll((nodes) => nodes.map((node) => ({ source: node.dataset.source, verified: node.dataset.verified }))))}`); });
  assert.equal(await prefixPage.locator('.sheet .label[data-tracking-prefix="RGL"] .vpl-box').count(), 0);
  assert.equal(await prefixPage.locator('.sheet .label[data-tracking-prefix="UMS"] .vpl-box').count(), 0);
  assert.equal((await prefixPage.locator('.sheet .label[data-tracking-prefix="VPL"] .vpl-box .vpl-amount').innerText()).replace(/\s+/gu, ""), "25000+175");
  assert.equal((await prefixPage.locator('.sheet .label[data-tracking-prefix="VPP"] .vpl-box .vpl-amount').innerText()).replace(/\s+/gu, ""), "65000+375");
  assert.equal(await prefixPage.locator('.sheet .label[data-tracking-prefix="RGL"] .barcode-canvas').getAttribute("data-source"), "rgl001", "prefix normalization must not modify the barcode value");
  assert.equal(await prefixPage.locator('.sheet .label[data-tracking-prefix="VPL"] .vpl-commission').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize) / Number.parseFloat(getComputedStyle(el.parentElement.querySelector(".vpl-declared")).fontSize)), 0.3);
  const commissionLine = await prefixPage.locator('.sheet .label[data-tracking-prefix="VPL"] .vpl-amount').evaluate((el) => {
    const amount = el.querySelector(".vpl-declared").getBoundingClientRect(); const fee = el.querySelector(".vpl-commission").getBoundingClientRect();
    return { sameLine: fee.left >= amount.right - 0.5 && fee.top < amount.bottom && fee.bottom > amount.top, amount, fee };
  });
  assert.equal(commissionLine.sameLine, true, JSON.stringify(commissionLine));
  const expandedDestination = await prefixPage.locator('.sheet .label[data-tracking-prefix="RGL"] .destination').evaluate((el) => {
    const mm = (px) => px * 25.4 / 96;
    const label = el.closest(".label").getBoundingClientRect(); const box = el.getBoundingClientRect();
    return { y: mm(box.top - label.top), height: mm(box.height), city: el.querySelector(".city-text").textContent, province: el.querySelector(".province-text").textContent };
  });
  assert.ok(Math.abs(expandedDestination.y - 0.5) < 0.03, JSON.stringify(expandedDestination));
  assert.ok(Math.abs(expandedDestination.height - 14) < 0.03, JSON.stringify(expandedDestination));
  assert.equal(expandedDestination.city, "Sahiwal");
  assert.equal(expandedDestination.province, "Punjab");
  await prefixPage.locator(".sheet").screenshot({ path: join(evidence, "prefix-layout-samples.png") });
  await prefixPage.locator('[data-view="print"]').first().click();
  assert.equal(await prefixPage.locator("#printNow").isDisabled(), false, `valid prefix records must print: ${await prefixPage.locator("body").innerText()}`);
  const prefixPrintEvent = prefixPage.waitForEvent("popup");
  await prefixPage.locator("#printNow").click();
  const prefixPrint = await prefixPrintEvent;
  await prefixPrint.waitForLoadState("load");
  const prefixVisibleAmountBoxes = await prefixPrint.locator(".print-sheet .vpl-box").count();
  assert.equal(prefixVisibleAmountBoxes, 2);
  assert.equal(await prefixPrint.locator('.print-sheet [data-tracking-prefix="RGL"] .destination').count(), 1);
  assert.equal((await prefixPrint.locator('.print-sheet [data-tracking-prefix="VPL"] .vpl-amount').innerText()).replace(/\s+/gu, ""), "25000+175");
  assert.equal((await prefixPrint.locator('.print-sheet [data-tracking-prefix="VPP"] .vpl-amount').innerText()).replace(/\s+/gu, ""), "65000+375");
  await prefixPrint.screenshot({ path: join(evidence, "prefixes-image-print.png"), fullPage: true });
  await prefixPrint.close();
  const prefixPdfPath = join(evidence, "synthetic-prefixes.pdf");
  await saveGeneratedPdf(prefixPage, prefixPdfPath);
  const prefixPdf = await loadPdf(prefixPdfPath, "prefixes-pdf-page.png");
  assert.equal(prefixPdf.pageCount, 1);
  assert.match(prefixPdf.text, /25000/u);
  assert.match(prefixPdf.text, /\+175/u);
  assert.match(prefixPdf.text, /65000/u);
  assert.match(prefixPdf.text, /\+375/u);
  assert.doesNotMatch(prefixPdf.text, /50000|40000|\+0/u, "RGL/UMS declared amounts and commissions must not print");

  await prefixPage.locator('[data-view="review"]').first().click();
  await prefixPage.locator("#newBatch").click();
  const invalidRows = [
    ["PREFIX-UNKNOWN", "Synthetic Unknown Receiver", "03300000041", "Synthetic Unknown Road", "XYZ001", "25000", "Unknown Product", "Sahiwal", "Punjab", "Unknown Market"],
    ["PREFIX-OVER", "Synthetic Over Receiver", "03300000042", "Synthetic Over Road", "VPL-OVER001", "100001", "Over Product", "Multan", "Punjab", "Over Market"],
  ];
  const invalidCsv = [prefixHeaders, ...invalidRows].map((row) => row.map(prefixQuote).join(",")).join("\r\n");
  await prefixPage.locator("#workbook").setInputFiles({ name: "synthetic-invalid-prefixes.csv", mimeType: "text/csv", buffer: Buffer.from(invalidCsv) });
  await prefixPage.locator("#applyMapping").waitFor();
  await prefixPage.locator("#applyMapping").click();
  await prefixPage.locator('[data-view="preview"]').first().click();
  await prefixPage.locator('[data-view="print"]').first().click();
  assert.equal(await prefixPage.locator("#printNow").isDisabled(), true);
  assert.match(await prefixPage.locator("body").innerText(), /Unsupported tracking prefix/u);
  await prefixPage.locator('[data-view="review"]').first().click();
  assert.match(await prefixPage.locator('[data-edit="1"]').evaluate((el) => el.closest("tr").querySelector(".warning-badge").title), /exceeds Rs\. 100,000/u);
  await prefixPage.locator('[data-edit="1"]').click();
  assert.equal(await prefixPage.locator('.edit-form input[name="cod"]').inputValue(), "100001");
  await prefixPage.close();

  await page.locator("#paperPreset").selectOption("CUSTOM");
  assert.ok(await page.getByText(/only 0\.25 mm side and 0\.1675 mm top\/bottom margins/).count() > 0, "custom stock must show the narrow-margin warning");
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  assert.equal(await page.locator(".sheet .printed-reference").first().innerText(), samplePrintedReference, "paper switching must preserve label references");
  const customGeometry = await page.locator(".sheet").evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    const mm = (px) => px * 25.4 / 96;
    const slots = [...sheet.children];
    const offset = (index) => { const box = slots[index].getBoundingClientRect(); return [mm(box.left - rect.left), mm(box.top - rect.top)]; };
    return { width: mm(rect.width), height: mm(rect.height), slots: sheet.children.length, labels: [...sheet.querySelectorAll(".label")].length, columns: [offset(0)[0], offset(1)[0], offset(2)[0]], rows: [0, 3, 6, 9, 12, 15].map((slot) => offset(slot)[1]) };
  });
  assert.ok(Math.abs(customGeometry.width - 190.5) < 0.1, JSON.stringify(customGeometry));
  assert.ok(Math.abs(customGeometry.height - 254) < 0.1, JSON.stringify(customGeometry));
  assert.equal(customGeometry.slots, 18);
  assert.equal(customGeometry.labels, 3);
  [0.25, 63.75, 127.25].forEach((expected, index) => assert.ok(Math.abs(customGeometry.columns[index] - expected) < 0.03, `custom column ${index} start drifted: ${customGeometry.columns[index]} mm`));
  [0.1675, 42.5005, 84.8335, 127.1665, 169.4995, 211.8325].forEach((expected, index) => assert.ok(Math.abs(customGeometry.rows[index] - expected) < 0.03, `custom row ${index} start drifted: ${customGeometry.rows[index]} mm`));
  await page.locator('[data-view="print"]').first().click();
  assert.equal(await page.locator("#hpP2055SafeArea").isChecked(), true, "the custom print preset must default to measured P2055dn safe-area insets");
  await page.context().addInitScript(() => Object.defineProperty(window, "print", { configurable: true, value: () => { window.__labelPrintRequested = true; window.__moPrintRequested = true; } }));
  const customPrintPopupEvent = page.waitForEvent("popup");
  await page.locator("#printNow").click();
  const customPrintPopup = await customPrintPopupEvent;
  await customPrintPopup.waitForLoadState("load");
  await customPrintPopup.waitForFunction(() => [...document.querySelectorAll(".print-sheet canvas[data-barcode]")].every((canvas) => canvas.width > 0));
  assert.equal(await customPrintPopup.locator("body").evaluate((body) => getComputedStyle(body).marginTop), "0px", "custom screen preview must not add the old 12 mm screen-only top offset");
  const customPrintGeometry = await customPrintPopup.locator(".print-sheet").evaluate((sheet) => {
    const mm = (px) => px * 25.4 / 96;
    const page = sheet.getBoundingClientRect();
    const label = sheet.querySelector(".label").getBoundingClientRect();
    return { width: mm(page.width), height: mm(page.height), labelWidth: mm(label.width), labelHeight: mm(label.height) };
  });
  assert.ok(Math.abs(customPrintGeometry.width - 190.5) < 0.1, JSON.stringify(customPrintGeometry));
  assert.ok(Math.abs(customPrintGeometry.height - 254) < 0.1, JSON.stringify(customPrintGeometry));
  assert.ok(Math.abs(customPrintGeometry.labelWidth - 63) < 0.1, JSON.stringify(customPrintGeometry));
  assert.ok(Math.abs(customPrintGeometry.labelHeight - 42) < 0.1, JSON.stringify(customPrintGeometry));
  assert.equal(await customPrintPopup.locator('link[rel="stylesheet"][href="/label.css"]').count(), 1);
  const customPageRules = await customPrintPopup.evaluate(() => [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } }).filter((rule) => rule.constructor.name === "CSSPageRule").map((rule) => rule.cssText));
  assert.equal(customPageRules.length, 1, `custom Image Print must have one authoritative @page rule: ${JSON.stringify(customPageRules)}`);
  assert.match(customPageRules[0], /190\.5mm 254mm/u);
  assert.equal(await customPrintPopup.evaluate(() => window.__labelPrintRequested), true, "Image Print must reach the browser print call");
  await customPrintPopup.emulateMedia({ media: "print" });
  const safeContentBounds = await customPrintPopup.locator(".print-sheet").evaluate((sheet) => {
    const mm = (px) => px * 25.4 / 96;
    const page = sheet.getBoundingClientRect();
    const boxes = [...sheet.querySelectorAll(".layout-box")].map((element) => element.getBoundingClientRect());
    return { left: mm(Math.min(...boxes.map((box) => box.left)) - page.left), right: mm(Math.max(...boxes.map((box) => box.right)) - page.left), top: mm(Math.min(...boxes.map((box) => box.top)) - page.top), bottom: mm(Math.max(...boxes.map((box) => box.bottom)) - page.top) };
  });
  assert.ok(safeContentBounds.left >= hpSafeEdgeMm - 0.03, JSON.stringify(safeContentBounds));
  assert.ok(safeContentBounds.right <= 190.5 - hpSafeEdgeMm + 0.03, JSON.stringify(safeContentBounds));
  assert.ok(safeContentBounds.top >= hpSafeEdgeMm - 0.03, JSON.stringify(safeContentBounds));
  assert.ok(safeContentBounds.bottom <= 254 - hpSafeEdgeMm + 0.03, JSON.stringify(safeContentBounds));
  const imagePrintPdf = await customPrintPopup.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, scale: 1 });
  const imagePrintDocument = await PDFDocument.load(imagePrintPdf);
  assert.equal(imagePrintDocument.getPageCount(), 1, "18-slot custom Image Print calibration must remain one page");
  assert.ok(Math.abs(imagePrintDocument.getPage(0).getSize().width - (190.5 * 72 / 25.4)) < 0.01, "custom Image Print MediaBox width must be 190.5 mm");
  assert.ok(Math.abs(imagePrintDocument.getPage(0).getSize().height - (254 * 72 / 25.4)) < 0.01, "custom Image Print MediaBox height must be 254 mm");
  await customPrintPopup.emulateMedia({ media: "screen" });
  await customPrintPopup.screenshot({ path: join(evidence, "browser-print-custom-sheet.png"), fullPage: true });
  await customPrintPopup.close();
  const customPdfPath = join(evidence, "synthetic-custom-sheet.pdf");
  await saveGeneratedPdf(page, customPdfPath);
  const customPdf = await loadPdf(customPdfPath, "pdf-custom-sheet.png");
  assert.equal(customPdf.pageCount, 1);
  assert.ok(Math.abs(customPdf.page.getSize().width - 190.5 * 72 / 25.4) < 0.01);
  assert.ok(Math.abs(customPdf.page.getSize().height - 254 * 72 / 25.4) < 0.01);
  assert.match(customPdf.text, /VPL000001/);
  assert.equal(customPdf.hasRasterImage, false, "custom PDF barcode must remain vector");
  await page.locator("#paperPreset").selectOption("A4");
  const a4PrintPopupEvent = page.waitForEvent("popup");
  await page.locator("#printNow").click();
  const a4PrintPopup = await a4PrintPopupEvent;
  await a4PrintPopup.waitForLoadState("load");
  const a4PageRules = await a4PrintPopup.evaluate(() => [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } }).filter((rule) => rule.constructor.name === "CSSPageRule").map((rule) => rule.cssText));
  assert.equal(a4PageRules.length, 1, `A4 Image Print must also have one page rule: ${JSON.stringify(a4PageRules)}`);
  assert.match(a4PageRules[0], /210mm 297mm/u);
  assert.equal(await a4PrintPopup.locator("body").evaluate((body) => getComputedStyle(body).marginTop), "45.3543px", "A4's existing screen-only preview spacing is unchanged");
  await a4PrintPopup.emulateMedia({ media: "print" });
  assert.equal(await a4PrintPopup.locator("body").evaluate((body) => getComputedStyle(body).margin), "0px");
  const a4ImagePrintPdf = await a4PrintPopup.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, scale: 1 });
  const a4ImagePrintDocument = await PDFDocument.load(a4ImagePrintPdf);
  assert.equal(a4ImagePrintDocument.getPageCount(), 1);
  assert.ok(Math.abs(a4ImagePrintDocument.getPage(0).getSize().width - (210 * 72 / 25.4)) < 0.71, `A4 Image Print MediaBox must remain within 0.25 mm: ${JSON.stringify(a4ImagePrintDocument.getPage(0).getSize())}`);
  assert.ok(Math.abs(a4ImagePrintDocument.getPage(0).getSize().height - (297 * 72 / 25.4)) < 0.71, `A4 Image Print MediaBox must remain within 0.25 mm: ${JSON.stringify(a4ImagePrintDocument.getPage(0).getSize())}`);
  await a4PrintPopup.close();

  const calibrationContext = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 4 });
  await calibrationContext.addInitScript(() => Object.defineProperty(window, "print", { configurable: true, value: () => { window.__labelPrintRequested = true; } }));
  const calibrationPage = await calibrationContext.newPage();
  await calibrationPage.goto(baseUrl, { waitUntil: "networkidle" });
  const calibrationHeaders = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark"];
  const calibrationRows = Array.from({ length: 18 }, (_, index) => [`CAL-PRINT-${String(index + 1).padStart(3, "0")}`, `Synthetic Receiver ${index + 1}`, `03${String(index + 1).padStart(9, "0")}`, `Synthetic calibration road ${index + 1}`, `VPL${String(index + 1).padStart(10, "0")}`, "1250", "Synthetic Product", "Sahiwal", "Punjab", "Calibration market"]);
  const calibrationQuote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const calibrationCsv = [calibrationHeaders, ...calibrationRows].map((row) => row.map(calibrationQuote).join(",")).join("\r\n");
  await calibrationPage.locator("#workbook").setInputFiles({ name: "synthetic-calibration-18.csv", mimeType: "text/csv", buffer: Buffer.from(calibrationCsv) });
  await calibrationPage.locator("#applyMapping").waitFor();
  await calibrationPage.locator("#applyMapping").click();
  await calibrationPage.getByText("Review every parcel.").waitFor();
  await calibrationPage.locator('[data-view="preview"]').first().click();
  await calibrationPage.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 18 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"));
  await calibrationPage.locator('[data-view="print"]').first().click();
  await calibrationPage.locator("#paperPreset").selectOption("CUSTOM");
  assert.equal(await calibrationPage.locator("#hpP2055SafeArea").isChecked(), true);
  const calibrationPopupEvent = calibrationPage.waitForEvent("popup");
  await calibrationPage.locator("#printNow").click();
  const calibrationPopup = await calibrationPopupEvent;
  await calibrationPopup.waitForLoadState("load");
  await calibrationPopup.waitForFunction(() => document.querySelectorAll(".print-sheet>.label").length === 18 && [...document.querySelectorAll(".print-sheet canvas[data-barcode]")].every((canvas) => canvas.width > 0));
  await calibrationPopup.emulateMedia({ media: "print" });
  const calibrationGeometry = await calibrationPopup.locator(".print-sheet").evaluate((sheet) => {
    const mm = (px) => px * 25.4 / 96;
    const page = sheet.getBoundingClientRect();
    const cells = [...sheet.children].map((cell) => { const box = cell.getBoundingClientRect(); return [mm(box.left - page.left), mm(box.top - page.top), mm(box.width), mm(box.height)]; });
    const boxes = [...sheet.querySelectorAll(".layout-box")].map((element) => element.getBoundingClientRect());
    return { width: mm(page.width), height: mm(page.height), slots: cells.length, labels: sheet.querySelectorAll(".label").length, cells, contentBounds: { left: mm(Math.min(...boxes.map((box) => box.left)) - page.left), right: mm(Math.max(...boxes.map((box) => box.right)) - page.left), top: mm(Math.min(...boxes.map((box) => box.top)) - page.top), bottom: mm(Math.max(...boxes.map((box) => box.bottom)) - page.top) } };
  });
  assert.ok(Math.abs(calibrationGeometry.width - 190.5) < 0.1, JSON.stringify(calibrationGeometry));
  assert.ok(Math.abs(calibrationGeometry.height - 254) < 0.1, JSON.stringify(calibrationGeometry));
  assert.equal(calibrationGeometry.slots, 18);
  assert.equal(calibrationGeometry.labels, 18);
  [0.25, 63.75, 127.25].forEach((expected, column) => assert.ok(Math.abs(calibrationGeometry.cells[column][0] - expected) < 0.03, `calibration x${column} drifted: ${calibrationGeometry.cells[column][0]} mm`));
  [0.1675, 42.5005, 84.8335, 127.1665, 169.4995, 211.8325].forEach((expected, row) => assert.ok(Math.abs(calibrationGeometry.cells[row * 3][1] - expected) < 0.03, `calibration y${row} drifted: ${calibrationGeometry.cells[row * 3][1]} mm`));
  assert.ok(calibrationGeometry.contentBounds.left >= hpSafeEdgeMm - 0.03 && calibrationGeometry.contentBounds.right <= 190.5 - hpSafeEdgeMm + 0.03 && calibrationGeometry.contentBounds.top >= hpSafeEdgeMm - 0.03 && calibrationGeometry.contentBounds.bottom <= 254 - hpSafeEdgeMm + 0.03, JSON.stringify(calibrationGeometry.contentBounds));
  const calibrationBarcodeBoxes = await calibrationPopup.locator(".print-sheet canvas[data-barcode]").evaluateAll((canvases) => {
    const sheet = document.querySelector(".print-sheet").getBoundingClientRect();
    return canvases.map((canvas) => { const rect = canvas.getBoundingClientRect(); const mm = (px) => px * 25.4 / 96; return { source: canvas.dataset.source, x: mm(rect.left - sheet.left), y: mm(rect.top - sheet.top), width: mm(rect.width), height: mm(rect.height) }; });
  });
  const calibrationHints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  for (let index = 0; index < 18; index += 1) {
    const barcode = calibrationPopup.locator(".print-sheet canvas[data-barcode]").nth(index);
    const expected = await barcode.getAttribute("data-source");
    const image = await loadImage(await barcode.screenshot({ scale: "device" }));
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext("2d").drawImage(image, 0, 0);
    const reader = new MultiFormatReader();
    reader.setHints(calibrationHints);
    const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)))).getText();
    assert.equal(decoded, expected, `P2055-scaled Image Print barcode ${index + 1} must decode`);
  }
  const calibrationPrintPdf = Buffer.from(await calibrationPopup.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, scale: 1 }));
  const calibrationPrintPdfRasterSource = Buffer.from(calibrationPrintPdf);
  const calibrationPrintDocument = await PDFDocument.load(Buffer.from(calibrationPrintPdf));
  assert.equal(calibrationPrintDocument.getPageCount(), 1);
  assert.ok(Math.abs(calibrationPrintDocument.getPage(0).getSize().width - (190.5 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(calibrationPrintDocument.getPage(0).getSize().height - (254 * 72 / 25.4)) < 0.01);

  const calibrationPdfPath = join(temporary, `lp037-savepdf-18-${Date.now()}.pdf`);
  await saveGeneratedPdf(calibrationPage, calibrationPdfPath);
  const calibrationPdfBytes = Buffer.from(await readFile(calibrationPdfPath));
  const calibrationPdfJsBytes = Buffer.from(calibrationPdfBytes);
  const calibrationPdfRasterBytes = Buffer.from(calibrationPdfBytes);
  const calibrationSavePdf = await PDFDocument.load(Buffer.from(calibrationPdfBytes));
  assert.equal(calibrationSavePdf.getPageCount(), 1);
  assert.ok(Math.abs(calibrationSavePdf.getPage(0).getSize().width - (190.5 * 72 / 25.4)) < 0.01);
  assert.ok(Math.abs(calibrationSavePdf.getPage(0).getSize().height - (254 * 72 / 25.4)) < 0.01);
  const calibrationPdfJs = await getDocument({ data: Uint8Array.from(calibrationPdfJsBytes), disableWorker: true, useSystemFonts: true }).promise;
  const calibrationSavePage = await calibrationPdfJs.getPage(1);
  const calibrationViewport = calibrationSavePage.getViewport({ scale: 1 });
  const saveText = (await calibrationSavePage.getTextContent()).items.filter((item) => "str" in item && item.str.trim());
  const saveTextBounds = saveText.map((item) => {
    const [x, y] = calibrationViewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const mm = (value) => value * 25.4 / 72;
    return { left: mm(x), right: mm(x + item.width), top: mm(y - item.height), bottom: mm(y) };
  });
  const pdfContentBounds = { left: Math.min(...saveTextBounds.map((box) => box.left)), right: Math.max(...saveTextBounds.map((box) => box.right)), top: Math.min(...saveTextBounds.map((box) => box.top)), bottom: Math.max(...saveTextBounds.map((box) => box.bottom)) };
  assert.ok(pdfContentBounds.left >= hpSafeEdgeMm - 0.03 && pdfContentBounds.right <= 190.5 - hpSafeEdgeMm + 0.03 && pdfContentBounds.top >= hpSafeEdgeMm - 0.03 && pdfContentBounds.bottom <= 254 - hpSafeEdgeMm + 0.03, JSON.stringify(pdfContentBounds));
  const saveTextAll = saveText.map((item) => item.str).join(" ");
  for (const item of calibrationRows) assert.ok(saveTextAll.includes(item[4]), "Download PDF must retain every synthetic barcode value");

  const imagePrintRaster = await rasterPdfPage(calibrationPrintPdfRasterSource, 4);
  const downloadPdfRaster = await rasterPdfPage(calibrationPdfRasterBytes, 4);
  assert.equal(imagePrintRaster.width, downloadPdfRaster.width, "paired custom pages must render at the same width/DPI");
  assert.equal(imagePrintRaster.height, downloadPdfRaster.height, "paired custom pages must render at the same height/DPI");
  for (let index = 0; index < calibrationBarcodeBoxes.length; index += 1) {
    const printBars = rasterDarkBounds(imagePrintRaster, calibrationBarcodeBoxes[index], 4);
    const pdfBars = rasterDarkBounds(downloadPdfRaster, calibrationBarcodeBoxes[index], 4);
    for (const edge of ["left", "top", "right", "bottom"]) assert.ok(Math.abs(printBars[edge] - pdfBars[edge]) < 0.25, `Image Print/PDF barcode ${index + 1} ${edge} bound differs: print ${printBars[edge]} mm, PDF ${pdfBars[edge]} mm`);
    for (const edge of ["left", "top", "right", "bottom"]) assert.ok(Math.abs(printBars.quiet[edge] - pdfBars.quiet[edge]) < 0.25, `Image Print/PDF barcode ${index + 1} ${edge} quiet zone differs: print ${printBars.quiet[edge]} mm, PDF ${pdfBars.quiet[edge]} mm`);
  }

  globalThis.DOMMatrix ??= DOMMatrix;
  globalThis.ImageData ??= ImageData;
  globalThis.Path2D ??= Path2D;
  const printRasterViewport = calibrationSavePage.getViewport({ scale: 4 });
  const printRaster = createCanvas(Math.round(printRasterViewport.width), Math.round(printRasterViewport.height));
  await calibrationSavePage.render({ canvasContext: printRaster.getContext("2d"), viewport: printRasterViewport, canvasFactory: { create: (width, height) => { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }, reset: (target, width, height) => { target.canvas.width = width; target.canvas.height = height; }, destroy: (target) => { target.canvas.width = 0; target.canvas.height = 0; } } }).promise;
  const saveBarcodeHints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  const pdfPixelsPerMm = 4 * 72 / 25.4;
  for (let index = 0; index < calibrationBarcodeBoxes.length; index += 1) {
    const box = calibrationBarcodeBoxes[index];
    const x = Math.max(0, Math.floor((box.x - 2) * pdfPixelsPerMm));
    const y = Math.max(0, Math.floor((box.y - 2) * pdfPixelsPerMm));
    const right = Math.min(printRaster.width, Math.ceil((box.x + box.width + 2) * pdfPixelsPerMm));
    const bottom = Math.min(printRaster.height, Math.ceil((box.y + box.height + 2) * pdfPixelsPerMm));
    const crop = createCanvas(right - x, bottom - y);
    crop.getContext("2d").drawImage(printRaster, x, y, right - x, bottom - y, 0, 0, right - x, bottom - y);
    const reader = new MultiFormatReader();
    reader.setHints(saveBarcodeHints);
    const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(crop)))).getText();
    assert.equal(decoded, box.source, `Download PDF Code 128 barcode ${index + 1} must decode after the shared HP inset`);
  }
  await calibrationContext.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.locator("#sample").click();
  await mobile.locator("#applyMapping").click();
  await mobile.locator('[data-view="preview"]').first().click();
  await mobile.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 3 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(mobileOverflow, false, "mobile viewport must not overflow horizontally");
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.screenshot({ path: join(evidence, "label-preview-mobile.png"), fullPage: false });
  await mobile.close();

  const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark", "Order Date", "Sender", "S.Address"];
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const records = Array.from({ length: 500 }, (_, index) => [
    `GS-SYN-${String(index + 1).padStart(4, "0")}`,
    index === 0 ? "مصنوعی گاہک" : index === 10 ? "A Long Synthetic Receiver Name With Several Words" : `Synthetic Receiver ${index + 1}`,
    `03${String(index + 1).padStart(9, "0")}`,
    index === 0 ? "گلی نمبر ایک، نمونہ پتہ، مکان ۱۲" : `House ${String(index + 1).padStart(2, "0")}, Synthetic Street ${String(index + 1).padStart(2, "0")}, Block B, Synthetic Town`,
    `VPL${String(index + 1).padStart(10, "0")}`,
    String(500 + (index % 8) * 125),
    index === 2 ? "Premium Vegetable Seed Mix" : `Synthetic Garden Product ${index % 11}`,
    index === 2 ? "Gujranwala" : index === 3 ? "Islamabad" : index === 4 ? "گوجرانوالہ" : index === 15 ? "Nowshera" : "Sahiwal",
    index === 15 ? "Khyber Pakhtunkhwa (KPK)" : "Punjab",
    index === 0 ? "Library" : "Main market",
  ]);
  const csv = [headers, ...records].map((row) => row.map(quote).join(",")).join("\r\n");
  await writeFile(join(temporary, "garden-shop-label-printer-synthetic-500.csv"), Buffer.from(csv));
  await page.locator('[data-view="upload"]').first().click();
  await page.locator("#workbook").setInputFiles({ name: "synthetic-500.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("#applyMapping").waitFor();
  await page.locator("#applyMapping").click();
  await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
  assert.match(await page.locator("body").innerText(), /500 imported/);
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 18 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  assert.equal(await page.locator('.label[data-label-index="1"] .overflow-placeholder').count(), 0, "medium synthetic address must not be clipped");
  assert.equal(await page.locator('.label[data-label-index="3"] .city-text').textContent(), "Islamabad");
  assert.equal(await page.locator('.label[data-label-index="4"] .city-text').textContent(), "گوجرانوالہ");
  const cityFit = await page.locator('.label[data-label-index="3"] .city-text').evaluate((el) => ({ overflow: el.classList.contains("text-overflow"), fontSize: getComputedStyle(el).fontSize, height: el.clientHeight, scrollHeight: el.scrollHeight, text: el.textContent }));
  assert.equal(cityFit.overflow, false, JSON.stringify(cityFit));
  const urduCityFit = await page.locator('.label[data-label-index="4"] .city-text').evaluate((el) => ({ overflow: el.classList.contains("text-overflow"), fontSize: getComputedStyle(el).fontSize, height: el.clientHeight, scrollHeight: el.scrollHeight, text: el.textContent, destinationStyle: el.parentElement.getAttribute("style"), gridRows: getComputedStyle(el.parentElement).gridTemplateRows }));
  assert.equal(urduCityFit.overflow, false, JSON.stringify(urduCityFit));
  assert.equal(await page.locator('.label[data-label-index="15"] .province-text').evaluate((el) => el.textContent?.replace(/\s+/g, " ").trim()), "Khyber Pakhtunkhwa (KPK)");
  assert.equal(await page.locator('.label[data-label-index="15"] .province-text').evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.equal(await page.locator('.label[data-label-index="2"] .city-text').evaluate((el) => el.textContent?.replace(/\s+/g, "").trim()), "Gujranwala");
  assert.equal(await page.locator('.label[data-label-index="2"] .city-text').evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.equal(await page.locator('.label[data-label-index="2"] .product-value').evaluate((el) => el.classList.contains("text-overflow")), false, "long product must fit by measured resizing");
  await page.locator(".sheet").screenshot({ path: join(evidence, "label-preview-500-v2.png") });
  let decoded500 = 0;
  const printedReferences = [];
  for (let pageIndex = 0; pageIndex < 28; pageIndex += 1) {
    const expectedCount = Math.min(18, 500 - pageIndex * 18);
    const decoded = await page.locator(".sheet canvas[data-barcode]").evaluateAll((canvases) => canvases.map((canvas) => ({ index: Number(canvas.dataset.barcode), verified: canvas.dataset.verified, tracking: canvas.dataset.source })));
    const refs = await page.locator(".sheet .printed-reference").allInnerTexts();
    assert.equal(decoded.length, expectedCount, `unexpected label count on synthetic sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.index), Array.from({ length: expectedCount }, (_, index) => pageIndex * 18 + index));
    assert.ok(decoded.every((item) => item.verified === "true"), `barcode decode failed on synthetic sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.tracking), records.slice(pageIndex * 18, pageIndex * 18 + expectedCount).map((row) => row[4]));
    assert.ok(refs.every((reference) => /^FS-2611-\d{5}$/u.test(reference)));
    printedReferences.push(...refs);
    decoded500 += decoded.length;
    if (pageIndex < 27) {
      await page.locator("#nextPage").click();
      const nextCount = Math.min(18, 500 - (pageIndex + 1) * 18);
      await page.waitForFunction((count) => {
        const canvases = [...document.querySelectorAll(".sheet canvas[data-barcode]")];
        return canvases.length === count && canvases.every((canvas) => canvas.dataset.verified === "true");
      }, nextCount, { timeout: 30000 });
    }
  }
  assert.equal(decoded500, 500);
  assert.equal(new Set(printedReferences).size, 500);
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-view="preview"]').first().click();
  await page.locator('[data-view="print"]').first().click();
  assert.match(await page.locator("body").innerText(), /499 labels · 28 A4 · 65 × 44 mm labels pages/);
  const batchPath = join(evidence, "synthetic-500-labels.pdf");
  await saveGeneratedPdf(page, batchPath);
  const batchPdfRendered = await loadPdf(batchPath, "pdf-500-first-page.png");
  const batchPdf = batchPdfRendered.pdf;
  assert.equal(batchPdf.getPageCount(), 28);
  assert.equal(batchPdfRendered.hasRasterImage, true, "complex-script text must use the Unicode-safe raster fallback");
  assert.match(batchPdfRendered.text, /Nowshera/);
  assert.match(batchPdfRendered.text, /Khyber Pakhtunkhwa/);
  assert.match(batchPdfRendered.text, /Gujranwala/);
  assert.doesNotMatch(batchPdfRendered.text, /VPL0000000011/);
  assert.doesNotMatch(batchPdfRendered.text, /EDIT REQUIRED/);
  assert.ok(Math.abs(batchPdf.getPage(0).getSize().width - 595.2756) < 0.01);
  await page.locator("#paperPreset").selectOption("CUSTOM");
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 18 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  await page.locator(".sheet").screenshot({ path: join(evidence, "label-preview-custom-500.png") });
  let customDecoded500 = 0;
  const customPrintedReferences = [];
  for (let pageIndex = 0; pageIndex < 28; pageIndex += 1) {
    const expectedCount = Math.min(18, 500 - pageIndex * 18);
    const decoded = await page.locator(".sheet canvas[data-barcode]").evaluateAll((canvases) => canvases.map((canvas) => ({ index: Number(canvas.dataset.barcode), verified: canvas.dataset.verified, tracking: canvas.dataset.source })));
    const refs = await page.locator(".sheet .printed-reference").allInnerTexts();
    assert.equal(decoded.length, expectedCount, `unexpected custom label count on sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.index), Array.from({ length: expectedCount }, (_, index) => pageIndex * 18 + index));
    assert.ok(decoded.every((item) => item.verified === "true"), `custom Code 128 decode failed on sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.tracking), records.slice(pageIndex * 18, pageIndex * 18 + expectedCount).map((row) => row[4]));
    customPrintedReferences.push(...refs);
    customDecoded500 += decoded.length;
    if (pageIndex < 27) {
      await page.locator("#nextPage").click();
      const nextCount = Math.min(18, 500 - (pageIndex + 1) * 18);
      await page.waitForFunction((count) => {
        const canvases = [...document.querySelectorAll(".sheet canvas[data-barcode]")];
        return canvases.length === count && canvases.every((canvas) => canvas.dataset.verified === "true");
      }, nextCount, { timeout: 30000 });
    }
  }
  assert.equal(customDecoded500, 500);
  assert.deepEqual(customPrintedReferences, printedReferences, "switching to custom stock must preserve all 500 references");
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-view="preview"]').first().click();
  await page.locator('[data-view="print"]').first().click();
  assert.match(await page.locator("body").innerText(), /499 labels · 28 Custom · 190\.5 × 254 mm/);
  const customBatchPath = join(evidence, "synthetic-500-labels-custom.pdf");
  await saveGeneratedPdf(page, customBatchPath);
  const customBatchRendered = await loadPdf(customBatchPath, "pdf-custom-500-first-page.png");
  const customBatchPdf = customBatchRendered.pdf;
  assert.equal(customBatchPdf.getPageCount(), 28);
  assert.equal(customBatchRendered.hasRasterImage, true, "custom complex-script labels must use the Unicode-safe fallback");
  assert.match(customBatchRendered.text, /Nowshera/);
  assert.match(customBatchRendered.text, /Gujranwala/);
  assert.doesNotMatch(customBatchRendered.text, /VPL0000000011/);
  assert.ok(customBatchPdf.getPages().every((pdfPage) => Math.abs(pdfPage.getSize().width - 190.5 * 72 / 25.4) < 0.01 && Math.abs(pdfPage.getSize().height - 254 * 72 / 25.4) < 0.01), "every custom PDF page must have the exact custom MediaBox");
  await page.locator("#paperPreset").selectOption("A4");
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-edit="2"]').click();
  assert.equal(await page.locator('.edit-form input[name="product"]').inputValue(), "Premium Vegetable Seed Mix");
  await page.locator(".edit-form [data-cancel]").click();
  assert.ok(Math.abs(batchPdf.getPage(0).getSize().height - 841.8898) < 0.01);

  await page.locator("#newBatch").click();
  const overlongAddress = Array.from({ length: 40 }, (_, index) => `Synthetic address segment ${String(index + 1).padStart(2, "0")}`).join("\r\n");
  const overflowCsv = [headers,
    ["SYN-OVERFLOW-001", "Synthetic Receiver Overflow", "03300000019", overlongAddress, "VPL001", "550", "Synthetic Seed Pack", "Sahiwal", "Punjab", "Synthetic Park"],
    ["", "Synthetic Receiver Optional", "03300000020", "House 2, Test Street", "VPL002", "550", "", "Sahiwal", "Punjab", ""],
  ]
    .map((row) => row.map(quote).join(",")).join("\r\n");
  await page.locator("#workbook").setInputFiles({ name: "synthetic-overlong.csv", mimeType: "text/csv", buffer: Buffer.from(overflowCsv) });
  await page.locator("#applyMapping").click();
  await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => document.querySelector(".sheet canvas[data-barcode]")?.dataset.verified === "true", { timeout: 30000 });
  assert.equal(await page.locator('.sheet .label[data-label-index="0"] .overflow-placeholder').count(), 0);
  assert.equal(await page.locator('.sheet .label[data-label-index="0"]').evaluate((el) => el.classList.contains("layout-overflow")), true, "unfit address must be visibly blocked in preview");
  assert.match(await page.getByRole("alert").innerText(), /Selected label cannot print: Text does not fit: address/u);
  assert.match(await page.locator('.label[data-label-index="1"] .printed-reference').innerText(), /^FS-2611-\d{5}$/u);
  await page.screenshot({ path: join(evidence, "label-preview-overflow.png"), fullPage: true });
  const overflowLayout = await page.locator('.sheet .label[data-label-index="0"]').evaluate((label) => {
    const bottom = (selector) => label.querySelector(selector).getBoundingClientRect().bottom;
    const top = (selector) => label.querySelector(selector).getBoundingClientRect().top;
    return { addressBeforeNearby: bottom(".address-text") <= top(".nearby-label") + 1, nearbyInsideTo: bottom(".landmark") <= bottom(".to-border") + 1, contactAboveTo: bottom(".contact") <= top(".to-border") + 2, productBeforeFooter: bottom(".product-row-frame") <= top(".footer-from") + 1 };
  });
  assert.deepEqual(overflowLayout, { addressBeforeNearby: true, nearbyInsideTo: true, contactAboveTo: true, productBeforeFooter: true });
  await page.locator('[data-view="print"]').first().click();
  assert.equal(await page.locator("#savePdf").isDisabled(), false, "one bad row must not block a valid batch");
  assert.match(await page.locator("body").innerText(), /1 selected label will be excluded/);
  const mixedPath = join(evidence, "synthetic-overflow-filtered.pdf");
  await saveGeneratedPdf(page, mixedPath);
  const mixedPdf = await loadPdf(mixedPath, "pdf-overflow-filtered.png");
  assert.equal(mixedPdf.pageCount, 1);
  assert.doesNotMatch(mixedPdf.text, /VPL001/u);
  assert.match(mixedPdf.text, /VPL002/u);
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-edit="0"]').click();
  await page.locator("#restoreSourceAddress").click();
  assert.equal(await page.locator('.edit-form [name="address"]').inputValue(), overlongAddress.replace(/\r\n/g, "\n"));
  await page.locator(".edit-form [data-cancel]").click();

  const syntheticMoPhone = (index) => `03${String(100000000 + index + 1).padStart(9, "0")}`;
  const syntheticMoAmount = (index) => String(20000 + (index + 1) * 100);
  const syntheticMoDate = (index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1));
    return `${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCFullYear()).slice(-2)}`;
  };

  async function importMoBatch(count) {
    if (await page.locator("#newBatch").count() === 0) await page.locator('[data-view="review"]').first().click();
    await page.locator("#newBatch").click();
    const moRows = Array.from({ length: count }, (_, index) => [
      `MO-SYN-${String(index + 1).padStart(3, "0")}`,
      `Synthetic Receiver ${index + 1}`,
      syntheticMoPhone(index),
      index === 10 ? `Synthetic St 11 Block 3 ${Array.from({ length: 4 }, (_, part) => `Address Segment ${part + 1}`).join(" ")}` : `Synthetic St ${index + 1}`,
      `${index % 2 ? "VPP" : "VPL"}${String(index + 1).padStart(6, "0")}`,
      syntheticMoAmount(index),
      "Synthetic parcel only",
      "Sahiwal",
      "Punjab",
      "Synthetic landmark",
      syntheticMoDate(index),
      "Synthetic Sender",
      "Synthetic Sender Return",
    ]);
    const csv = [headers, ...moRows].map((row) => row.map(quote).join(",")).join("\r\n");
    await page.locator("#workbook").setInputFiles({ name: `mo-synthetic-${count}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.locator("#applyMapping").click();
    await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
    await page.locator('[data-view="mo"]').click();
    await page.waitForFunction(() => {
      const frame = document.querySelector("#moFrontPreview");
      return frame?.contentDocument?.querySelector(".mo-sheet") && frame.contentDocument.fonts.status === "loaded";
    }, { timeout: 30000 }).catch(async (error) => {
      const state = await page.evaluate(() => ({ title: document.title, body: document.body.innerText, frames: [...document.querySelectorAll("iframe")].map((frame) => ({ id: frame.id, title: frame.title, hasDocument: Boolean(frame.contentDocument), docTitle: frame.contentDocument?.title, docText: frame.contentDocument?.body?.innerText?.slice(0, 200), html: frame.contentDocument?.documentElement?.outerHTML?.slice(0, 1000) })) }));
      throw new Error(`${error.message}\nImport/render state=${JSON.stringify(state)}\nPage errors=${JSON.stringify(errors)}`);
    });
    assert.match(await page.locator(".mo-summary").innerText(), new RegExp(`${count}\\s+eligible VPL/VPP rows`, "u"));
  }

  async function importMoBatchFresh(targetPage, count) {
    await targetPage.goto(baseUrl, { waitUntil: "networkidle" });
    await targetPage.locator("#sample").click();
    await targetPage.locator("#applyMapping").click();
    await targetPage.locator("button[data-edit]").first().waitFor({ timeout: 30000 });
    await targetPage.locator("#newBatch").click();
    const rows = Array.from({ length: count }, (_, index) => [
      `MO-SYN-${String(index + 1).padStart(3, "0")}`,
      `Synthetic Receiver ${index + 1}`,
      syntheticMoPhone(index),
      index === 10 ? `Synthetic St 11 Block 3 ${Array.from({ length: 4 }, (_, part) => `Address Segment ${part + 1}`).join(" ")}` : `Synthetic St ${index + 1}`,
      `${index % 2 ? "VPP" : "VPL"}${String(index + 1).padStart(6, "0")}`,
      syntheticMoAmount(index),
      "Synthetic parcel only",
      "Sahiwal",
      "Punjab",
      "Synthetic landmark",
      syntheticMoDate(index),
      "Synthetic Sender",
      "Synthetic Sender Return",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    await targetPage.locator("#workbook").setInputFiles({ name: `mo-synthetic-${count}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) });
    await targetPage.locator("#applyMapping").click();
    await targetPage.locator("button[data-edit]").first().waitFor({ timeout: 30000 });
    await targetPage.locator('[data-view="mo"]').click();
    await targetPage.locator(".mo-summary").waitFor({ timeout: 30000 });
  }

  async function importMoMixedPrefixes() {
    if (await page.locator("#newBatch").count() === 0) await page.locator('[data-view="review"]').first().click();
    await page.locator("#newBatch").click();
    const mixedRows = ["VPL000101", "RGL000102", "VPP000103", "UMS000104", "VPP000105"].map((tracking, index) => [
      `MO-MIX-SYN-${index + 1}`, `Synthetic Mixed ${index + 1}`, syntheticMoPhone(index), `Synthetic mixed address ${index + 1}`,
      tracking, syntheticMoAmount(index), "Synthetic item", "Sahiwal", "Punjab", "Synthetic landmark", syntheticMoDate(index), "Synthetic Sender", "Synthetic Sender Return",
    ]);
    const csv = [headers, ...mixedRows].map((row) => row.map(quote).join(",")).join("\r\n");
    await page.locator("#workbook").setInputFiles({ name: "mo-mixed-prefixes-synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.locator("#applyMapping").click();
    await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
    await page.locator('[data-view="mo"]').click();
    await page.waitForFunction(() => document.querySelector("#moFrontPreview")?.contentDocument?.querySelector(".mo-sheet"));
    assert.match(await page.locator(".mo-summary").innerText(), /3\s+eligible VPL\/VPP rows/u);
    assert.equal(await page.locator(".mo-exclusions summary").innerText(), "2 excluded imported records");
  }

  async function inspectMoFace(face, expectedSlots, cnic) {
    const frame = page.frameLocator(face === "front" ? "#moFrontPreview" : "#moBackPreview");
    await expectMoSheet(face, expectedSlots);
    const formText = await frame.locator(".mo-sheet").innerText();
    if (face === "front") {
      assert.match(formText, /Month Stamp/u, "Section 1 sender/intimation artwork must be the front");
      assert.match(formText, /V\. P\. L\./u);
      assert.match(formText, /V\. P\. P\./u);
    } else {
      assert.match(formText, /M\.O\.-51 \(Revised\)/u, "Section 2 M.O.-51 title artwork must be the back");
      assert.match(formText, /PAKISTAN MONEY ORDER/u);
    }
    assert.equal(await frame.locator("[data-mo-sender-cnic]").count(), face === "front" && cnic ? expectedSlots.filter((value) => value !== null).length : 0);
    if (face === "front" && cnic) {
      const atSenderCnicPosition = await frame.locator("[data-mo-sender-cnic]").evaluateAll((values) => values.every((value) => {
        const senderLabels = Array.from(value.closest(".page")?.querySelectorAll('div[style*="width:104px"]') ?? []).find((label) => label.textContent?.includes("بھیجنے والے کا نام"));
        const senderBlock = senderLabels?.parentElement;
        return value.parentElement === senderBlock?.children[2]?.children[2];
      }));
      assert.equal(atSenderCnicPosition, true, "CNIC belongs only in the sender identity line");
    }
    assert.equal(await frame.locator(".page").first().evaluate((form) => getComputedStyle(form).overflow), "visible");
    assert.equal(await frame.locator("[dir=rtl]").count() > 0, true, "Urdu page direction must remain RTL");
    assert.equal(await frame.locator("[data-mo-sender-cnic]").allTextContents().then((values) => values.every((value) => value === "00000-1234567-8")), true);
    const metrics = await frame.locator(".mo-sheet").evaluate((sheet) => {
      const rect = sheet.getBoundingClientRect();
      const half = sheet.querySelector(".mo-half").getBoundingClientRect();
      const pages = Array.from(sheet.querySelectorAll(".page"));
      const page = pages[0]?.getBoundingClientRect();
      const outside = pages.flatMap((form) => {
        const bounds = form.getBoundingClientRect();
        return Array.from(form.querySelectorAll("*"))
          .map((element) => element.getBoundingClientRect())
          .filter((item) => item.width > 0 && item.height > 0 && (item.left < bounds.left - 0.5 || item.top < bounds.top - 0.5 || item.right > bounds.right + 0.5 || item.bottom > bounds.bottom + 0.5)).length;
      });
      const textSizes = pages.flatMap((form) => Array.from(form.querySelectorAll("div,span"))
        .filter((element) => element.childElementCount === 0 && element.textContent?.trim())
        .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
      const stampsInside = pages.every((form) => {
        const bounds = form.getBoundingClientRect();
        return Array.from(form.querySelectorAll("[style*='border-radius:50%']")).every((stamp) => {
          const item = stamp.getBoundingClientRect();
          return item.left >= bounds.left - 0.5 && item.top >= bounds.top - 0.5 && item.right <= bounds.right + 0.5 && item.bottom <= bounds.bottom + 0.5;
        });
      });
      const faceText = sheet.innerText;
      return { widthMm: rect.width * 25.4 / 96, heightMm: rect.height * 25.4 / 96, halfWidthMm: half.width * 25.4 / 96, pageWidthMm: page.width * 25.4 / 96, pageHeightMm: page.height * 25.4 / 96, overflowCount: outside.reduce((sum, count) => sum + count, 0), minimumEffectiveTextPt: Math.min(...textSizes) * 0.75 * (210 / 220), stampsInside, fontReady: document.fonts.check('9px "Noto Naskh Arabic"', "اردو"), text: faceText };
    });
    assert.ok(Math.abs(metrics.widthMm - 297) < 0.1);
    assert.ok(Math.abs(metrics.heightMm - 210) < 0.1);
    assert.ok(Math.abs(metrics.halfWidthMm - 148.5) < 0.1);
    assert.ok(metrics.pageWidthMm <= 148.5 && Math.abs(metrics.pageHeightMm - 210) < 0.1);
    assert.equal(metrics.overflowCount, 0, "visible template elements must remain inside the fitted source page");
    assert.ok(metrics.minimumEffectiveTextPt >= 6.4, `smallest source text should remain at least 6.4pt after uniform fit: ${metrics.minimumEffectiveTextPt}`);
    assert.equal(metrics.stampsInside, true, "stamp/signature geometry must remain inside both form bounds");
    assert.equal(metrics.fontReady, true, "locally bundled Urdu font must be available");
    assert.doesNotMatch(metrics.text, /Synthetic Receiver|MO-SYN-|03001234567|Synthetic St/u, "order fields must not leak into the unresolved postal fields");
  }

  async function expectMoSheet(face, expectedSlots) {
    const frame = page.frameLocator(face === "front" ? "#moFrontPreview" : "#moBackPreview");
    const slots = await frame.locator(".mo-half").evaluateAll((halves) => halves.map((half) => half.dataset.moSourceIndex === undefined ? null : Number(half.dataset.moSourceIndex)));
    assert.deepEqual(slots, expectedSlots, `${face} slot identities must match cut-and-stack pairing`);
    const faceName = await frame.locator(".mo-sheet").getAttribute("data-mo-face");
    assert.equal(faceName, face);
    assert.equal(await frame.locator(".mo-sheet").getAttribute("data-mo-rotation"), "none", "physical back rotation is not approved or applied");
  }

  await importMoBatch(2);
  await page.locator("#moSenderCnic").fill("0000012345678");
  await page.locator("#moSenderCnic").press("Tab");
  await page.waitForFunction(() => document.querySelector("#moFrontPreview")?.contentDocument?.querySelectorAll("[data-mo-sender-cnic]").length === 2).catch(async (error) => {
    throw new Error(`${error.message}\nMO body: ${await page.locator("body").innerText()}\nBrowser errors: ${JSON.stringify(errors)}`);
  });
  await inspectMoFace("front", [0, 1], "00000-1234567-8");
  await inspectMoFace("back", [0, 1], "00000-1234567-8");
  await page.screenshot({ path: join(evidence, "mo51-proof-n2-sheet1-cnic-synthetic.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n2-front-cnic-synthetic.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n2-back.png") });
  const requestsBeforeCnicCheck = allRequests.length;
  const storedCnic = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gfs-label-references-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction("references", "readonly").objectStore("references").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, records });
  });
  assert.doesNotMatch(storedCnic, /00000-1234567-8|0000012345678/u, "CNIC must not enter browser storage");
  assert.equal(allRequests.length, requestsBeforeCnicCheck, "CNIC entry must not cause any request or monitoring event");
  assert.equal(allRequests.some((url) => /googleapis|gstatic/u.test(url)), false, "MO font rendering must be local");

  const moPdfPath = join(temporary, "mo51-synthetic-two-forms.pdf");
  const moPdfDownload = await saveMoGeneratedPdf(page, moPdfPath, 2);
  assert.equal(moPdfDownload.document.getTitle(), "MO-51 blank manual-completion forms");
  const moPdfFirst = await loadPdf(moPdfPath, "mo51-pdf-n2-front.png");
  assert.equal(moPdfFirst.pageCount, 2);
  assert.equal(moPdfFirst.hasRasterImage, true, "MO artwork should be rasterized from the shared I2 preview");
  assert.equal(moPdfFirst.text, "", "PDF must not contain selectable imported order or identity text");
  const moFrontLayoutDom = await page.frameLocator("#moFrontPreview").locator('.mo-half[data-mo-slot="left"]').evaluate((half) => {
    const sender = half.querySelector('[data-mo-party-block="sender"]');
    const receiver = half.querySelector('[data-mo-party-block="receiver"]');
    return {
      receiverTop: receiver?.getBoundingClientRect().top,
      senderTop: sender?.getBoundingClientRect().top,
      receiverCaption: receiver?.querySelector('[data-mo-party-caption="receiver"]')?.textContent?.trim(),
      senderCaption: sender?.querySelector('[data-mo-party-caption="sender"]')?.textContent?.trim(),
    };
  });
  assert.ok(Number.isFinite(moFrontLayoutDom.receiverTop) && moFrontLayoutDom.receiverTop < moFrontLayoutDom.senderTop, "MO FRONT section 1 must place the receiver block above the sender block");
  assert.match(moFrontLayoutDom.receiverCaption ?? "", /وصول کرنے والے/u, "upper block must retain the Urdu receiver caption");
  assert.match(moFrontLayoutDom.senderCaption ?? "", /بھیجنے والے کا نام/u, "lower block must retain the Urdu sender caption");
  assert.equal(await page.frameLocator("#moBackPreview").locator("[data-mo-party-block]").count(), 0, "MO BACK section 2 must remain unchanged");
  const moPdfFrontRaster = await compareMoPdfWithPreview(page, "front", moPdfDownload.bytes, 1);
  const moPdfBackRaster = await compareMoPdfWithPreview(page, "back", moPdfDownload.bytes, 2);
  await writeFile(join(evidence, "mo51-pdf-n2-page1-front.png"), moPdfFrontRaster.toBuffer("image/png"));
  const partyRaster = await rasterPdfPage(moPdfDownload.bytes, 1, 1);
  const partyPixels = partyRaster.getContext("2d").getImageData(0, 0, partyRaster.width, partyRaster.height).data;
  const inkInRegion = (y0, y1) => {
    let count = 0;
    for (let y = y0; y < y1; y += 1) for (let x = 0; x < Math.floor(partyRaster.width / 2); x += 1) {
      const offset = (y * partyRaster.width + x) * 4;
      if (partyPixels[offset] < 110 && partyPixels[offset + 1] < 110 && partyPixels[offset + 2] < 110) count += 1;
    }
    return count;
  };
  assert.ok(inkInRegion(Math.floor(partyRaster.height * 0.34), Math.floor(partyRaster.height * 0.54)) > 100, "actual PDF raster must contain the upper receiver caption/lines");
  assert.ok(inkInRegion(Math.floor(partyRaster.height * 0.53), Math.floor(partyRaster.height * 0.76)) > 100, "actual PDF raster must contain the lower sender/CNIC caption/lines");
  await writeFile(join(evidence, "mo51-pdf-n2-page2-back.png"), moPdfBackRaster.toBuffer("image/png"));
  assert.ok(moPdfFrontRaster.width > 800 && moPdfBackRaster.width > 800, "300-DPI artwork should rasterize at full A4 bounds");
  assert.equal(allRequests.some((url) => /googleapis|gstatic/u.test(url)), false, "PDF rasterization must use only local fonts/resources");

  await page.locator("#moSenderCnic").fill("123456789012");
  assert.equal(await page.locator("#moSenderCnic").getAttribute("aria-invalid"), "true");
  assert.equal(await page.locator("#moFrontPreview").count(), 0, "invalid nonblank CNIC must withhold the paired preview");
  await page.locator("#moSenderCnic").fill("");
  await page.locator("#moSenderCnic").press("Tab");
  await page.waitForSelector("#moBackPreview");
  assert.equal(await page.frameLocator("#moFrontPreview").locator("[data-mo-sender-cnic]").count(), 0, "blank optional CNIC leaves the original form line blank");
  await page.locator("#moSenderCnic").fill("0000012345678");
  await page.locator("#moSenderCnic").press("Tab");
  await page.waitForFunction(() => document.querySelector("#moFrontPreview")?.contentDocument?.querySelectorAll("[data-mo-sender-cnic]").length === 2);

  await setMoMapping(page, 0, "articleNumberSource", "tracking");
  await setMoMapping(page, 0, "principalSource", "declared-principal");
  await setMoMapping(page, 0, "senderSource", "article-sender");
  await setMoMapping(page, 0, "receiverSource", "article-receiver");
  await setMoMapping(page, 0, "receiverSource", "manual");
  await setMoMapping(page, 0, "manualReceiverName", "آزمائشی وصول کنندہ");
  await setMoMapping(page, 0, "manualReceiverAddress", "گلی ۱۲، آزمائشی پتہ");
  await setMoMapping(page, 0, "manualReceiverPhone", "03009876543");
  const confirmedFront = await page.frameLocator("#moFrontPreview").locator(".mo-sheet").innerText();
  const confirmedBack = await page.frameLocator("#moBackPreview").locator(".mo-sheet").innerText();
  const mappedKeys = (await page.frameLocator("#moFrontPreview").locator('.page[data-mo-source-index="0"]').getAttribute("data-mo-visible-fields")).split(",");
  assert.deepEqual(mappedKeys.sort(), ["articleNumber", "principal", "receiverAddress", "receiverName", "receiverPhone", "senderAddress", "senderName"].sort());
  const mappedReceiver = page.frameLocator("#moFrontPreview").locator('[data-mo-field="receiver-name"]');
  const mappedSender = page.frameLocator("#moFrontPreview").locator('[data-mo-field="sender-name"]');
  assert.equal((await mappedReceiver.innerText()).trim(), "آزمائشی وصول کنندہ", "distinct Receiver value remains bound to the upper receiver block");
  assert.equal((await mappedSender.innerText()).trim(), "Synthetic Sender", "distinct Sender value remains bound to the lower sender block");
  const mappedPartyY = await page.frameLocator("#moFrontPreview").locator('.mo-half[data-mo-slot="left"]').evaluate((half) => ({ receiver: half.querySelector('[data-mo-party-block="receiver"]')?.getBoundingClientRect().top, sender: half.querySelector('[data-mo-party-block="sender"]')?.getBoundingClientRect().top }));
  assert.ok(mappedPartyY.receiver < mappedPartyY.sender, "mapped distinct party values retain the corrected vertical roles");
  assert.match(confirmedFront, /VPL000001/u, "selected exact tracking source appears in the V.P. article field");
  assert.match(confirmedFront, /20100/u, "only the imported principal is selected; no label commission is added");
  assert.doesNotMatch(confirmedFront, /20275/u, "label commission must not be merged into principal");
  assert.match(confirmedFront, /آزمائشی وصول کنندہ/u, "synthetic manual Urdu receiver name renders in the front form");
  assert.match(confirmedFront, /گلی ۱۲، آزمائشی پتہ/u, "synthetic Urdu address is preserved in RTL text");
  assert.match(confirmedFront, /03009876543/u);
  assert.equal(await page.frameLocator("#moFrontPreview").locator('[data-mo-field="receiver-name"]').getAttribute("dir"), "auto");
  assert.equal(await page.frameLocator("#moFrontPreview").locator('[data-mo-field="receiver-name"]').getAttribute("data-mo-provenance"), "manual MO-session entry");
  assert.match(confirmedBack, /M\.O\.-51 \(Revised\)/u, "candidate fields do not swap front/back artwork");
  assert.equal(await page.frameLocator("#moFrontPreview").locator(".mo-draft-marker").count(), 1);
  assert.equal(await page.frameLocator("#moBackPreview").locator(".mo-draft-marker").count(), 1);
  assert.equal(await page.locator("#downloadMoDraftPdf").isDisabled(), false, await page.locator("#moMappingFitError").innerText());
  const mappedStorage = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gfs-label-references-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const references = await new Promise((resolve, reject) => {
      const request = database.transaction("references", "readonly").objectStore("references").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return JSON.stringify({ localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage }, references });
  });
  assert.doesNotMatch(mappedStorage, /آزمائشی وصول کنندہ|گلی ۱۲، آزمائشی پتہ|Synthetic Merchant|20100|\b03\d{9}\b/u, "user-confirmed MO values must remain memory-only");
  assert.equal(allRequests.some((url) => /آزمائشی|Synthetic Receiver 1|Synthetic address 1|00000-1234567-8|\b03\d{9}\b|VPL000001|20100/u.test(url)), false, "MO candidate values and Sender CNIC must not enter request URLs");
  assert.equal(moSourceDataRequested, false, "candidate fields and CNIC must not enter monitoring, analytics or other request payloads");
  const userConfirmedPdf = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-user-confirmed-draft.pdf"), 2, "draft");
  const draftFrontRaster = await compareMoPdfWithPreview(page, "front", userConfirmedPdf.bytes, 1);
  const draftBackRaster = await compareMoPdfWithPreview(page, "back", userConfirmedPdf.bytes, 2);
  assert.ok(draftFrontRaster.width > 800 && draftBackRaster.width > 800);
  assert.match(userConfirmedPdf.document.getSubject(), /user-confirmed draft/iu);
  await writeFile(join(evidence, "mo51-lp047-populated-draft-pdf-page1-front-synthetic.png"), draftFrontRaster.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-lp047-populated-draft-pdf-page2-back-synthetic.png"), draftBackRaster.toBuffer("image/png"));
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-lp047-populated-draft-preview-front-synthetic.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-lp047-populated-draft-preview-back-synthetic.png") });
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-view="mo"]').click();
  assert.equal(await page.locator("#moSenderCnic").inputValue(), "", "leaving and returning to MO must clear the session-only CNIC");
  const blankAfterMapping = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-blank-after-mapping.pdf"), 2);
  assert.match(blankAfterMapping.document.getTitle(), /blank manual-completion/u);
  assert.ok(await compareMoPdfPages(moPdfDownload.bytes, blankAfterMapping.bytes, 1) < 0.01, "blank manual-completion PDF must ignore all selected source mappings");
  assert.ok(await compareMoPdfPages(moPdfDownload.bytes, blankAfterMapping.bytes, 2) < 0.01);

  await setMoMapping(page, 0, "receiverSource", "manual");
  await setMoMapping(page, 0, "manualReceiverAddress", "Synthetic long address ".repeat(80));
  await page.waitForFunction(() => /Receiver address/iu.test(document.querySelector("#moMappingFitError")?.textContent ?? ""), { timeout: 5000 }).catch(async (error) => {
    const bounds = await page.frameLocator("#moFrontPreview").locator("[data-mo-field=receiver-address]").evaluate((field) => ({ textLength: field.textContent?.length, fieldWidth: field.getBoundingClientRect().width, lineWidth: field.parentElement?.getBoundingClientRect().width, visibleKeys: field.closest(".page")?.dataset.moVisibleFields }));
    throw new Error(`${error.message}\nFit status=${await page.locator("#moMappingFitError").innerText()}\nBounds=${JSON.stringify(bounds)}\nDraft disabled=${await page.locator("#downloadMoDraftPdf").isDisabled()}`);
  });
  assert.equal(await page.locator("#downloadMoDraftPdf").isDisabled(), true, "long mapped addresses must block draft PDF; never truncate");
  assert.equal(await page.locator("#downloadMoPdf").isDisabled(), false, "blank manual-completion packet remains a separate option");
  await setMoMapping(page, 0, "receiverSource", "article-receiver");
  await page.waitForFunction(() => !(document.querySelector("#moMappingFitError")?.textContent ?? "").length);

  await importMoBatch(3);
  await inspectMoFace("front", [0, 2], "");
  await inspectMoFace("back", [0, 2], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n3-sheet1.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n3-front-sheet1.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n3-back-sheet1.png") });
  await page.locator("#moNextSheet").click();
  await inspectMoFace("front", [1, null], "");
  await inspectMoFace("back", [1, null], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n3-sheet2-odd-blank.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n3-front-sheet2-odd-blank.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n3-back-sheet2-odd-blank.png") });
  const mo3Pdf = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-n3.pdf"), 4);
  const mo3PdfFront = await compareMoPdfWithPreview(page, "front", mo3Pdf.bytes, 3);
  const mo3PdfBack = await compareMoPdfWithPreview(page, "back", mo3Pdf.bytes, 4);
  await writeFile(join(evidence, "mo51-pdf-n3-page3-front-odd-blank.png"), mo3PdfFront.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-pdf-n3-page4-back-odd-blank.png"), mo3PdfBack.toBuffer("image/png"));
  await assertMoOddBlank(mo3Pdf, 3);

  await importMoBatch(5);
  await inspectMoFace("front", [0, 3], "");
  await inspectMoFace("back", [0, 3], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n5-sheet1.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n5-front-sheet1.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n5-back-sheet1.png") });
  await page.locator("#moNextSheet").click();
  await page.locator("#moNextSheet").click();
  await inspectMoFace("front", [2, null], "");
  await inspectMoFace("back", [2, null], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n5-sheet3-odd-blank.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n5-front-sheet3-odd-blank.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n5-back-sheet3-odd-blank.png") });
  const mo5Pdf = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-n5.pdf"), 6);
  const mo5PdfFront = await compareMoPdfWithPreview(page, "front", mo5Pdf.bytes, 5);
  const mo5PdfBack = await compareMoPdfWithPreview(page, "back", mo5Pdf.bytes, 6);
  await writeFile(join(evidence, "mo51-pdf-n5-page5-front-odd-blank.png"), mo5PdfFront.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-pdf-n5-page6-back-odd-blank.png"), mo5PdfBack.toBuffer("image/png"));
  await assertMoOddBlank(mo5Pdf, 5);

  await importMoBatch(100);
  await inspectMoFace("front", [0, 50], "");
  await inspectMoFace("back", [0, 50], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n100-sheet1.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n100-front-sheet1.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n100-back-sheet1.png") });
  const mo100Pdf = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-n100.pdf"), 100);
  const mo100PdfFirstFront = await compareMoPdfWithPreview(page, "front", mo100Pdf.bytes, 1);
  const mo100PdfFirstBack = await compareMoPdfWithPreview(page, "back", mo100Pdf.bytes, 2);
  await writeFile(join(evidence, "mo51-pdf-n100-page1-front-sheet1.png"), mo100PdfFirstFront.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-pdf-n100-page2-back-sheet1.png"), mo100PdfFirstBack.toBuffer("image/png"));
  await page.locator("#moSheetSelect").selectOption({ label: "50" });
  await page.waitForFunction(() => document.querySelector("#moSheetSelect")?.value === "49" && document.querySelector("#moFrontPreview")?.contentDocument?.querySelector(".mo-half")?.getAttribute("data-mo-source-index") === "49").catch(async (error) => {
    throw new Error(`${error.message}\nMO sheet controls: ${await page.locator(".mo-sheet-nav").innerText()}\nSelect value: ${await page.locator("#moSheetSelect").inputValue()}\nFront slots: ${JSON.stringify(await page.frameLocator("#moFrontPreview").locator(".mo-half").evaluateAll((halves) => halves.map((half) => half.getAttribute("data-mo-source-index"))))}`);
  });
  await inspectMoFace("front", [49, 99], "");
  await inspectMoFace("back", [49, 99], "");
  await page.screenshot({ path: join(evidence, "mo51-proof-n100-sheet50.png"), fullPage: true });
  await page.frameLocator("#moFrontPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n100-front-sheet50.png") });
  await page.frameLocator("#moBackPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "mo51-proof-n100-back-sheet50.png") });
  const mo100PdfFront = await compareMoPdfWithPreview(page, "front", mo100Pdf.bytes, 99);
  const mo100PdfBack = await compareMoPdfWithPreview(page, "back", mo100Pdf.bytes, 100);
  await writeFile(join(evidence, "mo51-pdf-n100-page99-front-sheet50.png"), mo100PdfFront.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-pdf-n100-page100-back-sheet50.png"), mo100PdfBack.toBuffer("image/png"));
  await page.locator("#moSheetSelect").selectOption({ label: "1" });

  for (const count of [1, 50, 99, 101]) {
    await importMoBatch(count);
    const pdf = await saveMoGeneratedPdf(page, join(temporary, `mo51-synthetic-n${count}.pdf`), 2 * Math.ceil(count / 2));
    await assertMoOddBlank(pdf, count);
  }

  await importMoBatch(101);
  await setMoMapping(page, 0, "articleNumberSource", "tracking");
  await setMoMapping(page, 0, "principalSource", "declared-principal");
  await setMoMapping(page, 0, "senderSource", "article-sender");
  const draft101 = await saveMoGeneratedPdf(page, join(temporary, "mo51-user-confirmed-draft-n101.pdf"), 102, "draft");
  const draft101Front = await compareMoPdfWithPreview(page, "front", draft101.bytes, 1);
  const draft101Back = await compareMoPdfWithPreview(page, "back", draft101.bytes, 2);
  await writeFile(join(evidence, "mo51-lp047-populated-draft-n101-page1-front-synthetic.png"), draft101Front.toBuffer("image/png"));
  await writeFile(join(evidence, "mo51-lp047-populated-draft-n101-page2-back-synthetic.png"), draft101Back.toBuffer("image/png"));
  await assertMoOddBlank(draft101, 101);
  const cancelledDraftDownload = page.waitForEvent("download", { timeout: 3000 }).then(() => true, () => false);
  await page.locator("#downloadMoDraftPdf").click();
  await page.locator("#cancelMoPdf").click();
  await page.waitForFunction(() => document.querySelector("#moPdfStatus")?.textContent?.startsWith("Export cancelled"));
  assert.equal(await cancelledDraftDownload, false, "cancelled populated draft must not produce a PDF download");
  assert.equal(await page.locator('iframe[title="Temporary MO-51 PDF rasterizer"]').count(), 0, "cancelled populated draft must clean temporary rasterizer frames");

  await importMoMixedPrefixes();
  const mixedMoPdf = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-mixed-prefixes.pdf"), 4);
  await assertMoOddBlank(mixedMoPdf, 3);

  await importMoBatch(3);
  await page.locator('.mo-source-chip[data-mo-layout-source="address"]').click();
  const initialFrontOverlay = page.locator('[data-mo-editor-overlay="front"]');
  const initialFrontBounds = await initialFrontOverlay.boundingBox();
  assert.ok(initialFrontBounds, "front editor must provide a field placement surface");
  await initialFrontOverlay.click({ position: { x: 10 / 297 * initialFrontBounds.width, y: 80 / 210 * initialFrontBounds.height } });
  assert.equal(await page.locator("#moLayoutWidth").inputValue(), "105", "address fields should start with a readable source-appropriate width");
  assert.equal(await page.locator("#moLayoutHeight").inputValue(), "12", "address fields should start with space for wrapped lines");
  assert.equal(await page.locator("#moLayoutFontSize").inputValue(), "8");
  assert.equal(await page.locator("#moLayoutWrap").isChecked(), true);
  await page.locator("#moLayoutRemoveField").click();
  assert.equal(await page.locator("[data-mo-layout-id]").count(), 0, "the unbound default layout remains empty until an operator places a field");
  await addMoLayoutField(page, "tracking", 74, 45, 42, 8, 9, false, "left", { nativeDrag: true });
  assert.equal(await page.locator("#moLayoutFrontPreview").count(), 1);
  assert.equal(await page.locator("#moFrontPreview").count(), 0, "legacy preview IDs are omitted when the layout preview is active");
  assert.equal((await page.locator(".mo-editor-value").first().innerText()).trim(), "VPL000001", "editor field should show the mapped sample value, not only its binding label");
  assert.match(await page.locator(".mo-editor-binding").first().innerText(), /Tracking/u, "binding should remain visible as a separate editor label");
  const editorField = page.locator('.mo-editor-field[data-mo-layout-source="tracking"][data-mo-layout-slot="0"]');
  const editorFieldId = await editorField.getAttribute("data-mo-layout-id");
  assert.ok(editorFieldId, "newly placed field must retain its stable layout identifier");
  const editorFieldMm = await editorField.evaluate((element) => ({
    x: Number(element.getAttribute("data-mo-layout-x-mm")), y: Number(element.getAttribute("data-mo-layout-y-mm")),
    width: Number(element.dataset.moLayoutWidthMm), height: Number(element.dataset.moLayoutHeightMm),
    valueBackground: getComputedStyle(element.querySelector(".mo-editor-value")).backgroundColor,
    bindingAlpha: Number(getComputedStyle(element.querySelector(".mo-editor-binding")).backgroundColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/u)?.[1] ?? 1),
  }));
  const previewFieldMm = await page.frameLocator("#moLayoutFrontPreview").locator(`.mo-layout-field[data-mo-layout-field="${editorFieldId}"]`).first().evaluate((element) => ({
    x: Number.parseFloat(element.style.left), y: Number.parseFloat(element.style.top),
    width: Number.parseFloat(element.style.width), height: Number.parseFloat(element.style.height),
  }));
  assert.deepEqual({ x: editorFieldMm.x, y: editorFieldMm.y, width: editorFieldMm.width, height: editorFieldMm.height }, previewFieldMm, "editor and rendered preview must use the same mm geometry");
  assert.equal(editorFieldMm.valueBackground, "rgba(0, 0, 0, 0)", "editable value overlay must not mask the printed artwork");
  assert.ok(editorFieldMm.bindingAlpha < 1, "binding tag must remain translucent over printed artwork");
  await page.locator("[data-mo-editor-stage]").first().screenshot({ path: join(evidence, "lp060-editor-overlays-synthetic.png") });
  const pointerMetrics = await assertMoPointerGestures(page, "tracking");
  const fontBefore = Number(await page.locator("#moLayoutFontSize").inputValue());
  await page.locator("#moLayoutFontIncrease").click();
  assert.equal(Number(await page.locator("#moLayoutFontSize").inputValue()), fontBefore + 0.5);
  await page.locator("#moLayoutFontDecrease").click();
  assert.equal(Number(await page.locator("#moLayoutFontSize").inputValue()), fontBefore);
  await page.locator("#moLayoutBold").click();
  assert.equal(await page.locator("#moLayoutBold").getAttribute("aria-pressed"), "true");
  const viewportMetrics = await assertMoEditorViewport(page);
  await page.locator("#moLayoutSave").click();
  const savedLayout = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null"));
  assert.equal(savedLayout.fields.length, 1);
  assert.equal(savedLayout.fields[0].source, "tracking");
  assert.equal(savedLayout.fields[0].bold, true, "bold setting must persist with the layout definition");
  assert.doesNotMatch(JSON.stringify(savedLayout), /VPL000001|Synthetic Receiver|03001234567/u, "saved layouts must contain bindings and geometry, not record values");
  await page.locator("#moLayoutReload").click();
  assert.ok(await page.locator("[data-mo-layout-id]").count() >= 1);
  await page.locator(".mo-editor-field[data-mo-layout-id]").first().click();
  assert.equal(await page.locator("#moLayoutBold").getAttribute("aria-pressed"), "true", "saved bold style must reload");
  await page.locator("#moPreviewFinal").click();
  await page.locator("#moFinalPreview").waitFor();
  assert.equal(await page.locator("#moLayoutEditor").isVisible(), false, "clean preview must hide the editing panel");
  assert.equal(await page.locator(".mo-layout-palette:visible").count(), 0, "clean preview must hide field controls");
  await page.frameLocator("#moFinalPreview").locator(".mo-layout-field").first().waitFor();
  assert.equal(await page.frameLocator("#moFinalPreview").locator(".mo-editor-field,.mo-editor-binding,[data-mo-editor-overlay]").count(), 0, "clean preview must not expose edit outlines or binding labels");
  const cleanFirstSample = await page.frameLocator("#moFinalPreview").locator('[data-mo-layout-source="tracking"] [data-mo-layout-text]').first().innerText();
  assert.equal(cleanFirstSample.trim(), "VPL000001", "clean preview must show the mapped record value");
  const layoutBeforeRepairPreview = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  await page.locator("#moRepairLayout").click();
  await page.waitForFunction(() => document.querySelector("#moRepairBatchStatus")?.textContent?.startsWith("PASS · 3 selected records checked"), undefined, { timeout: 120000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), layoutBeforeRepairPreview, "repair proposal must not persist before explicit Apply");
  const proposedTrackingX = await page.frameLocator("#moFinalPreview").locator(".mo-layout-field").first().evaluate((field) => Number.parseFloat(field.style.left));
  assert.equal(proposedTrackingX, 103, "repair proposal must move the colliding tracking value to the safe article-number line");
  await page.locator("#moApplyLayoutRepair").click();
  await page.waitForFunction(() => {
    const download = document.querySelector("#downloadMoLayoutPdf");
    const print = document.querySelector("#printMoBatch");
    return download && print && !download.disabled && !print.disabled;
  }, undefined, { timeout: 120000 });
  const appliedTracking = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null").fields.find((field) => field.source === "tracking"));
  assert.deepEqual({ xMm: appliedTracking.xMm, widthMm: appliedTracking.widthMm, heightMm: appliedTracking.heightMm, fontSizePt: appliedTracking.fontSizePt, bold: appliedTracking.bold }, { xMm: 103, widthMm: 36, heightMm: 5.6, fontSizePt: 9, bold: true }, "explicit repair must preserve readable font and bold style while correcting geometry");
  await page.locator("#moPreviewFinal").click();
  await page.locator("#moFinalPreview").waitFor();
  await page.frameLocator("#moFinalPreview").locator(".mo-layout-field").first().waitFor();
  await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp051-mo-clean-preview-front-n3.png") });
  await page.locator("#moCleanPreviewFace").selectOption("back");
  await page.waitForFunction(() => document.querySelector("#moFinalPreview")?.srcdoc.includes('data-mo-face="back"'));
  await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp051-mo-clean-preview-back-n3.png") });
  await page.locator("#moCleanPreviewFace").selectOption("front");
  await page.locator("#moPreviewAdjustField").selectOption({ label: "Tracking (exact imported string)" });
  const previewFont = Number(await page.locator("#moPreviewFontSize").inputValue());
  await page.locator("#moPreviewFontIncrease").click();
  assert.equal(Number(await page.locator("#moPreviewFontSize").inputValue()), previewFont + 0.5, "clean preview font controls must update the shared layout");
  await page.locator("#moPreviewBold").click();
  assert.equal(await page.locator("#moPreviewBold").getAttribute("aria-pressed"), "false", "clean preview bold control must update the selected field");
  const pairedLayoutPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-layout-paired-synthetic.pdf"), 4);
  await assertMoOddBlank(pairedLayoutPdf, 3);
  await page.locator("#moPrintSideMode").selectOption("front-only");
  const frontOnlyLayoutPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-layout-front-only-synthetic.pdf"), 2);
  assert.equal(frontOnlyLayoutPdf.document.getPageCount(), 2);
  await page.locator("#moPrintSideMode").selectOption("back-only");
  const backOnlyLayoutPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-layout-back-only-synthetic.pdf"), 2);
  assert.equal(backOnlyLayoutPdf.document.getPageCount(), 2);
  await page.locator("#moPrintSideMode").selectOption("paired");
  await page.evaluate(() => {
    const original = window.setTimeout;
    Object.defineProperty(window, "__moOriginalWindowSetTimeout", { value: original, configurable: true });
    window.setTimeout = function (handler, timeout, ...args) {
      if (timeout === 30 * 60 * 1000) Object.defineProperty(window, "__moPdfBlobCleanupDelayMs", { value: timeout, writable: true, configurable: true });
      return original.call(window, handler, timeout, ...args);
    };
  });
  const layoutPrintPopupEvent = page.waitForEvent("popup", { timeout: 30000 });
  await page.locator("#printMoBatch").click();
  const layoutPrintPopup = await layoutPrintPopupEvent;
  await page.waitForFunction(() => {
    const status = document.querySelector("#moPdfStatus")?.textContent ?? "";
    return status.startsWith("Verified MO PDF opened;") || status.startsWith("MO_PRINT_TARGET_REJECTED:");
  }, undefined, { timeout: 30000 }).catch(async (error) => {
    const popupState = { url: layoutPrintPopup.url(), closed: layoutPrintPopup.isClosed(), contentType: await layoutPrintPopup.evaluate(() => document.contentType).catch(() => "UNAVAILABLE") };
    throw new Error(`${error.message}\nMO status=${await page.locator("#moPdfStatus").innerText()}\nSynthetic popup=${JSON.stringify(popupState)}`);
  });
  const printStatus = await page.locator("#moPdfStatus").innerText();
  assert.match(printStatus, /^Verified MO PDF opened;/u, `Print MO Batch must fail closed on an unexpected target: ${printStatus}`);
  await layoutPrintPopup.waitForURL((url) => url.href !== "about:blank", { timeout: 30000 });
  const printPopupDiagnostics = {
    url: layoutPrintPopup.url(),
    title: await layoutPrintPopup.title().catch(() => "UNAVAILABLE"),
    contentType: await layoutPrintPopup.evaluate(() => document.contentType).catch(() => "UNAVAILABLE"),
    pdfEmbeds: await layoutPrintPopup.locator('embed[type="application/pdf"],object[type="application/pdf"]').count().catch(() => -1),
  };
  console.log(JSON.stringify({ syntheticPrintPopupDiagnostics: printPopupDiagnostics }));
  assert.notEqual(layoutPrintPopup.url(), "about:blank", "Print MO Batch must open the generated local PDF in a browser tab");
  const verifiedPrintUrl = new URL(printPopupDiagnostics.url);
  assert.equal(layoutPrintPopup === page, false, "Print MO Batch must use a distinct popup target");
  assert.equal(verifiedPrintUrl.protocol, "blob:", "Print MO Batch must open a generated PDF blob, never a label-app route");
  assert.equal(verifiedPrintUrl.origin, new URL(baseUrl).origin, "print popup must belong to the current synthetic app origin");
  assert.equal(printPopupDiagnostics.contentType, "application/pdf", "print popup must contain only the generated MO PDF");
  assert.equal(await layoutPrintPopup.evaluate(() => window.__moPrintRequested === true), true, "the print call must occur only after PDF target verification");
  assert.equal(await page.evaluate(() => window.__moPdfBlobCleanupDelayMs), 1800000, "verified PDF blob cleanup must remain bounded to 30 minutes");
  const popupPdf = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return { status: response.status, contentType: response.headers.get("content-type"), byteLength: bytes.byteLength, base64: btoa(binary) };
  }, layoutPrintPopup.url());
  assert.equal(popupPdf.status, 200, "generated PDF blob must remain readable while its print popup is open");
  assert.equal(popupPdf.contentType, "application/pdf");
  assert.ok(popupPdf.byteLength > 0);
  const popupPdfDocument = await PDFDocument.load(Buffer.from(popupPdf.base64, "base64"));
  assert.equal(popupPdfDocument.getPageCount(), 4, "the 3-record paired PDF should contain 4 pages");
  const popupMediaBox = popupPdfDocument.getPage(0).getSize();
  assert.ok(Math.abs(popupMediaBox.width * 25.4 / 72 - 297) < 0.1 && Math.abs(popupMediaBox.height * 25.4 / 72 - 210) < 0.1, "the print popup PDF must use the A4 landscape MediaBox");
  await page.waitForTimeout(1000);
  const readableWhilePopupOpen = await page.evaluate(async (url) => {
    try { const response = await fetch(url); return response.ok && (await response.arrayBuffer()).byteLength > 0; }
    catch { return false; }
  }, layoutPrintPopup.url());
  assert.equal(readableWhilePopupOpen, true, "the PDF blob must remain available after the PDF viewer finishes opening");
  await layoutPrintPopup.close();
  const readableAfterPopupClose = await page.evaluate(async (url) => {
    try { const response = await fetch(url); return response.ok && (await response.arrayBuffer()).byteLength > 0; }
    catch { return false; }
  }, printPopupDiagnostics.url);
  assert.equal(readableAfterPopupClose, true, "popup.closed after viewer open must not prematurely revoke the generated PDF blob");
  await page.evaluate(() => {
    window.setTimeout = window.__moOriginalWindowSetTimeout;
    delete window.__moOriginalWindowSetTimeout;
    delete window.__moPdfBlobCleanupDelayMs;
  });
  await page.locator("#moReturnToLayout").click();
  await page.locator("#moLayoutReset").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), null);
  assert.equal(await page.locator("[data-mo-layout-id]").count(), 0);
  await page.locator(".mo-source-chip[data-mo-layout-source=senderName]").click();
  const backOverlay = page.locator('[data-mo-editor-overlay="back"]');
  const backBounds = await backOverlay.boundingBox();
  assert.ok(backBounds, "back face must expose a click-to-place field surface");
  await backOverlay.click({ position: { x: 30 / 297 * backBounds.width, y: 85 / 210 * backBounds.height } });
  await page.locator("#moLayoutWidth").waitFor();
  assert.equal(await page.locator(".mo-editor-field[data-mo-layout-face=back]").count(), 2, "click-to-place fallback must create one field for the back face's two half-slots");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null")), null, "click-to-place remains session-only until Save Layout");
  await page.locator(".mo-source-chip[data-mo-layout-source=senderName]").click();
  await backOverlay.click({ position: { x: 30 / 297 * backBounds.width, y: 85 / 210 * backBounds.height } });
  assert.equal(await page.locator(".mo-editor-field[data-mo-layout-face=back]").count(), 2, "dropping an identical source at the same point must not create a duplicate");
  await page.locator("#moLayoutReset").click();
  await importMoBatch(3);
  const preLp052Layout = { version: 1, fields: [
    { id: "legacy-sender-name", source: "senderName", face: "front", xMm: 7.7, yMm: 85.8, widthMm: 100.7, heightMm: 4.8, fontSizePt: 8.5, alignment: "left", wrap: false },
    { id: "legacy-receiver-name", source: "name", face: "front", xMm: 7.7, yMm: 112.8, widthMm: 100.7, heightMm: 4.8, fontSizePt: 8.5, alignment: "left", wrap: false },
    { id: "legacy-custom-tracking", source: "tracking", face: "front", xMm: 74, yMm: 45, widthMm: 42, heightMm: 8, fontSizePt: 9, alignment: "center", wrap: false, bold: true },
  ] };
  await page.evaluate((layout) => localStorage.setItem("gfs-mo51-layout-v1", JSON.stringify(layout)), preLp052Layout);
  await page.locator("#moLayoutReload").click();
  await page.locator("#moCorrectLegacyPartyPositions").waitFor();
  await page.waitForFunction(() => document.querySelector("#downloadMoLayoutPdf")?.disabled === true);
  const storedLegacyBeforeFailedCorrection = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  await page.evaluate(() => {
    const prototype = Storage.prototype;
    const original = prototype.setItem;
    Object.defineProperty(window, "__moOriginalStorageSetItem", { value: original, configurable: true });
    prototype.setItem = function (key, value) {
      if (key === "gfs-mo51-layout-v1") throw new DOMException("synthetic storage blocked", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator("#moCorrectLegacyPartyPositions").click();
  await page.waitForFunction(() => /Party-position correction was not saved/u.test(document.querySelector("[data-mo-view]")?.textContent ?? ""));
  assert.equal(await page.locator("#moCorrectLegacyPartyPositions").count(), 1, "failed persistence must keep the legacy correction gate active");
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), storedLegacyBeforeFailedCorrection, "failed persistence must preserve the saved legacy layout");
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__moOriginalStorageSetItem;
    delete window.__moOriginalStorageSetItem;
  });
  await page.locator("#moCorrectLegacyPartyPositions").click();
  await page.waitForFunction(() => !document.querySelector("#moCorrectLegacyPartyPositions") && document.querySelector("#downloadMoLayoutPdf")?.disabled === true && /Tracking \(exact imported string\) overlaps printed MO text/u.test(document.querySelector("#moMappingFitError")?.textContent ?? ""));
  const migratedLayout = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null"));
  assert.equal(migratedLayout.version, 2, "pre-LP-052 saved layout upgrades to one current schema");
  assert.equal(migratedLayout.partyPositionVersion, 2);
  assert.deepEqual(migratedLayout.fields.map(({ id, xMm, yMm, bold, widthMm }) => ({ id, xMm, yMm, bold, widthMm })), [
    { id: "legacy-sender-name", xMm: 7.7, yMm: 112.8, bold: false, widthMm: 100.7 },
    { id: "legacy-receiver-name", xMm: 7.7, yMm: 85.8, bold: false, widthMm: 100.7 },
    { id: "legacy-custom-tracking", xMm: 74, yMm: 45, bold: true, widthMm: 42 },
  ], "legacy correction preserves all IDs, bindings, styles and unrelated coordinates");
  await page.waitForFunction(() => document.querySelector("#downloadMoLayoutPdf")?.disabled === true && /Tracking \(exact imported string\) overlaps printed MO text/u.test(document.querySelector("#moMappingFitError")?.textContent ?? ""), undefined, { timeout: 10000 });
  const legacyTrackingIssue = await page.locator("#moMappingFitError").innerText();
  assert.match(legacyTrackingIssue, /Source row 1, left form \(front\): Tracking \(exact imported string\) overlaps printed MO text “No\. of V\. P\. Article”/u);
  await page.getByRole("button", { name: "Select Tracking (exact imported string) (front)" }).first().click();
  assert.equal(await page.locator(".mo-layout-properties").getAttribute("data-mo-selected-layout-field"), "legacy-custom-tracking", "artwork collision must select the field that needs repair");
  await page.locator("#moLayoutX").fill("103");
  await page.locator("#moLayoutX").press("Tab");
  await page.locator("#moLayoutWidth").fill("36");
  await page.locator("#moLayoutWidth").press("Tab");
  await page.locator("#moLayoutHeight").fill("4.8");
  await page.locator("#moLayoutHeight").press("Tab");
  await page.waitForFunction(() => document.querySelector("#downloadMoLayoutPdf")?.disabled === false && !/Tracking \(exact imported string\) overlaps printed MO text/u.test(document.querySelector("#moMappingFitError")?.textContent ?? ""), undefined, { timeout: 10000 });
  await page.locator("#moLayoutSave").click();
  const repairedLegacyTracking = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null").fields.find((field) => field.id === "legacy-custom-tracking"));
  assert.deepEqual({ xMm: repairedLegacyTracking.xMm, yMm: repairedLegacyTracking.yMm, widthMm: repairedLegacyTracking.widthMm, heightMm: repairedLegacyTracking.heightMm }, { xMm: 103, yMm: 45, widthMm: 36, heightMm: 4.8 });
  const legacyMigrationPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-lp052-legacy-corrected-synthetic.pdf"), 4);
  const legacyPdfRaster = await rasterPdfPage(legacyMigrationPdf.bytes, 1, 1);
  await writeFile(join(evidence, "lp052-legacy-corrected-pdf-front-synthetic.png"), legacyPdfRaster.toBuffer("image/png"));
  await compareMoPdfWithPreview(page, "front", legacyMigrationPdf.bytes, 1, true);
  await page.locator("#moLayoutReset").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), null, "reset removes the upgraded saved layout");
  console.log(JSON.stringify({ moEditorUx: { nativePaletteDrag: true, pointerMove: pointerMetrics.movedXmm, pointerResize: [pointerMetrics.resizedWidthMm, pointerMetrics.resizedHeightMm], selectedValueVsBinding: true, fontPlusMinus: true, boldPersisted: true, clickPlacementBack: true, duplicatePrevented: true, viewports: viewportMetrics } }));

  await importMoBatch(42);
  await page.locator("#moPrintSideMode").selectOption("paired");
  await page.frameLocator("#moLayoutFrontPreview").locator("[data-mo-sender-cnic-anchor]").first().waitFor();
  const senderCnicPlacementProbe = await page.evaluate(() => {
    const overlay = document.querySelector('[data-mo-editor-overlay="front"]');
    if (!overlay) return { error: "FRONT_OVERLAY_MISSING", placed: -1 };
    const rect = overlay.getBoundingClientRect();
    const transfer = new DataTransfer();
    transfer.setData("application/x-mo-layout-source", "senderCnic");
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      dataTransfer: { value: transfer },
      clientX: { value: rect.left + rect.width * 0.25 },
      clientY: { value: rect.top + rect.height * 0.6 },
    });
    overlay.dispatchEvent(drop);
    return {
      placed: document.querySelectorAll('.mo-editor-field[data-mo-layout-source="senderCnic"]').length,
      error: document.querySelector("#moMappingFitError")?.textContent?.trim() ?? "",
    };
  });
  console.log(JSON.stringify({ senderCnicPlacementProbe }));
  assert.equal(senderCnicPlacementProbe.error, "", "Sender CNIC must resolve the semantic Sender line after Receiver/Sender reordering");
  assert.equal(senderCnicPlacementProbe.placed, 2, "the semantic Sender CNIC field must appear on both front halves only");
  await page.waitForFunction(() => {
    const boxes = [...document.querySelectorAll('.mo-editor-field[data-mo-layout-source="senderCnic"]')];
    return boxes.length === 2 && boxes.every((box) => box.dataset.moSemanticAnchorReady === "true");
  }, undefined, { timeout: 10000 });
  const cnicAnchorAlignment = await page.evaluate(() => {
    const frame = document.querySelector("#moLayoutFrontPreview");
    const overlay = document.querySelector('[data-mo-editor-overlay="front"]');
    if (!(frame instanceof HTMLIFrameElement) || !(overlay instanceof HTMLElement) || !frame.contentDocument) return [];
    const frameRect = frame.getBoundingClientRect(), overlayRect = overlay.getBoundingClientRect();
    const scaleX = frameRect.width / frame.clientWidth, scaleY = frameRect.height / frame.clientHeight;
    return ["left", "right"].map((slot) => {
      const box = overlay.querySelector(`.mo-editor-field[data-mo-layout-source="senderCnic"][data-mo-layout-slot="${slot === "left" ? 0 : 1}"]`);
      const line = frame.contentDocument.querySelector(`.mo-half[data-mo-slot="${slot}"] [data-mo-party-block="sender"] [data-mo-sender-cnic-anchor]`);
      if (!box || !line) return { slot, missing: true };
      const boxRect = box.getBoundingClientRect(), lineRect = line.getBoundingClientRect();
      const expectedLeft = frameRect.left + (lineRect.left + 2) * scaleX;
      const expectedBottom = frameRect.top + lineRect.bottom * scaleY;
      return { slot, aligned: Math.abs(boxRect.left - expectedLeft) < 1 && Math.abs(boxRect.bottom - expectedBottom) < 1, boxLeft: boxRect.left, expectedLeft, boxBottom: boxRect.bottom, expectedBottom, lineLeft: lineRect.left, lineBottom: lineRect.bottom, frameLeft: frameRect.left, frameTop: frameRect.top, overlayLeft: overlayRect.left, overlayTop: overlayRect.top, scaleX, scaleY };
    });
  });
  assert.deepEqual(cnicAnchorAlignment.map(({ aligned }) => aligned), [true, true], "editor CNIC boxes must track the Sender artwork anchor on both halves");
  await page.locator("#moLayoutReset").click();
  await addMoLayoutField(page, "declaredPrincipal", 18, 50, 35, 5, 8.5, false, "center");
  await addMoLayoutField(page, "tracking", 103, 45, 36, 4.8, 8);
  await addMoLayoutField(page, "senderName", 7.7, 112.8, 100.7, 4.8, 8.5);
  await addMoLayoutField(page, "senderAddress", 7.7, 117.6, 100.7, 4.8, 8);
  await addMoLayoutField(page, "name", 7.7, 85.8, 100.7, 4.8, 8.5);
  await addMoLayoutField(page, "address", 7.7, 90.6, 74, 9.6, 7.5, true);
  await addMoLayoutField(page, "phone", 83, 100.2, 25.4, 4.8, 7.5);
  await addMoLayoutField(page, "city", 7.7, 105, 50, 4.8, 7);
  await addMoLayoutField(page, "province", 60, 105, 48.4, 4.8, 7);
  await addMoLayoutField(page, "orderDate", 27, 18, 13.8, 10.5, 6.5, false, "center");
  await page.locator("#moLayoutSave").click();
  await page.locator(".mo-editor-field[data-mo-layout-source=address]").first().click();
  await page.locator("#moLayoutHeight").fill("16");
  await page.locator("#moLayoutHeight").press("Tab");
  await page.waitForFunction(() => document.querySelector("#downloadMoLayoutPdf")?.disabled === true && /overlap/u.test(document.querySelector("#moMappingFitError")?.textContent ?? ""), undefined, { timeout: 10000 });
  const overlapMessage = await page.locator("#moMappingFitError").innerText();
  assert.match(overlapMessage, /Source row 1, left form \(front\): Label receiver\/display address overlaps Label city/u);
  assert.match(overlapMessage, /Source row 1, left form \(front\): Label receiver\/display address overlaps Label province/u);
  assert.doesNotMatch(overlapMessage, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu, "printable layout errors must not expose field UUIDs");
  const addressFieldId = await page.locator('.mo-editor-field[data-mo-layout-source="address"]').first().getAttribute("data-mo-layout-id");
  await page.getByRole("button", { name: "Select Label receiver/display address (front)" }).first().click();
  assert.equal(await page.locator(".mo-layout-properties").getAttribute("data-mo-selected-layout-field"), addressFieldId, "a diagnostic action must select the affected field for repair");
  await page.locator("#moLayoutHeight").fill("9.6");
  await page.locator("#moLayoutHeight").press("Tab");
  const savedLayoutBeforeRepairPreview = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  await page.locator("#moRepairLayout").click();
  await page.waitForFunction(() => document.querySelector("#moRepairBatchStatus")?.textContent?.startsWith("PASS · 42 selected records checked"), undefined, { timeout: 180000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), savedLayoutBeforeRepairPreview, "N42 proposal must leave the previously saved custom layout unchanged until Apply");
  await page.locator("#moApplyLayoutRepair").click();
  await page.waitForFunction(() => {
    const download = document.querySelector("#downloadMoLayoutPdf");
    const print = document.querySelector("#printMoBatch");
    return download && print && !download.disabled && !print.disabled;
  }, undefined, { timeout: 180000 });
  const n42Pair = async (face = "front") => page.frameLocator(face === "front" ? "#moLayoutFrontPreview" : "#moLayoutBackPreview").locator(".mo-half[data-mo-slot]").evaluateAll((halves) => halves.map((half) => ({
    slot: half.getAttribute("data-mo-slot"),
    sourceIndex: Number(half.getAttribute("data-mo-source-index")),
    fields: Object.fromEntries([...half.querySelectorAll("[data-mo-layout-source]")].map((field) => [field.getAttribute("data-mo-layout-source"), field.textContent.trim()])),
  })));
  const n42First = await n42Pair();
  assert.deepEqual(n42First.map((item) => item.sourceIndex + 1), [1, 22], "N=42 staging-sized batch first sheet must pair 1/22");
  assert.deepEqual(n42First.map((item) => [item.fields.tracking, item.fields.declaredPrincipal, item.fields.name, item.fields.senderName, item.fields.senderAddress, item.fields.phone, item.fields.orderDate]), [
    ["VPL000001", "20100", "Synthetic Receiver 1", "Synthetic Sender", "Synthetic Sender Return", "03100000001", "01-01-26"],
    ["VPP000022", "22200", "Synthetic Receiver 22", "Synthetic Sender", "Synthetic Sender Return", "03100000022", "22-01-26"],
  ], "N=42 first-sheet values must come from their source rows");
  assert.match(n42First[0].fields.tracking, /^VPL/u);
  assert.match(n42First[1].fields.tracking, /^VPP/u);
  assert.notEqual(n42First[0].fields.orderDate, "31-12-99", "Month Stamp sample must not use the Excel zero-date fallback");
  const n42PartyOrder = await page.frameLocator("#moLayoutFrontPreview").locator('.mo-half[data-mo-slot="left"]').evaluate((half) => {
    const receiver = half.querySelector('[data-mo-party-block="receiver"]');
    const sender = half.querySelector('[data-mo-party-block="sender"]');
    return { receiverTop: receiver?.getBoundingClientRect().top, senderTop: sender?.getBoundingClientRect().top, receiverCaption: receiver?.querySelector('[data-mo-party-caption="receiver"]')?.textContent?.trim(), senderCaption: sender?.querySelector('[data-mo-party-caption="sender"]')?.textContent?.trim() };
  });
  assert.ok(Number.isFinite(n42PartyOrder.receiverTop) && n42PartyOrder.receiverTop < n42PartyOrder.senderTop, "independent Section 1 layout DOM assertion: Receiver remains upper and Sender lower");
  assert.match(n42PartyOrder.receiverCaption ?? "", /وصول کرنے والے/u);
  assert.match(n42PartyOrder.senderCaption ?? "", /بھیجنے والے کا نام/u);
  const n42LayoutPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-layout-synthetic-n42.pdf"), 42);
  const n42PdfPage1Front = await compareMoPdfWithPreview(page, "front", n42LayoutPdf.bytes, 1, true);
  const n42PdfPage2Back = await compareMoPdfWithPreview(page, "back", n42LayoutPdf.bytes, 2, true);
  await writeFile(join(evidence, "lp057-mo-n42-pdf-page1-front-synthetic.png"), n42PdfPage1Front.toBuffer("image/png"));
  await writeFile(join(evidence, "lp057-mo-n42-pdf-page2-back-synthetic.png"), n42PdfPage2Back.toBuffer("image/png"));
  await page.locator("#moSheetSelect").selectOption({ label: "11" });
  await page.waitForFunction(() => document.querySelector("#moSheetSelect")?.value === "10" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="left"]')?.getAttribute("data-mo-source-index") === "10" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="right"]')?.getAttribute("data-mo-source-index") === "31", undefined, { timeout: 15000 });
  const n42MiddleFront = await n42Pair("front"), n42MiddleBack = await n42Pair("back");
  assert.deepEqual(n42MiddleFront.map((item) => item.sourceIndex + 1), [11, 32]);
  assert.deepEqual(n42MiddleBack.map((item) => item.sourceIndex), n42MiddleFront.map((item) => item.sourceIndex));
  assert.equal(n42MiddleFront[0].fields.address, "Synthetic St 11 Block 3 Address Segment 1 Address Segment 2 Address Segment 3 Address Segment 4", "long synthetic address must remain complete through wrapping");
  await compareMoPdfWithPreview(page, "front", n42LayoutPdf.bytes, 21, true);
  await compareMoPdfWithPreview(page, "back", n42LayoutPdf.bytes, 22, true);
  await page.locator("#moSheetSelect").selectOption({ label: "21" });
  await page.waitForFunction(() => document.querySelector("#moSheetSelect")?.value === "20" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="left"]')?.getAttribute("data-mo-source-index") === "20" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="right"]')?.getAttribute("data-mo-source-index") === "41", undefined, { timeout: 15000 });
  const n42LastFront = await n42Pair("front"), n42LastBack = await n42Pair("back");
  assert.deepEqual(n42LastFront.map((item) => item.sourceIndex + 1), [21, 42], "N=42 final sheet must pair 21/42");
  assert.deepEqual(n42LastBack.map((item) => item.sourceIndex), n42LastFront.map((item) => item.sourceIndex), "N=42 backs must match the same source rows");
  assert.deepEqual(n42LastFront.map((item) => [item.fields.tracking, item.fields.declaredPrincipal, item.fields.name, item.fields.orderDate]), [
    ["VPL000021", "22100", "Synthetic Receiver 21", "21-01-26"],
    ["VPP000042", "24200", "Synthetic Receiver 42", "11-02-26"],
  ]);
  const n42PdfPage41Front = await compareMoPdfWithPreview(page, "front", n42LayoutPdf.bytes, 41, true);
  const n42PdfPage42Back = await compareMoPdfWithPreview(page, "back", n42LayoutPdf.bytes, 42, true);
  await writeFile(join(evidence, "lp057-mo-n42-pdf-page41-front-synthetic.png"), n42PdfPage41Front.toBuffer("image/png"));
  await writeFile(join(evidence, "lp057-mo-n42-pdf-page42-back-synthetic.png"), n42PdfPage42Back.toBuffer("image/png"));
  console.log(JSON.stringify({ moLayoutN42: { pages: n42LayoutPdf.document.getPageCount(), firstPair: [1, 22], middlePair: [11, 32], finalPair: [21, 42], sourceFieldsChecked: 10, previewPdfPagesCompared: [1, 2, 21, 22, 41, 42] } }));
  await page.locator("#moLayoutReset").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), null);

  console.log(JSON.stringify({ moLayoutN100: "import-start" }));
  await importMoBatch(100);
  console.log(JSON.stringify({ moLayoutN100: "imported" }));
  await page.locator("#moPrintSideMode").selectOption("paired");
  await addMoLayoutField(page, "tracking", 103, 45, 36, 4.8, 8);
  await addMoLayoutField(page, "declaredPrincipal", 18, 50, 35, 5, 8.5, false, "center");
  await addMoLayoutField(page, "senderName", 7.7, 112.8, 100.7, 4.8, 8.5);
  await addMoLayoutField(page, "senderAddress", 7.7, 117.6, 100.7, 4.8, 8);
  await addMoLayoutField(page, "name", 7.7, 85.8, 100.7, 4.8, 8.5, false, "left", { bold: true });
  await addMoLayoutField(page, "address", 7.7, 90.6, 74, 9.6, 7.5, true);
  await addMoLayoutField(page, "phone", 83, 100.2, 25.4, 4.8, 7.5);
  await addMoLayoutField(page, "city", 7.7, 105, 50, 4.8, 7);
  await addMoLayoutField(page, "province", 60, 105, 48.4, 4.8, 7);
  await addMoLayoutField(page, "orderDate", 27, 18, 13.8, 10.5, 6.5, false, "center");
  await page.locator("#moLayoutSave").click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#moMappingFitError")?.textContent ?? "";
    return text.includes("Mapped layout fields require attention") && !text.startsWith("Checking ");
  }, undefined, { timeout: 180000 });
  assert.equal(await page.locator("#downloadMoLayoutPdf").isDisabled(), true, "pre-repair N100 fields must keep mapped output blocked");
  const n100LayoutBeforeProposal = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
  console.log(JSON.stringify({ moLayoutN100: "blocking-layout-reproduced" }));
  await page.locator("#moRepairLayout").click();
  await page.waitForFunction(() => document.querySelector("#moRepairBatchStatus")?.textContent?.startsWith("PASS · 100 selected records checked"), undefined, { timeout: 180000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), n100LayoutBeforeProposal, "N100 repair preview must not alter the customized saved layout");
  await page.locator("#moApplyLayoutRepair").click();
  await page.waitForFunction(() => {
    const download = document.querySelector("#downloadMoLayoutPdf");
    const print = document.querySelector("#printMoBatch");
    return download && print && !download.disabled && !print.disabled;
  }, undefined, { timeout: 180000 });
  const n100RepairedLayout = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null"));
  assert.equal(n100RepairedLayout.fields.find((field) => field.source === "tracking").xMm, 103);
  assert.equal(n100RepairedLayout.fields.find((field) => field.source === "address").heightMm, 14.4);
  assert.equal(n100RepairedLayout.fields.find((field) => field.source === "name").bold, true, "Repair Layout must preserve the customized bold face");
  console.log(JSON.stringify({ moLayoutN100: "layout-repaired-and-validated" }));
  await page.locator("#moPreviewFinal").click();
  await page.locator("#moFinalPreview").waitFor();
  console.log(JSON.stringify({ moLayoutN100: "preview-open" }));
  assert.equal(await page.locator("#moLayoutEditor").isVisible(), false);
  assert.equal(await page.locator(".mo-layout-palette:visible").count(), 0);
  await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp051-mo-clean-preview-front-n100.png") });
  await page.locator("#moCleanPreviewFace").selectOption("back");
  await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp051-mo-clean-preview-back-n100.png") });
  await page.locator("#moCleanPreviewFace").selectOption("front");
  const n100Pair = async () => page.frameLocator("#moFinalPreview").locator(".mo-half[data-mo-slot]").evaluateAll((halves) => halves.map((half) => ({
    slot: half.getAttribute("data-mo-slot"),
    sourceIndex: Number(half.getAttribute("data-mo-source-index")),
    fields: Object.fromEntries([...half.querySelectorAll("[data-mo-layout-source]")].map((field) => [field.getAttribute("data-mo-layout-source"), field.textContent.trim()])),
  })));
  const n100FirstPair = await n100Pair();
  assert.deepEqual(n100FirstPair.map((item) => item.sourceIndex + 1), [1, 51], "N=100 first sheet must pair records 1/51");
  assert.deepEqual(n100FirstPair.map((item) => [item.fields.tracking, item.fields.declaredPrincipal, item.fields.name, item.fields.senderName, item.fields.senderAddress, item.fields.address, item.fields.phone, item.fields.city, item.fields.province, item.fields.orderDate]), [
    ["VPL000001", "20100", "Synthetic Receiver 1", "Synthetic Sender", "Synthetic Sender Return", "Synthetic St 1", "03100000001", "Sahiwal", "Punjab", "01-01-26"],
    ["VPL000051", "25100", "Synthetic Receiver 51", "Synthetic Sender", "Synthetic Sender Return", "Synthetic St 51", "03100000051", "Sahiwal", "Punjab", "20-02-26"],
  ], "N=100 first-sheet fields must belong to records 1/51");
  captureMappedPdfAudit = true;
  console.log(JSON.stringify({ moLayoutN100: "pdf-start" }));
  page.on("console", (message) => { if (message.text().startsWith("LP051_N100_PROGRESS")) console.log(message.text()); });
  await page.evaluate(() => {
    let last = 0;
    const observer = new MutationObserver(() => {
      const status = document.querySelector("#moPdfStatus")?.textContent ?? "";
      const completed = Number(/^Rendering mapped batch: (\d+)\/100 pages$/u.exec(status)?.[1] ?? 0);
      if (completed >= last + 20) { last = completed; console.log(`LP051_N100_PROGRESS ${completed}/100`); }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__lp051N100ProgressObserver = observer;
  });
  const n100LayoutPdf = await saveMoLayoutPdf(page, join(temporary, "mo51-layout-synthetic-n100.pdf"), 100, 180000);
  await page.evaluate(() => window.__lp051N100ProgressObserver?.disconnect());
  console.log(JSON.stringify({ moLayoutN100: "pdf-ready" }));
  captureMappedPdfAudit = false;
  const mappedPdfAudit = mappedPdfAuditEvents.at(-1);
  assert.equal(mappedPdfAudit?.eventType, "PDF_GENERATED", "mapped MO PDF must emit the existing audit event after generation");
  assert.deepEqual(mappedPdfAudit?.counts, { rows: 100, pages: 100 }, "MO audit evidence must contain counts only");
  assert.doesNotMatch(JSON.stringify(mappedPdfAudit), /Synthetic Receiver|VPL000001|Sahiwal|03001234567/u, "MO PDF audit event must not contain customer values");
  await page.locator("#moCleanPreviewFace").selectOption("front");
  const n100PdfPage1Front = await compareMoPdfWithPreview(page, "front", n100LayoutPdf.bytes, 1, true);
  await writeFile(join(evidence, "lp057-mo-n100-pdf-page1-front-synthetic.png"), n100PdfPage1Front.toBuffer("image/png"));
  await page.locator("#moCleanPreviewFace").selectOption("back");
  const n100PdfPage2Back = await compareMoPdfWithPreview(page, "back", n100LayoutPdf.bytes, 2, true);
  await writeFile(join(evidence, "lp057-mo-n100-pdf-page2-back-synthetic.png"), n100PdfPage2Back.toBuffer("image/png"));
  await page.locator("#moSheetSelect").selectOption({ label: "50" });
  await page.waitForFunction(() => document.querySelector("#moSheetSelect")?.value === "49" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="left"]')?.getAttribute("data-mo-source-index") === "49" && document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelector('.mo-half[data-mo-slot="right"]')?.getAttribute("data-mo-source-index") === "99", undefined, { timeout: 15000 });
  await page.locator("#moCleanPreviewFace").selectOption("front");
  const n100LastPair = await n100Pair();
  assert.deepEqual(n100LastPair.map((item) => item.sourceIndex + 1), [50, 100], "N=100 final sheet must pair records 50/100");
  assert.deepEqual(n100LastPair.map((item) => [item.fields.tracking, item.fields.declaredPrincipal, item.fields.name, item.fields.senderName, item.fields.senderAddress, item.fields.address, item.fields.phone, item.fields.city, item.fields.province, item.fields.orderDate]), [
    ["VPP000050", "25000", "Synthetic Receiver 50", "Synthetic Sender", "Synthetic Sender Return", "Synthetic St 50", "03100000050", "Sahiwal", "Punjab", "19-02-26"],
    ["VPP000100", "30000", "Synthetic Receiver 100", "Synthetic Sender", "Synthetic Sender Return", "Synthetic St 100", "03100000100", "Sahiwal", "Punjab", "10-04-26"],
  ], "N=100 final-sheet fields must belong to records 50/100");
  const n100PdfPage99Front = await compareMoPdfWithPreview(page, "front", n100LayoutPdf.bytes, 99, true);
  await writeFile(join(evidence, "lp057-mo-n100-pdf-page99-front-synthetic.png"), n100PdfPage99Front.toBuffer("image/png"));
  await page.locator("#moCleanPreviewFace").selectOption("back");
  const n100PdfPage100Back = await compareMoPdfWithPreview(page, "back", n100LayoutPdf.bytes, 100, true);
  await writeFile(join(evidence, "lp057-mo-n100-pdf-page100-back-synthetic.png"), n100PdfPage100Back.toBuffer("image/png"));
  console.log(JSON.stringify({ moLayoutN100: { pages: n100LayoutPdf.document.getPageCount(), firstPair: [1, 51], finalPair: [50, 100], sourceFieldsChecked: 10, verifiedValues: 20, monthStampFormat: "DD-MM-YY", previewPdfPagesCompared: [1, 2, 99, 100] } }));
  await page.locator("#moReturnToLayout").click();
  await page.locator("#moLayoutReset").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), null);

  const n500Context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  try {
    const n500Page = await n500Context.newPage();
    await n500Page.route("**/*", (route) => { const url = new URL(route.request().url()); return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort(); });
    const n500Cdp = await n500Context.newCDPSession(n500Page);
    await n500Cdp.send("Performance.enable");
    const n500RendererHeap = async () => (await n500Cdp.send("Performance.getMetrics")).metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
    const sequentialBatchChecks = [];
    for (const count of [42, 100]) {
      await importMoBatchFresh(n500Page, count);
      await n500Page.locator("#moPrintSideMode").selectOption("paired");
      await addMoLayoutField(n500Page, "tracking", 103, 45, 36, 4.8, 9, false, "left");
      await n500Page.locator("#moLayoutSave").click();
      const split = Math.ceil(count / 2);
      const pair = await n500Page.frameLocator("#moLayoutFrontPreview").locator(".mo-half[data-mo-slot]").evaluateAll((halves) => Object.fromEntries(halves.map((half) => [half.getAttribute("data-mo-slot"), Number(half.getAttribute("data-mo-source-index")) + 1])));
      assert.deepEqual(pair, { left: 1, right: split + 1 }, `sequential N=${count} first cut-and-stack pair`);
      const batchPdf = await saveMoLayoutPdf(n500Page, join(temporary, `mo51-sequential-layout-synthetic-n${count}.pdf`), 2 * split, 180000);
      assert.equal(batchPdf.document.getPageCount(), 2 * split);
      assert.equal(await n500Page.locator('iframe[title="Temporary MO-51 PDF rasterizer"]').count(), 0);
      sequentialBatchChecks.push({ rows: count, pages: batchPdf.document.getPageCount(), rendererHeapAfterBytes: await n500RendererHeap() });
      await n500Page.locator("#moLayoutReset").click();
      assert.equal(await n500Page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), null);
    }
    console.log(JSON.stringify({ moLayoutSequentialBatches: sequentialBatchChecks }));
    await importMoBatchFresh(n500Page, 500);
    await n500Page.locator("#moPrintSideMode").selectOption("paired");
    await addMoLayoutField(n500Page, "tracking", 103, 45, 36, 4.8, 9, false, "left");
    await n500Page.locator("#moLayoutSave").click();
    const n500Layout = await n500Page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null")));
    assert.doesNotMatch(n500Layout, /Synthetic Receiver|VPL000001|VPP000002/u, "N=500 saved layout must contain definitions only");
    const n500Pair = async () => n500Page.frameLocator("#moLayoutFrontPreview").locator(".mo-half[data-mo-slot]").evaluateAll((halves) => Object.fromEntries(halves.map((half) => [half.getAttribute("data-mo-slot"), Number(half.getAttribute("data-mo-source-index")) + 1])));
    assert.deepEqual(await n500Pair(), { left: 1, right: 251 }, "N=500 first front pair must be records 1/251");
    const rendererHeap = n500RendererHeap;
    await n500Page.locator("#downloadMoLayoutPdf").click();
    await n500Page.waitForFunction(() => /^Rendering mapped batch: \d+\/500 pages$/u.test(document.querySelector("#moPdfStatus")?.textContent ?? ""), undefined, { timeout: 60000 });
    await n500Page.locator("#cancelMoPdf").click();
    await n500Page.waitForFunction(() => (document.querySelector("#moPdfStatus")?.textContent ?? "").includes("Output cancelled; no PDF was produced."), undefined, { timeout: 30000 });
    assert.equal(await n500Page.locator('iframe[title="Temporary MO-51 PDF rasterizer"]').count(), 0, "cancelled N=500 layout export must clean temporary raster frames");
    const heapBefore = await rendererHeap();
    let heapPeak = heapBefore;
    const heapTimer = setInterval(() => { void rendererHeap().then((value) => { heapPeak = Math.max(heapPeak, value); }).catch(() => {}); }, 1000);
    const n500Started = Date.now();
    let n500LayoutPdf;
    let heapAfter = 0;
    try {
      n500LayoutPdf = await saveMoLayoutPdf(n500Page, join(temporary, "mo51-layout-synthetic-n500.pdf"), 500);
      heapAfter = await rendererHeap();
    } finally {
      clearInterval(heapTimer);
      await n500Cdp.detach();
    }
    const n500ElapsedMs = Date.now() - n500Started;
    assert.equal(await n500Page.locator('iframe[title="Temporary MO-51 PDF rasterizer"]').count(), 0, "large mapped export must remove its temporary raster frames");
    assert.equal(await n500Page.locator("#moSheetSelect").inputValue(), "0");
    await compareMoPdfWithPreview(n500Page, "front", n500LayoutPdf.bytes, 1, true);
    await n500Page.locator("#moSheetSelect").selectOption({ label: "125" });
    await n500Page.waitForFunction(() => {
      const halves = document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelectorAll(".mo-half[data-mo-slot]");
      return halves?.length === 2 && Number(halves[0].getAttribute("data-mo-source-index")) === 124 && Number(halves[1].getAttribute("data-mo-source-index")) === 374;
    }, undefined, { timeout: 15000 });
    assert.deepEqual(await n500Pair(), { left: 125, right: 375 }, "N=500 middle sheet 125 must pair records 125/375");
    await compareMoPdfWithPreview(n500Page, "front", n500LayoutPdf.bytes, 249, true);
    await compareMoPdfWithPreview(n500Page, "back", n500LayoutPdf.bytes, 250, true);
    await n500Page.locator("#moSheetSelect").selectOption({ label: "250" });
    await n500Page.waitForFunction(() => {
      const halves = document.querySelector("#moLayoutFrontPreview")?.contentDocument?.querySelectorAll(".mo-half[data-mo-slot]");
      return halves?.length === 2 && Number(halves[0].getAttribute("data-mo-source-index")) === 249 && Number(halves[1].getAttribute("data-mo-source-index")) === 499;
    }, undefined, { timeout: 15000 });
    assert.deepEqual(await n500Pair(), { left: 250, right: 500 }, "N=500 final sheet must pair records 250/500");
    await compareMoPdfWithPreview(n500Page, "front", n500LayoutPdf.bytes, 499, true);
    await compareMoPdfWithPreview(n500Page, "back", n500LayoutPdf.bytes, 500, true);
    console.log(JSON.stringify({ moLayoutN500: { pages: n500LayoutPdf.document.getPageCount(), pdfBytes: n500LayoutPdf.bytes.length, elapsedMs: n500ElapsedMs, rendererHeapBeforeBytes: heapBefore, rendererHeapPeakBytes: heapPeak, rendererHeapAfterBytes: heapAfter, firstPair: [1, 251], middlePair: [125, 375], finalPair: [250, 500], previewPdfPagesCompared: [1, 249, 250, 499, 500] } }));
  } finally {
    await n500Context.close();
  }

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ geometry, printGeometry, decodedBarcodeCounts: [3, 18, decoded500, customDecoded500], prefixExamples: { types: ["RGL", "UMS", "VPL", "VPP"], hiddenAmountBoxes: 2, visibleAmountBoxes: prefixVisibleAmountBoxes, rglUmsAmountsAbsentFromPdf: !/50000|40000|\+0/u.test(prefixPdf.text), imagePrintValues: ["25000+175", "65000+375"], pdfValuesMatch: /25000/u.test(prefixPdf.text) && /\+175/u.test(prefixPdf.text) && /65000/u.test(prefixPdf.text) && /\+375/u.test(prefixPdf.text) }, samplePdfPages: samplePdf.pageCount, batch500PdfPages: batchPdf.getPageCount(), customBatch500PdfPages: customBatchPdf.getPageCount(), overflowLayout, moProofs: ["mo51-proof-n2-front-cnic-synthetic.png", "mo51-proof-n2-back.png", "mo51-proof-n3-front-sheet1.png", "mo51-proof-n3-back-sheet1.png", "mo51-proof-n3-front-sheet2-odd-blank.png", "mo51-proof-n3-back-sheet2-odd-blank.png", "mo51-proof-n5-front-sheet1.png", "mo51-proof-n5-back-sheet1.png", "mo51-proof-n5-front-sheet3-odd-blank.png", "mo51-proof-n5-back-sheet3-odd-blank.png", "mo51-proof-n100-front-sheet1.png", "mo51-proof-n100-back-sheet1.png", "mo51-proof-n100-front-sheet50.png", "mo51-proof-n100-back-sheet50.png"], moPdfProofs: ["mo51-pdf-n2-page1-front.png", "mo51-pdf-n2-page2-back.png", "mo51-pdf-n3-page3-front-odd-blank.png", "mo51-pdf-n3-page4-back-odd-blank.png", "mo51-pdf-n5-page5-front-odd-blank.png", "mo51-pdf-n5-page6-back-odd-blank.png", "mo51-pdf-n100-page1-front-sheet1.png", "mo51-pdf-n100-page2-back-sheet1.png", "mo51-pdf-n100-page99-front-sheet50.png", "mo51-pdf-n100-page100-back-sheet50.png"], browserErrors: errors, evidence: ["test-evidence/approved-label-layout.png", "label-output-synthetic.png", "prefix-layout-samples.png", "prefixes-image-print.png", "test-evidence/label-preview-500-v2.png", "test-evidence/label-preview-custom-500.png", "test-evidence/label-preview-overflow.png", "test-evidence/label-preview-mobile.png", "test-evidence/browser-print-sheet.png", "test-evidence/pdf-sample-page.png", "test-evidence/pdf-500-first-page.png", "test-evidence/pdf-custom-500-first-page.png", "test-evidence/pdf-overflow-filtered.png"] }, null, 2));
} finally {
  await browser?.close();
  if (monitoringStub.listening) await new Promise((resolveClose) => monitoringStub.close(resolveClose));
  server.kill();
}
