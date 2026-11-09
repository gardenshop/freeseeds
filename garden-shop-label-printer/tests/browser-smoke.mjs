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
import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evidence = join(project, "test-evidence");
const baseUrl = "http://127.0.0.1:4174";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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
    "xl/worksheets/sheet1.xml": xml('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Order ID</t></is></c><c r="B1" t="inlineStr"><is><t>Name</t></is></c><c r="C1" t="inlineStr"><is><t>Cell #</t></is></c><c r="D1" t="inlineStr"><is><t>Address</t></is></c><c r="E1" t="inlineStr"><is><t>Tracking Number</t></is></c><c r="F1" t="inlineStr"><is><t>COD</t></is></c><c r="G1" t="inlineStr"><is><t>Product</t></is></c><c r="H1" t="inlineStr"><is><t>City</t></is></c><c r="I1" t="inlineStr"><is><t>Province</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>XLSX-SYN-001</t></is></c><c r="B2" t="inlineStr"><is><t>مصنوعی گاہک</t></is></c><c r="C2" s="1"><v>3330000000</v></c><c r="D2" t="inlineStr"><is><t>گلی نمبر ایک، نمونہ پتہ، مکان ۱۲</t></is></c><c r="E2" t="inlineStr"><is><t>TRK000001</t></is></c><c r="F2"><v>1250</v></c><c r="G2" t="inlineStr"><is><t>Synthetic Product</t></is></c><c r="H2" t="inlineStr"><is><t>Sahiwal</t></is></c><c r="I2" t="inlineStr"><is><t>Punjab</t></is></c></row></sheetData></worksheet>'),
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

