import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

async function compareMoPdfWithPreview(page, face, pdfBytes, pageNumber) {
  const previewBytes = await page.frameLocator(face === "front" ? "#moFrontPreview" : "#moBackPreview").locator(".mo-sheet").screenshot();
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
  assert.ok(meanDifference < 0.1, `${face} PDF raster should match I2 preview; normalized mean difference ${meanDifference}`);
  return raster;
}

async function setMoMapping(page, sourceIndex, key, value) {
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
    if (/Synthetic Receiver|Synthetic address|آزمائشی|0000012345678|00000-1234567-8/u.test(content)) moSourceDataRequested = true;
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
  await page.context().addInitScript(() => Object.defineProperty(window, "print", { configurable: true, value: () => { window.__labelPrintRequested = true; } }));
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

  const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark"];
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

  async function importMoBatch(count) {
    if (await page.locator("#newBatch").count() === 0) await page.locator('[data-view="review"]').first().click();
    await page.locator("#newBatch").click();
    const moRows = Array.from({ length: count }, (_, index) => [
      `MO-SYN-${String(index + 1).padStart(3, "0")}`,
      `Synthetic Receiver ${index + 1}`,
      "03001234567",
      `Synthetic St ${index + 1}`,
      `${index % 2 ? "VPP" : "VPL"}${String(index + 1).padStart(6, "0")}`,
      "25000",
      "Synthetic parcel only",
      "Sahiwal",
      "Punjab",
      "Synthetic landmark",
    ]);
    const csv = [headers, ...moRows].map((row) => row.map(quote).join(",")).join("\r\n");
    await page.locator("#workbook").setInputFiles({ name: `mo-synthetic-${count}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.locator("#applyMapping").click();
    await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
    await page.locator('[data-view="mo"]').click();
    await page.waitForFunction(() => {
      const frame = document.querySelector("#moFrontPreview");
      return frame?.contentDocument?.querySelector(".mo-sheet") && frame.contentDocument.fonts.status === "loaded";
    }, { timeout: 30000 });
    assert.match(await page.locator(".mo-summary").innerText(), new RegExp(`${count}\\s+eligible VPL/VPP rows used for copy quantity only`, "u"));
  }

  async function importMoMixedPrefixes() {
    if (await page.locator("#newBatch").count() === 0) await page.locator('[data-view="review"]').first().click();
    await page.locator("#newBatch").click();
    const mixedRows = ["VPL000101", "RGL000102", "VPP000103", "UMS000104", "VPP000105"].map((tracking, index) => [
      `MO-MIX-SYN-${index + 1}`, `Synthetic Mixed ${index + 1}`, "03001234567", `Synthetic mixed address ${index + 1}`,
      tracking, "25000", "Synthetic item", "Sahiwal", "Punjab", "Synthetic landmark",
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
        const senderLabels = value.closest(".page")?.querySelector('div[style*="width:104px"]');
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
  const moPdfFrontRaster = await compareMoPdfWithPreview(page, "front", moPdfDownload.bytes, 1);
  const moPdfBackRaster = await compareMoPdfWithPreview(page, "back", moPdfDownload.bytes, 2);
  await writeFile(join(evidence, "mo51-pdf-n2-page1-front.png"), moPdfFrontRaster.toBuffer("image/png"));
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
  assert.match(confirmedFront, /VPL000001/u, "selected exact tracking source appears in the V.P. article field");
  assert.match(confirmedFront, /25000/u, "only validated principal is selected; no label commission is added");
  assert.doesNotMatch(confirmedFront, /25175/u, "label commission must not be merged into principal");
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
  assert.doesNotMatch(mappedStorage, /آزمائشی وصول کنندہ|گلی ۱۲، آزمائشی پتہ|Synthetic Merchant|25000/u, "user-confirmed MO values must remain memory-only");
  assert.equal(allRequests.some((url) => /آزمائشی|Synthetic Receiver 1|Synthetic address 1|00000-1234567-8/u.test(url)), false, "MO candidate values and Sender CNIC must not enter request URLs");
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
  const blankAfterMapping = await saveMoGeneratedPdf(page, join(temporary, "mo51-synthetic-blank-after-mapping.pdf"), 2);
  assert.match(blankAfterMapping.document.getTitle(), /blank manual-completion/u);
  assert.ok(await compareMoPdfPages(moPdfDownload.bytes, blankAfterMapping.bytes, 1) < 0.01, "blank manual-completion PDF must ignore all selected source mappings");
  assert.ok(await compareMoPdfPages(moPdfDownload.bytes, blankAfterMapping.bytes, 2) < 0.01);

  await setMoMapping(page, 0, "receiverSource", "manual");
  await setMoMapping(page, 0, "manualReceiverAddress", "Synthetic long address ".repeat(80));
  await page.waitForFunction(() => /receiver-address/u.test(document.querySelector("#moMappingFitError")?.textContent ?? ""), { timeout: 5000 }).catch(async (error) => {
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

  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-view="mo"]').click();
  assert.equal(await page.locator("#moSenderCnic").inputValue(), "", "navigating away and back must clear the volatile sender CNIC");

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ geometry, printGeometry, decodedBarcodeCounts: [3, 18, decoded500, customDecoded500], prefixExamples: { types: ["RGL", "UMS", "VPL", "VPP"], hiddenAmountBoxes: 2, visibleAmountBoxes: prefixVisibleAmountBoxes, rglUmsAmountsAbsentFromPdf: !/50000|40000|\+0/u.test(prefixPdf.text), imagePrintValues: ["25000+175", "65000+375"], pdfValuesMatch: /25000/u.test(prefixPdf.text) && /\+175/u.test(prefixPdf.text) && /65000/u.test(prefixPdf.text) && /\+375/u.test(prefixPdf.text) }, samplePdfPages: samplePdf.pageCount, batch500PdfPages: batchPdf.getPageCount(), customBatch500PdfPages: customBatchPdf.getPageCount(), overflowLayout, moProofs: ["mo51-proof-n2-front-cnic-synthetic.png", "mo51-proof-n2-back.png", "mo51-proof-n3-front-sheet1.png", "mo51-proof-n3-back-sheet1.png", "mo51-proof-n3-front-sheet2-odd-blank.png", "mo51-proof-n3-back-sheet2-odd-blank.png", "mo51-proof-n5-front-sheet1.png", "mo51-proof-n5-back-sheet1.png", "mo51-proof-n5-front-sheet3-odd-blank.png", "mo51-proof-n5-back-sheet3-odd-blank.png", "mo51-proof-n100-front-sheet1.png", "mo51-proof-n100-back-sheet1.png", "mo51-proof-n100-front-sheet50.png", "mo51-proof-n100-back-sheet50.png"], moPdfProofs: ["mo51-pdf-n2-page1-front.png", "mo51-pdf-n2-page2-back.png", "mo51-pdf-n3-page3-front-odd-blank.png", "mo51-pdf-n3-page4-back-odd-blank.png", "mo51-pdf-n5-page5-front-odd-blank.png", "mo51-pdf-n5-page6-back-odd-blank.png", "mo51-pdf-n100-page1-front-sheet1.png", "mo51-pdf-n100-page2-back-sheet1.png", "mo51-pdf-n100-page99-front-sheet50.png", "mo51-pdf-n100-page100-back-sheet50.png"], browserErrors: errors, evidence: ["test-evidence/approved-label-layout.png", "label-output-synthetic.png", "prefix-layout-samples.png", "prefixes-image-print.png", "test-evidence/label-preview-500-v2.png", "test-evidence/label-preview-custom-500.png", "test-evidence/label-preview-overflow.png", "test-evidence/label-preview-mobile.png", "test-evidence/browser-print-sheet.png", "test-evidence/pdf-sample-page.png", "test-evidence/pdf-500-first-page.png", "test-evidence/pdf-custom-500-first-page.png", "test-evidence/pdf-overflow-filtered.png"] }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
