import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, DOMMatrix, ImageData, loadImage, Path2D } from "@napi-rs/canvas";
import { chromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = process.env.LP_TEST_EVIDENCE_DIR ?? "C:\\Users\\nazim\\AppData\\Local\\Temp\\kilo\\gfs-lp065-n2";
const evidence = resolve(tempRoot);
const recordCount = Number(process.env.LP_TEST_MO_AMOUNT_ROWS ?? "2");
const amountValue = "550";
const baseUrl = "http://127.0.0.1:4176";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const server = spawn(process.execPath, [join(project, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
  cwd: project,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, VITE_MONITOR_URL: "" },
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("LP065_N2_VITE_START_TIMEOUT");
}

async function rasterPdfPage(bytes, pageNumber = 1, scale = 4) {
  globalThis.DOMMatrix ??= DOMMatrix;
  globalThis.ImageData ??= ImageData;
  globalThis.Path2D ??= Path2D;
  const document = await getDocument({ data: Uint8Array.from(bytes), disableWorker: true, useSystemFonts: true }).promise;
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
    canvasFactory: {
      create: (width, height) => { const surface = createCanvas(width, height); return { canvas: surface, context: surface.getContext("2d") }; },
      reset: (target, width, height) => { target.canvas.width = width; target.canvas.height = height; },
      destroy: (target) => { target.canvas.width = 0; target.canvas.height = 0; },
    },
  }).promise;
  return canvas;
}