try {
  await mkdir(evidence, { recursive: true });
  await writeFile(join("D:\\Temp\\kilo", "garden-shop-label-printer-synthetic.xlsx"), Buffer.from(syntheticXlsx()));
  await waitForServer();
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#backToAdmin").getAttribute("href"), "https://getfreeseeds-admin-staging.get-free-seeds.workers.dev/");
  await page.locator("#workbook").setInputFiles({ name: "synthetic-import.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(syntheticXlsx()) });
  await page.locator("#applyMapping").waitFor();
  await page.locator("#applyMapping").click();
  await page.waitForTimeout(1500);
  assert.ok((await page.locator("body").innerText()).includes("Monitoring unavailable. Label work is safe and was not lost."), JSON.stringify({ body: await page.locator("body").innerText(), failedRequests }));
  assert.match(await page.locator("body").innerText(), /XLSX-SYN-001/);
  await page.locator('[data-view="preview"]').first().click();
  assert.equal(await page.locator(".sheet .phone-number").first().innerText(), "03330000000");
  assert.equal(await page.locator(".sheet .phone-number").first().evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator(".sheet .phone-number").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "normalized mobile must fit completely in the contact row");
  assert.match(await page.locator(".sheet .receiver-name").first().innerText(), /مصنوعی/);
  assert.match(await page.locator(".sheet .address-text").first().innerText(), /گلی نمبر ایک/);
  await page.locator('[data-view="review"]').first().click();
  await page.locator("#newBatch").click();
  await page.locator("#sample").click();
  await page.locator("#applyMapping").click();
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 3 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  const geometry = await page.locator(".sheet").evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    const label = sheet.querySelector(".label").getBoundingClientRect();
    const slots = [...sheet.children];
    const mm = (px) => px * 25.4 / 96;
    const offset = (index) => { const box = slots[index].getBoundingClientRect(); return [mm(box.left - rect.left), mm(box.top - rect.top)]; };
    return { sheetWidthMm: mm(rect.width), sheetHeightMm: mm(rect.height), labelWidthMm: mm(label.width), labelHeightMm: mm(label.height), firstRow: [offset(0)[0], offset(1)[0], offset(2)[0]], firstColumn: [offset(0)[1], offset(3)[1], offset(6)[1], offset(9)[1], offset(12)[1], offset(15)[1]] };
  });
  assert.ok(Math.abs(geometry.sheetWidthMm - 210) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.sheetHeightMm - 297) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.labelWidthMm - 65) < 0.1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.labelHeightMm - 44) < 0.1, JSON.stringify(geometry));
  assert.deepEqual(geometry.firstRow.map((value) => Math.round(value * 10) / 10), [5, 72.5, 140]);
  assert.deepEqual(geometry.firstColumn.map((value) => Math.round(value)), [8, 55, 102, 149, 196, 243]);
  assert.ok(await page.getByText("Near by:").count() > 0);
  assert.ok(await page.getByText("TO:").count() > 0);
  assert.equal(await page.locator(".sheet .vpl-box").first().getAttribute("aria-label"), "VPL 1250/-");
  assert.equal(await page.locator(".sheet .vpl-amount").first().innerText(), "1250/-");
  assert.equal(await page.locator(".sheet .vpl-amount").first().evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator(".sheet .vpl-amount").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "VPL amount must not clip inside its capsule");
  assert.equal(await page.locator(".sheet .footer-from").first().innerText(), "From:");
  assert.equal(await page.locator(".sheet .footer-sender").first().innerText(), "Garden Shop");
  assert.equal(await page.locator(".sheet .footer-address").first().innerText(), "C/o City Post Office, Sahiwal, Punjab");
  assert.equal(await page.locator(".individual-preview .phone-number").first().innerText(), "03001234567");
  assert.equal(await page.locator(".individual-preview .phone-number").first().evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator(".individual-preview .phone-number").first().evaluate((el) => el.scrollWidth <= el.clientWidth), "individual phone value must not clip");
  await page.screenshot({ path: join(evidence, "label-preview-synthetic.png"), fullPage: true });
  const labelScreenshot = await page.locator('.sheet .label[data-label-index="0"]').screenshot({ animations: "disabled" });
  const labelBaselinePath = join(evidence, "approved-label-layout.png");
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
    return [".vpl-box", ".tracking-text", ".barcode-canvas", ".to-border", ".receiver-name", ".address-text", ".footer-address"].map((selector) => {
      const box = label.querySelector(selector).getBoundingClientRect();
      return [mm(box.left - labelBox.left), mm(box.top - labelBox.top), mm(box.width), mm(box.height)];
    });
  });
  const readFields = (root) => root.evaluate((label) => {
    const mm = (px) => px * 25.4 / 96;
    const labelBox = label.getBoundingClientRect();
    return [".vpl-box", ".tracking-text", ".barcode-canvas", ".to-border", ".receiver-name", ".address-text", ".footer-address"].map((selector) => {
      const box = label.querySelector(selector).getBoundingClientRect();
      return [mm(box.left - labelBox.left), mm(box.top - labelBox.top), mm(box.width), mm(box.height)];
    });
  });
  const previewFields = previewFieldsBeforePrint;
  await page.locator('[data-view="print"]').first().click();
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
  const sampleDownload = page.waitForEvent("download");
  await page.locator("#savePdf").click();
  const sample = await sampleDownload;
  const samplePath = join(evidence, "synthetic-sample.pdf");
  await sample.saveAs(samplePath);
  const samplePdf = await loadPdf(samplePath, "pdf-sample-page.png");
  assert.equal(samplePdf.pageCount, 1);
  assert.ok(Math.abs(samplePdf.page.getSize().width - 595.2756) < 0.01);
  assert.ok(Math.abs(samplePdf.page.getSize().height - 841.8898) < 0.01);
  assert.match(samplePdf.text, /GS-TEST-001/);
  assert.match(samplePdf.text, /VPL/);
  assert.match(samplePdf.text, /1250\/-/);
  assert.match(samplePdf.text, /TRK000001/);
  assert.match(samplePdf.text, /Near by:/);
  assert.match(samplePdf.text, /To:/);
  assert.match(samplePdf.text, /C\/o City Post Office, Sahiwal, Punjab/);
  assert.equal(samplePdf.hasRasterImage, false, "PDF barcode must stay vector");

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
    index === 0 ? "مصنوعی گاہک" : index === 1 ? "Synthetic Receiver Name With Several Descriptive Words" : `Synthetic Receiver ${index + 1}`,
    `03${String(index + 1).padStart(9, "0")}`,
    index === 0 ? "گلی نمبر ایک، نمونہ پتہ، مکان ۱۲" : index === 1 ? "Synthetic long-address segment, ".repeat(50) : `House ${index + 1}, Model Town`,
    `TRK${String(index + 1).padStart(10, "0")}`,
    String((index % 8) * 125),
    index === 2 ? "Premium Vegetable Seed Mix" : `Synthetic Garden Product ${index % 11}`,
    index === 1 ? "Nowshera" : index === 2 ? "Mardan District" : "Sahiwal",
    index === 1 ? "Khyber Pakhtunkhwa (KPK)" : "Punjab",
    index === 0 ? "Near the synthetic public library crossing" : "Main market",
  ]);
  const csv = [headers, ...records].map((row) => row.map(quote).join(",")).join("\r\n");
  await writeFile(join("D:\\Temp\\kilo", "garden-shop-label-printer-synthetic-500.csv"), Buffer.from(csv));
  await page.locator('[data-view="upload"]').first().click();
  await page.locator("#workbook").setInputFiles({ name: "synthetic-500.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("#applyMapping").waitFor();
  await page.locator("#applyMapping").click();
  await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
  assert.match(await page.locator("body").innerText(), /500 imported/);
  await page.locator('[data-view="preview"]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll(".sheet canvas[data-barcode]")].length === 18 && [...document.querySelectorAll(".sheet canvas[data-barcode]")].every((canvas) => canvas.dataset.verified === "true"), { timeout: 30000 });
  assert.ok(await page.locator('.label[data-label-index="1"] .overflow-placeholder').count() > 0, "the overlong synthetic address must be visibly flagged without overlap");
  assert.equal(await page.locator('.label[data-label-index="1"] .province-text').evaluate((el) => el.textContent?.replace(/\s+/g, " ").trim()), "Khyber Pakhtunkhwa (KPK)");
  assert.equal(await page.locator('.label[data-label-index="1"] .province-text').evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.equal(await page.locator('.label[data-label-index="2"] .city-text').evaluate((el) => el.textContent?.replace(/\s+/g, " ").trim()), "Mardan District");
  assert.equal(await page.locator('.label[data-label-index="2"] .city-text').evaluate((el) => el.classList.contains("text-overflow")), false);
  assert.ok(await page.locator('.label[data-label-index="2"] .product-text .overflow-placeholder').count() > 0, "exceptionally long product must be flagged instead of clipped");
  await page.locator(".sheet").screenshot({ path: join(evidence, "label-preview-500.png") });
  const overflowLayout = await page.locator('.sheet .label[data-label-index="1"]').evaluate((label) => {
    const address = label.querySelector(".address-text");
    const nearby = label.querySelector(".landmark");
    const contact = label.querySelector(".contact");
    const footer = label.querySelector(".footer-from");
    const bottom = (element) => element.getBoundingClientRect().bottom;
    return { warning: Boolean(label.querySelector(".overflow-placeholder")), addressBeforeNearby: bottom(address) <= nearby.getBoundingClientRect().top + 1, nearbyBeforeContact: nearby.getBoundingClientRect().right <= contact.getBoundingClientRect().left, contactBeforeFooter: bottom(contact) <= footer.getBoundingClientRect().top + 1 };
  });
  assert.deepEqual(overflowLayout, { warning: true, addressBeforeNearby: true, nearbyBeforeContact: true, contactBeforeFooter: true });
  let decoded500 = 0;
  for (let pageIndex = 0; pageIndex < 28; pageIndex += 1) {
    const expectedCount = Math.min(18, 500 - pageIndex * 18);
    const decoded = await page.locator(".sheet canvas[data-barcode]").evaluateAll((canvases) => canvases.map((canvas) => ({ index: Number(canvas.dataset.barcode), verified: canvas.dataset.verified, tracking: canvas.getAttribute("aria-label")?.replace("Code 128 tracking ", "") })));
    assert.equal(decoded.length, expectedCount, `unexpected label count on synthetic sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.index), Array.from({ length: expectedCount }, (_, index) => pageIndex * 18 + index));
    assert.ok(decoded.every((item) => item.verified === "true"), `barcode decode failed on synthetic sheet ${pageIndex + 1}`);
    assert.deepEqual(decoded.map((item) => item.tracking), records.slice(pageIndex * 18, pageIndex * 18 + expectedCount).map((row) => row[4]));
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
  await page.locator('[data-view="print"]').first().click();
  assert.match(await page.locator("body").innerText(), /28 A4 pages/);
  const batchDownload = page.waitForEvent("download");
  await page.locator("#savePdf").click();
  const batch = await batchDownload;
  const batchPath = join(evidence, "synthetic-500-labels.pdf");
  await batch.saveAs(batchPath);
  const batchPdfRendered = await loadPdf(batchPath, "pdf-500-first-page.png");
  const batchPdf = batchPdfRendered.pdf;
  assert.equal(batchPdf.getPageCount(), 28);
  assert.equal(batchPdfRendered.hasRasterImage, true, "complex-script text must use the Unicode-safe raster fallback");
  assert.match(batchPdfRendered.text, /Nowshera/);
  assert.match(batchPdfRendered.text, /Khyber Pakhtunkhwa/);
  assert.ok(Math.abs(batchPdf.getPage(0).getSize().width - 595.2756) < 0.01);
  await page.locator('[data-view="review"]').first().click();
  await page.locator('[data-edit="2"]').click();
  assert.equal(await page.locator('.edit-form input[name="product"]').inputValue(), "Premium Vegetable Seed Mix");
  await page.locator(".edit-form [data-cancel]").click();
  assert.ok(Math.abs(batchPdf.getPage(0).getSize().height - 841.8898) < 0.01);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ geometry, printGeometry, decodedBarcodeCounts: [3, 18, decoded500], samplePdfPages: samplePdf.pageCount, batch500PdfPages: batchPdf.getPageCount(), overflowLayout, browserErrors: errors, evidence: ["test-evidence/approved-label-layout.png", "test-evidence/label-preview-synthetic.png", "test-evidence/label-preview-500.png", "test-evidence/label-preview-mobile.png", "test-evidence/browser-print-sheet.png", "test-evidence/pdf-sample-page.png", "test-evidence/pdf-500-first-page.png"] }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