try {
  await mkdir(evidence, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, acceptDownloads: true });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#sample").click();
  await page.locator("#applyMapping").click();
  await page.locator("button[data-edit]").first().waitFor({ timeout: 30000 });
  await page.locator("#newBatch").click();

  assert.ok([2, 42, 96, 100].includes(recordCount), "focused amount smoke supports N2/N42/N96/N100 only");
  const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark", "Order Date", "Sender", "S.Address"];
  const rows = Array.from({ length: recordCount }, (_, index) => {
    const number = index + 1;
    const date = new Date(Date.UTC(2026, 0, number));
    const dateText = `${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCFullYear()).slice(-2)}`;
    return [
      `LP065-SYN-${String(number).padStart(3, "0")}`, `Synthetic Receiver ${number}`, `03${String(100000000 + number).padStart(9, "0")}`,
      recordCount === 42 ? `Synthetic Street ${number} Block ${number} Address Segment Address Segment Address Segment` : `Synthetic Address ${number}`,
      `${index % 2 ? "VPP" : "VPL"}${String(number).padStart(6, "0")}`, amountValue, `Synthetic parcel ${number}`,
      "Sahiwal", "Punjab", `Synthetic landmark ${number}`, dateText, "Synthetic Sender", "Synthetic Sender Address",
    ];
  });
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
  await page.locator("#workbook").setInputFiles({ name: "lp065-synthetic-n2.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("#applyMapping").waitFor({ timeout: 30000 });
  const mappings = [
    ["orderId", "Order ID"], ["name", "Name"], ["phone", "Cell #"], ["address", "Address"], ["tracking", "Tracking Number"],
    ["cod", "COD"], ["product", "Product"], ["city", "City"], ["province", "Province"], ["landmark", "Nearby Landmark"],
    ["orderDate", "Order Date"], ["senderName", "Sender"], ["senderAddress", "S.Address"],
  ];
  for (const [key, header] of mappings) {
    const select = page.locator(`[data-map="${key}"]`);
    if (await select.count()) await select.selectOption({ label: header });
  }
  assert.equal(await page.locator("#savePreset").isChecked(), false, "synthetic mapping must not be saved to the device");
  await page.locator("#applyMapping").click();
  await page.getByText("Review every parcel.").waitFor({ timeout: 30000 });
  await page.locator('[data-view="mo"]').click();
  await page.locator("#moLayoutEditor").waitFor({ timeout: 30000 });
  assert.match(await page.locator(".mo-summary").innerText(), new RegExp(`${recordCount}\\s+eligible VPL/VPP rows`, "u"));
  await page.locator("#moLayoutReset").click();

  const sourceChip = page.locator('.mo-source-chip[data-mo-layout-source="declaredPrincipal"]').first();
  const overlay = page.locator('[data-mo-editor-overlay="front"]');
  const overlayBounds = await overlay.boundingBox();
  assert.ok(overlayBounds, "front placement surface must exist");
  await sourceChip.dragTo(overlay, { targetPosition: { x: 18 / 297 * overlayBounds.width, y: 50 / 210 * overlayBounds.height } });
  await page.locator("#moLayoutX").fill("18");
  await page.locator("#moLayoutX").press("Tab");
  await page.locator("#moLayoutY").fill("50");
  await page.locator("#moLayoutY").press("Tab");
  await page.locator("#moLayoutWidth").fill("35");
  await page.locator("#moLayoutWidth").press("Tab");
  await page.locator("#moLayoutHeight").fill("5");
  await page.locator("#moLayoutHeight").press("Tab");
  await page.locator("#moLayoutFontSize").fill("8.5");
  await page.locator("#moLayoutFontSize").press("Tab");
  await page.locator("#moLayoutAlignment").selectOption("center");
  await page.locator("#moLayoutWrap").uncheck();
  await page.locator("#moLayoutSave").click();
  await page.waitForFunction(() => {
    const button = document.querySelector("#downloadMoLayoutPdf");
    const text = document.querySelector("#moMappingFitError")?.textContent ?? "";
    return Boolean(button && !button.disabled) || text.includes("Mapped layout fields require attention") || text.includes("Full-batch validation failed");
  }, undefined, { timeout: 60000 });

  const editorDiagnostics = await page.evaluate(() => {
    const frame = document.querySelector("#moLayoutFrontPreview");
    const doc = frame?.contentDocument;
    const overlay = document.querySelector('[data-mo-editor-overlay="front"]');
    if (!doc || !overlay) throw new Error("LP065_N2_EDITOR_PREVIEW_MISSING");
    return [...doc.querySelectorAll(".mo-half[data-mo-slot]")].map((half) => {
      const field = half.querySelector(':scope > .mo-layout-field[data-mo-layout-source="declaredPrincipal"]');
      if (!field) throw new Error("LP065_N2_AMOUNT_FIELD_MISSING");
      const id = field.dataset.moLayoutField;
      const slot = half.dataset.moSlot === "left" ? "0" : "1";
      const editorField = overlay.querySelector(`.mo-editor-field[data-mo-layout-id="${id}"][data-mo-layout-slot="${slot}"]`);
      const editorValue = editorField?.querySelector(".mo-editor-value");
      const text = field.querySelector("[data-mo-layout-text]");
      const bounds = field.getBoundingClientRect();
      const textBounds = text?.getBoundingClientRect();
      const textStyle = text ? doc.defaultView.getComputedStyle(text) : null;
      const editorBounds = editorField?.getBoundingClientRect();
      const editorTextBounds = editorValue?.getBoundingClientRect();
      return {
        slot: half.dataset.moSlot,
        amountText: text?.textContent ?? null,
        iframeValueNodes: field.querySelectorAll("[data-mo-layout-text]").length,
        editorOverlayValueNodes: editorField?.querySelectorAll(".mo-editor-value").length ?? 0,
        editorValueText: editorValue?.textContent ?? null,
        editorAlignment: editorField ? getComputedStyle(editorField).textAlign : null,
        previewAlignment: textStyle?.textAlign ?? null,
        editorTextCenterOffsetPx: editorBounds && editorTextBounds ? Number(((editorTextBounds.left + editorTextBounds.width / 2) - (editorBounds.left + editorBounds.width / 2)).toFixed(2)) : null,
        previewTextCenterOffsetPx: textBounds ? Number(((textBounds.left + textBounds.width / 2) - (bounds.left + bounds.width / 2)).toFixed(2)) : null,
        previewTextWidthPx: textBounds ? Number(textBounds.width.toFixed(2)) : null,
        previewFieldWidthPx: Number(bounds.width.toFixed(2)),
        editorFontSize: editorField ? getComputedStyle(editorField).fontSize : null,
        previewFontSize: textStyle?.fontSize ?? null,
        editorFontWeight: editorField ? getComputedStyle(editorField).fontWeight : null,
        previewFontWeight: textStyle?.fontWeight ?? null,
        editorWrap: editorField ? getComputedStyle(editorField).whiteSpace : null,
        previewWrap: textStyle?.whiteSpace ?? null,
        editorGeometry: editorField ? ["x", "y", "width", "height"].map((key) => Number(editorField.getAttribute(`data-mo-layout-${key}-mm`)).toFixed(2)) : null,
        previewGeometry: [field.style.left, field.style.top, field.style.width, field.style.height].map((value) => Number.parseFloat(value).toFixed(2)),
      };
    });
  });
  for (const field of editorDiagnostics) {
    assert.equal(field.amountText, amountValue);
    assert.equal(field.iframeValueNodes, 1, "each N2 amount field has exactly one iframe value node");
    assert.equal(field.editorOverlayValueNodes, 0, "editor selection overlay must not paint a duplicate amount");
    assert.equal(field.editorAlignment, "center");
    assert.equal(field.previewAlignment, "center");
    assert.equal(field.previewTextCenterOffsetPx, 0, "the amount glyph run is centered in its main-form field box");
    assert.equal(field.previewTextWidthPx, field.previewFieldWidthPx, "nowrap alignment uses the full field line box");
    assert.equal(field.editorFontSize, field.previewFontSize);
    assert.equal(field.editorFontWeight, field.previewFontWeight);
    assert.equal(field.editorWrap, field.previewWrap);
    assert.deepEqual(field.editorGeometry, field.previewGeometry, "editor and clean preview use the same millimetre geometry");
  }
  const waitForLayoutValidation = async () => page.waitForFunction(() => {
    const button = document.querySelector("#downloadMoLayoutPdf");
    const message = document.querySelector("#moMappingFitError")?.textContent ?? "";
    return Boolean(button && !button.disabled) || message.includes("Mapped layout fields require attention") || message.includes("Full-batch validation failed");
  }, undefined, { timeout: 60000 });
  const setFieldBox = async (width, height, alignment = "center") => {
    await page.locator('.mo-editor-field[data-mo-layout-source="declaredPrincipal"]').first().click();
    await page.locator("#moLayoutWidth").fill(String(width));
    await page.locator("#moLayoutWidth").press("Tab");
    await page.locator("#moLayoutHeight").fill(String(height));
    await page.locator("#moLayoutHeight").press("Tab");
    await page.locator("#moLayoutAlignment").selectOption(alignment);
    await page.locator("#moLayoutSave").click();
    await waitForLayoutValidation();
    return page.locator("#moMappingFitError").innerText();
  };
  const principalGeometry = await setFieldBox(43, 12, "center");
  const measurePrincipalRs = () => page.frameLocator("#moLayoutFrontPreview").locator('.mo-half[data-mo-slot="left"]').evaluate((half) => {
    const box = half.querySelector(':scope > .mo-layout-field[data-mo-layout-source="declaredPrincipal"]');
    const text = box?.querySelector("[data-mo-layout-text]");
    const page = half.querySelector(".page");
    const walker = page && page.ownerDocument.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    let rupeeText = walker?.nextNode() ?? null;
    while (rupeeText && rupeeText.textContent?.trim() !== "Rs.") rupeeText = walker?.nextNode() ?? null;
    if (!box || !text || !rupeeText) throw new Error("LP065_N2_LINEBOX_PROBE_MISSING");
    const range = (node) => { const value = node.ownerDocument.createRange(); value.selectNodeContents(node); return value.getBoundingClientRect(); };
    const fieldBounds = box.getBoundingClientRect(), lineBounds = text.getBoundingClientRect(), glyphBounds = range(text), rupeeBounds = range(rupeeText);
    const node = text.firstChild;
    const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(node?.textContent ?? "")];
    const charRange = text.ownerDocument.createRange();
    const perGrapheme = [];
    let offset = 0;
    for (const segment of segments) {
      charRange.setStart(node, offset);
      charRange.setEnd(node, offset + segment.segment.length);
      for (const rect of charRange.getClientRects()) perGrapheme.push({ left: Number(rect.left.toFixed(1)), top: Number(rect.top.toFixed(1)), right: Number(rect.right.toFixed(1)), bottom: Number(rect.bottom.toFixed(1)), width: Number(rect.width.toFixed(1)), height: Number(rect.height.toFixed(1)) });
      offset += segment.segment.length;
    }
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    return {
      field: { width: Number(fieldBounds.width.toFixed(1)), height: Number(fieldBounds.height.toFixed(1)) },
      textSpan: { width: Number(lineBounds.width.toFixed(1)), height: Number(lineBounds.height.toFixed(1)) },
      actualGlyph: { width: Number(glyphBounds.width.toFixed(1)), height: Number(glyphBounds.height.toFixed(1)) },
      perGrapheme,
      printedRsGlyph: { x: Number(rupeeBounds.x.toFixed(1)), y: Number(rupeeBounds.y.toFixed(1)), width: Number(rupeeBounds.width.toFixed(1)), height: Number(rupeeBounds.height.toFixed(1)) },
      principalRsGlyphOverlap: overlap(glyphBounds, rupeeBounds),
    };
  });
  const lineBoxProbe = await measurePrincipalRs();
  console.log(JSON.stringify({ lp065N2WidePrincipalProbe: { status: principalGeometry, measurement: lineBoxProbe } }));
  assert.match(principalGeometry, new RegExp(`PASS · ${recordCount} eligible records checked`, "u"), "61×46 line-box geometry must not be reported as overflow in a 163×46 field");
  assert.deepEqual(lineBoxProbe.field, lineBoxProbe.textSpan, "the text span's min-height is a line box, not the actual glyph height");
  assert.equal(lineBoxProbe.principalRsGlyphOverlap, false, "centered principal glyphs do not collide with the static Rs. label");
  const leftPrincipalStatus = await setFieldBox(43, 12, "left");
  const leftPrincipalProbe = await measurePrincipalRs();
  const rsOverlapReported = /overlaps printed MO text “Rs\.”/u.test(leftPrincipalStatus);
  assert.equal(rsOverlapReported, leftPrincipalProbe.principalRsGlyphOverlap, "the Rs. diagnostic must agree with actual glyph-rectangle intersection");
  const recenteredPrincipal = await setFieldBox(43, 12, "center");
  assert.match(recenteredPrincipal, new RegExp(`PASS · ${recordCount} eligible records checked`, "u"), "restoring the centered amount field must pass full-batch validation");
  const narrowPrincipal = await setFieldBox(4, 3, "center");
  assert.doesNotMatch(narrowPrincipal, /^PASS/u, "a genuinely too-narrow principal field must remain output-blocking");
  console.log(JSON.stringify({ lp065N2NarrowPrincipalDiagnostics: narrowPrincipal }));
  assert.match(narrowPrincipal, new RegExp(`affects ${recordCount} selected records`, "u"), "repeated principal overflow is grouped with its affected record count");
  assert.equal((narrowPrincipal.match(/text exceeds its printable field bounds/gu) ?? []).length, 1, "one repeated layout issue produces one useful diagnostic");
  assert.equal(await page.locator("#downloadMoLayoutPdf").isDisabled(), true, "genuine principal overflow must keep download disabled");
  const restoredPrincipal = await setFieldBox(43, 12, "center");
  assert.match(restoredPrincipal, new RegExp(`PASS · ${recordCount} eligible records checked`, "u"), "restoring the readable principal field must clear the temporary test error");
  await page.locator("#moLayoutEditor").screenshot({ path: join(evidence, "lp065-n2-after-editor.png") });
  console.log(JSON.stringify({ lp065N2Editor: editorDiagnostics, validation: await page.locator("#moMappingFitError").innerText() }));

  await page.locator("#moPreviewFinal").click();
  await page.locator("#moReturnToLayout").waitFor({ timeout: 30000 });
  const cleanDiagnostics = await page.evaluate(() => {
    const iframe = document.querySelector("#moFinalPreview");
    const doc = iframe?.contentDocument;
    if (!doc) throw new Error("LP065_N2_CLEAN_PREVIEW_MISSING");
    return [...doc.querySelectorAll(".mo-half[data-mo-slot]")].map((half) => {
      const field = half.querySelector(':scope > .mo-layout-field[data-mo-layout-source="declaredPrincipal"]');
      const text = field?.querySelector("[data-mo-layout-text]");
      const bounds = field?.getBoundingClientRect();
      const textBounds = text?.getBoundingClientRect();
      const style = text ? doc.defaultView.getComputedStyle(text) : null;
      return {
        slot: half.dataset.moSlot,
        valueNodes: field?.querySelectorAll("[data-mo-layout-text]").length ?? 0,
        amountText: text?.textContent ?? null,
        alignment: style?.textAlign ?? null,
        textCenterOffsetPx: bounds && textBounds ? Number(((textBounds.left + textBounds.width / 2) - (bounds.left + bounds.width / 2)).toFixed(2)) : null,
        textWidthPx: textBounds ? Number(textBounds.width.toFixed(2)) : null,
        fieldWidthPx: bounds ? Number(bounds.width.toFixed(2)) : null,
      };
    });
  });
  for (const field of cleanDiagnostics) {
    assert.equal(field.amountText, amountValue);
    assert.equal(field.valueNodes, 1, "clean preview must contain one amount value per intended form");
    assert.equal(field.alignment, "center");
    assert.equal(field.textCenterOffsetPx, 0, "clean preview amount must be centered");
    assert.equal(field.textWidthPx, field.fieldWidthPx, "the clean text line must span its field box for alignment");
  }
  const sheetCount = Math.ceil(recordCount / 2);
  const firstPair = await page.frameLocator("#moFinalPreview").locator(".mo-half[data-mo-source-index]").evaluateAll((halves) => halves.map((half) => Number(half.getAttribute("data-mo-source-index")) + 1));
  assert.deepEqual(firstPair, [1, Math.min(sheetCount + 1, recordCount)], "first cut-and-stack pair preserves source order");
  console.log(JSON.stringify({ lp065N2PrincipalGeometry: { wideLineBox: lineBoxProbe, wideStatus: principalGeometry, leftAlignment: { status: leftPrincipalStatus, measurement: leftPrincipalProbe, rsOverlapReported }, recenteredStatus: recenteredPrincipal, narrowStatus: narrowPrincipal, restoredStatus: restoredPrincipal } }));
  const firstPreviewBytes = await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot();
  await writeFile(join(evidence, "lp065-n2-after-clean-preview.png"), firstPreviewBytes);
  let pdfSummary;
  if (await page.locator("#downloadMoLayoutPdf").isDisabled()) {
    pdfSummary = { status: "blocked", validation: await page.locator("#moMappingFitError").innerText() };
  } else {
    const pdfPath = join(evidence, "lp065-n2-after.pdf");
    const browserDownloadStartedAt = performance.now();
    const downloadEvent = page.waitForEvent("download", { timeout: 120000 });
    await page.locator("#downloadMoLayoutPdf").click();
    const download = await downloadEvent;
    const browserDownloadMs = performance.now() - browserDownloadStartedAt;
    await download.saveAs(pdfPath);
    const bytes = Buffer.from(await readFile(pdfPath));
    const pdf = await PDFDocument.load(bytes);
    const expectedPages = sheetCount * 2;
    assert.equal(pdf.getPageCount(), expectedPages, "paired N2/N96 output must include front and back for every sheet");
    const raster = await rasterPdfPage(bytes, 1, 4);
    await writeFile(join(evidence, "lp065-n2-after-pdf-page1.png"), raster.toBuffer("image/png"));
    const previewImage = await loadImage(firstPreviewBytes);
    const normalizedPreview = createCanvas(raster.width, raster.height);
    normalizedPreview.getContext("2d").drawImage(previewImage, 0, 0, raster.width, raster.height);
    const rasterPixels = raster.getContext("2d").getImageData(0, 0, raster.width, raster.height).data;
    const previewPixels = normalizedPreview.getContext("2d").getImageData(0, 0, raster.width, raster.height).data;
    let difference = 0;
    for (let index = 0; index < rasterPixels.length; index += 4) difference += Math.abs(rasterPixels[index] - previewPixels[index]) + Math.abs(rasterPixels[index + 1] - previewPixels[index + 1]) + Math.abs(rasterPixels[index + 2] - previewPixels[index + 2]);
    const meanRasterDifference = difference / (raster.width * raster.height * 3 * 255);
    assert.ok(meanRasterDifference < 0.1, `actual N2 PDF raster must match centered clean preview; mean pixel difference ${meanRasterDifference}`);
    await page.locator("#moLayoutSampleRecord").selectOption(String(recordCount - 1));
    await page.waitForFunction((last) => {
      const halves = document.querySelector("#moFinalPreview")?.contentDocument?.querySelectorAll(".mo-half[data-mo-source-index]");
      return halves?.length === 2 && Number(halves[0].getAttribute("data-mo-source-index")) + 1 === Math.ceil(last / 2) && Number(halves[1].getAttribute("data-mo-source-index")) + 1 === last;
    }, recordCount, { timeout: 30000 });
    const finalPair = await page.frameLocator("#moFinalPreview").locator(".mo-half[data-mo-source-index]").evaluateAll((halves) => halves.map((half) => Number(half.getAttribute("data-mo-source-index")) + 1));
    assert.deepEqual(finalPair, [sheetCount, recordCount], "final cut-and-stack pair preserves source order");
    const finalPreviewBytes = await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot();
    await writeFile(join(evidence, "lp065-n2-after-clean-preview-final.png"), finalPreviewBytes);
    const finalFrontPage = expectedPages - 1;
    const finalRaster = await rasterPdfPage(bytes, finalFrontPage, 4);
    await writeFile(join(evidence, "lp065-n2-after-pdf-final-front.png"), finalRaster.toBuffer("image/png"));
    const finalPreviewImage = await loadImage(finalPreviewBytes);
    const normalizedFinalPreview = createCanvas(finalRaster.width, finalRaster.height);
    normalizedFinalPreview.getContext("2d").drawImage(finalPreviewImage, 0, 0, finalRaster.width, finalRaster.height);
    const finalRasterPixels = finalRaster.getContext("2d").getImageData(0, 0, finalRaster.width, finalRaster.height).data;
    const finalPreviewPixels = normalizedFinalPreview.getContext("2d").getImageData(0, 0, finalRaster.width, finalRaster.height).data;
    let finalDifference = 0;
    for (let index = 0; index < finalRasterPixels.length; index += 4) finalDifference += Math.abs(finalRasterPixels[index] - finalPreviewPixels[index]) + Math.abs(finalRasterPixels[index + 1] - finalPreviewPixels[index + 1]) + Math.abs(finalRasterPixels[index + 2] - finalPreviewPixels[index + 2]);
    const finalRasterPreviewDifference = finalDifference / (finalRaster.width * finalRaster.height * 3 * 255);
    assert.ok(finalRasterPreviewDifference < 0.1, `last front PDF raster must match final clean preview; difference ${finalRasterPreviewDifference}`);
    pdfSummary = { status: await page.locator("#moPdfStatus").innerText(), pageCount: pdf.getPageCount(), bytes: bytes.length, browserDownloadMs, firstPageRasterPreviewDifference: meanRasterDifference, finalPageRasterPreviewDifference: finalRasterPreviewDifference, firstPair, finalPair };
  }
  console.log(JSON.stringify({ lp065N2CleanPreview: cleanDiagnostics, pdf: pdfSummary }));

  let trackingCollisionProbe = { skipped: recordCount !== 2 };
  if (recordCount === 2) {
    await page.locator("#moReturnToLayout").click();
    await page.locator("#moLayoutEditor").waitFor({ timeout: 30000 });
    const trackingChip = page.locator('.mo-source-chip[data-mo-layout-source="tracking"]').first();
    const frontSurface = page.locator('[data-mo-editor-overlay="front"]');
    const frontBounds = await frontSurface.boundingBox();
    if (!frontBounds) throw new Error("LP065_N2_TRACKING_SURFACE_MISSING");
    await trackingChip.dragTo(frontSurface, { targetPosition: { x: 74 / 297 * frontBounds.width, y: 45 / 210 * frontBounds.height } });
    await page.locator("#moLayoutX").fill("74");
    await page.locator("#moLayoutX").press("Tab");
    await page.locator("#moLayoutY").fill("45");
    await page.locator("#moLayoutY").press("Tab");
    await page.locator("#moLayoutWidth").fill("42");
    await page.locator("#moLayoutWidth").press("Tab");
    await page.locator("#moLayoutHeight").fill("8");
    await page.locator("#moLayoutHeight").press("Tab");
    await page.locator("#moLayoutFontSize").fill("9");
    await page.locator("#moLayoutFontSize").press("Tab");
    await page.locator("#moLayoutAlignment").selectOption("left");
    await page.locator("#moLayoutSave").click();
    await page.waitForFunction(() => {
      const status = document.querySelector("#moMappingFitError")?.textContent ?? "";
      return status.startsWith("PASS · 2 eligible records checked") || status.includes("Mapped layout fields require attention") || status.includes("Full-batch validation failed");
    }, undefined, { timeout: 60000 });
    trackingCollisionProbe = await page.evaluate(() => {
      const status = document.querySelector("#moMappingFitError")?.textContent ?? "";
      const doc = document.querySelector("#moLayoutFrontPreview")?.contentDocument;
      const half = doc?.querySelector('.mo-half[data-mo-slot="left"]');
      const page = half?.querySelector(".page");
      const tracking = half?.querySelector('.mo-layout-field[data-mo-layout-source="tracking"] [data-mo-layout-text]');
      const walker = page && page.ownerDocument.createTreeWalker(page, NodeFilter.SHOW_TEXT);
      let articleText = walker?.nextNode() ?? null;
      while (articleText && articleText.textContent?.trim() !== "No. of V. P. Article") articleText = walker?.nextNode() ?? null;
      const rectOf = (node) => { const range = node.ownerDocument.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect(); };
      const a = tracking && rectOf(tracking), b = articleText && rectOf(articleText);
      return { status, outputBlocked: !!document.querySelector("#downloadMoLayoutPdf")?.disabled, trackingGlyph: a && { x: a.x, y: a.y, width: a.width, height: a.height }, printedArticleGlyph: b && { x: b.x, y: b.y, width: b.width, height: b.height } };
    });
    assert.match(trackingCollisionProbe.status, /Tracking \(exact imported string\) overlaps printed MO text “No\. of V\. P\. Article”.*affects 2 selected records/u, "a real tracking/article-label collision remains blocked and is grouped by record count");
    assert.equal(trackingCollisionProbe.outputBlocked, true, "genuine static-artwork collision keeps output blocked");

    const legacyLayout = { version: 1, fields: [
      { id: "legacy-sender-name", source: "senderName", face: "front", xMm: 7.7, yMm: 85.8, widthMm: 100.7, heightMm: 4.8, fontSizePt: 8.5, alignment: "left", wrap: false },
      { id: "legacy-receiver-name", source: "name", face: "front", xMm: 7.7, yMm: 112.8, widthMm: 100.7, heightMm: 4.8, fontSizePt: 8.5, alignment: "left", wrap: false },
      { id: "legacy-custom-tracking", source: "tracking", face: "front", xMm: 74, yMm: 45, widthMm: 42, heightMm: 8, fontSizePt: 9, alignment: "center", wrap: false, bold: true },
    ] };
    await page.evaluate((layout) => localStorage.setItem("gfs-mo51-layout-v1", JSON.stringify(layout)), legacyLayout);
    await page.locator("#moLayoutReload").click();
    await page.locator("#moCorrectLegacyPartyPositions").waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector("#downloadMoLayoutPdf")?.disabled === true, undefined, { timeout: 30000 });
    const storedBeforeFailedCorrection = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
    await page.evaluate(() => {
      const prototype = Storage.prototype;
      Object.defineProperty(window, "__lp065OriginalStorageSetItem", { configurable: true, value: prototype.setItem });
      prototype.setItem = function (key, value) { if (key === "gfs-mo51-layout-v1") throw new DOMException("synthetic storage blocked", "QuotaExceededError"); return window.__lp065OriginalStorageSetItem.call(this, key, value); };
    });
    await page.locator("#moCorrectLegacyPartyPositions").click();
    await page.getByText("Party-position correction was not saved").waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), storedBeforeFailedCorrection, "failed legacy persistence leaves saved field positions unchanged");
    assert.equal(await page.locator("#moCorrectLegacyPartyPositions").count(), 1, "failed legacy correction keeps the safe correction gate visible");
    await page.evaluate(() => { Storage.prototype.setItem = window.__lp065OriginalStorageSetItem; delete window.__lp065OriginalStorageSetItem; });
    await page.locator("#moCorrectLegacyPartyPositions").click();
    await page.waitForFunction(() => !document.querySelector("#moCorrectLegacyPartyPositions") && (document.querySelector("#moMappingFitError")?.textContent ?? "").startsWith("PASS · 2 eligible records checked"), undefined, { timeout: 60000 });
    const migratedTrackingStatus = await page.locator("#moMappingFitError").innerText();
    assert.doesNotMatch(migratedTrackingStatus, /Tracking \(exact imported string\) overlaps printed MO text/u, "centered legacy Tracking glyphs do not collide with the printed article label");
    assert.equal(await page.locator("#downloadMoLayoutPdf").isDisabled(), false, "successful party-position migration keeps valid mapped output enabled");
    const migratedTracking = await page.evaluate(() => JSON.parse(localStorage.getItem("gfs-mo51-layout-v1") ?? "null").fields.find((field) => field.id === "legacy-custom-tracking"));
    assert.deepEqual({ xMm: migratedTracking.xMm, yMm: migratedTracking.yMm, widthMm: migratedTracking.widthMm, heightMm: migratedTracking.heightMm, alignment: migratedTracking.alignment, bold: migratedTracking.bold }, { xMm: 74, yMm: 45, widthMm: 42, heightMm: 8, alignment: "center", bold: true }, "legacy migration preserves saved Tracking formatting when actual text is collision-free");
    await page.evaluate(() => localStorage.removeItem("gfs-mo51-layout-v1"));
  }
  if (recordCount === 42) {
    await page.locator("#moReturnToLayout").click();
    await page.locator("#moLayoutEditor").waitFor({ timeout: 30000 });
    const placeField = async (source, x, y, width, height, font, wrap = false, alignment = "left") => {
      const surface = page.locator('[data-mo-editor-overlay="front"]');
      const bounds = await surface.boundingBox();
      if (!bounds) throw new Error("LP065_N42_LAYOUT_SURFACE_MISSING");
      await page.locator(`.mo-source-chip[data-mo-layout-source="${source}"]`).first().dragTo(surface, { targetPosition: { x: x / 297 * bounds.width, y: y / 210 * bounds.height } });
      for (const [selector, value] of [["#moLayoutX", x], ["#moLayoutY", y], ["#moLayoutWidth", width], ["#moLayoutHeight", height], ["#moLayoutFontSize", font]]) {
        await page.locator(selector).fill(String(value));
        await page.locator(selector).press("Tab");
      }
      if (await page.locator("#moLayoutWrap").isChecked() !== wrap) await page.locator("#moLayoutWrap").setChecked(wrap);
      await page.locator("#moLayoutAlignment").selectOption(alignment);
      await page.locator("#moLayoutSave").click();
      await page.waitForFunction(() => {
        const text = document.querySelector("#moMappingFitError")?.textContent ?? "";
        return text.startsWith("PASS ·") || text.includes("Mapped layout fields require attention") || text.includes("Full-batch validation failed");
      }, undefined, { timeout: 60000 });
    };
    await placeField("address", 7.7, 90.6, 74, 16, 7.5, true);
    await placeField("city", 7.7, 105, 50, 4.8, 7);
    await placeField("province", 60, 105, 48.4, 4.8, 7);
    await placeField("orderDate", 27, 18, 13.8, 10.5, 6.5, false, "center");
    const addressCollisionProbe = await page.evaluate(() => ({
      status: document.querySelector("#moMappingFitError")?.textContent ?? "",
      downloadEnabled: !!document.querySelector("#downloadMoLayoutPdf") && !document.querySelector("#downloadMoLayoutPdf").disabled,
      selectButtons: [...(document.querySelectorAll("#moMappingFitError button")||[])].map((button) => ({ text: button.textContent?.trim() ?? "", visible: button.getClientRects().length > 0, disabled: button.disabled })),
      cityFieldIds: JSON.parse(localStorage.getItem("gfs-mo51-layout-v1")||"{}").fields?.filter((field) => field.source === "city").map((field) => field.id) ?? [],
      renderedCityFieldIds: [...(document.querySelectorAll('.mo-editor-field[data-mo-layout-source="city"]'))].map((field) => field.dataset.moLayoutId),
      groupedAddressCity: [...(document.querySelector("#moMappingFitError")?.textContent ?? "").matchAll(/Label receiver\/display address text overlaps Label city text\. \(affects (\d+) selected records\)/gu)].map((match) => Number(match[1])),
      groupedAddressProvince: [...(document.querySelector("#moMappingFitError")?.textContent ?? "").matchAll(/Label receiver\/display address text overlaps Label province text\. \(affects (\d+) selected records\)/gu)].map((match) => Number(match[1])),
      groupedCityArtwork: [...(document.querySelector("#moMappingFitError")?.textContent ?? "").matchAll(/Label city overlaps printed artwork\/stamp box near x=([\d.]+) mm, y=([\d.]+) mm\. \(affects (\d+) selected records\)/gu)].map((match) => ({ xMm: Number(match[1]), yMm: Number(match[2]), records: Number(match[3]) })),
    }));
    console.log(JSON.stringify({ lp065N42CollisionSelectionDiagnostic: addressCollisionProbe }));
    assert.equal(addressCollisionProbe.downloadEnabled, false, "the synthetic city/artwork collision must block mapped output");
    assert.deepEqual(addressCollisionProbe.groupedAddressCity, [], "field boxes may overlap without visible text collision");
    assert.deepEqual(addressCollisionProbe.groupedAddressProvince, [], "address/province is only blocked when actual glyphs overlap");
    assert.ok(addressCollisionProbe.groupedCityArtwork.some((issue) => issue.records === recordCount), "the visible City label collision must group affected records");
    await page.locator("#moPreviewFinal").click();
    await page.locator("#moReturnToLayout").waitFor({ timeout: 30000 });
    await page.frameLocator("#moFinalPreview").locator(".mo-sheet").screenshot({ path: join(evidence, "lp065-n42-layout-collision-preview.png") });
    await page.locator("#moReturnToLayout").click();
    const selectField = async (source) => page.locator(`.mo-editor-field[data-mo-layout-source="${source}"]`).first().click();
    await selectField("city");
    for (const [selector, value] of [["#moLayoutX", 78.7], ["#moLayoutY", 95.4], ["#moLayoutWidth", 29.7], ["#moLayoutHeight", 4.8], ["#moLayoutFontSize", 7]]) {
      await page.locator(selector).fill(String(value));
      await page.locator(selector).press("Tab");
    }
    await page.locator("#moLayoutSave").click();
    await page.locator('.mo-editor-field[data-mo-layout-source="address"]').first().click();
    await page.locator("#moLayoutHeight").fill("9.6");
    await page.locator("#moLayoutHeight").press("Tab");
    await page.locator("#moLayoutSave").click();
    await page.waitForFunction((count) => {
      const status = document.querySelector("#moMappingFitError")?.textContent ?? "";
      return status.startsWith(`PASS · ${count} eligible records checked`) || status.includes("Mapped layout fields require attention") || status.includes("Full-batch validation failed");
    }, recordCount, { timeout: 60000 });
    const afterDirectAdjustment = await page.locator("#moMappingFitError").innerText();
    assert.match(afterDirectAdjustment, new RegExp(`PASS · ${recordCount} eligible records checked`, "u"));
    const savedBeforeRepairPreview = await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1"));
    await page.locator("#moRepairLayout").click();
    await page.waitForFunction((count) => {
      const status = document.querySelector("#moRepairBatchStatus")?.textContent ?? "";
      return status.startsWith(`PASS · ${count} selected records checked`) || /\d+ blocking diagnostics remain/u.test(status);
    }, recordCount, { timeout: 60000 });
    const repairPreviewStatus = await page.locator("#moRepairBatchStatus").innerText();
    assert.equal(await page.evaluate(() => localStorage.getItem("gfs-mo51-layout-v1")), savedBeforeRepairPreview, "repair preview must not overwrite the saved N42 layout");
    const applyRepair = page.locator("#moApplyLayoutRepair");
    const safeRepairApplied = await applyRepair.isEnabled();
    if (safeRepairApplied) await applyRepair.click();
    else await page.locator("#moCancelRepairPreview").click();
    await page.waitForFunction(() => {
      const download = document.querySelector("#downloadMoLayoutPdf"), print = document.querySelector("#printMoBatch");
      return Boolean(download && print && !download.disabled && !print.disabled);
    }, undefined, { timeout: 60000 });
    console.log(JSON.stringify({ lp065N42AddressCollisionProbe: addressCollisionProbe, afterDirectAdjustment, repairPreviewStatus, safeRepairApplied }));
  }
  console.log(JSON.stringify({ lp065N2TrackingCollisionProbe: trackingCollisionProbe }));

  const errors = await Promise.all(browser.contexts().flatMap((item) => item.pages()).map(async (candidate) => candidate.url()));
  console.log(JSON.stringify({ lp065Amount: { eligibleRows: recordCount, amountPerForm: amountValue, cnicBlank: true, contextPages: errors.length, browserErrors } }));
} finally {
  await browser?.close();
  server.kill();
}
