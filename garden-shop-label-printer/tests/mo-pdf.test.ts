import { describe, expect, it } from "vitest";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { PDFDocument, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import { projectMoRecords } from "../src/mo/adapter";
import { createMoPdfBlob, drawMoRasterImage, MO_PDF_GEOMETRY } from "../src/mo/pdf";
import { EMPTY_ORDER } from "../src/types";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

async function rasterFirstPdfPage(bytes: Uint8Array): Promise<Uint8ClampedArray> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data: bytes, disableWorker: true, useSystemFonts: true });
  const document = await loadingTask.promise;
  try {
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as never, viewport }).promise;
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    await loadingTask.destroy();
  }
}

function candidate() {
  const row = { ...EMPTY_ORDER(), tracking: "VPL-SYN-1", cod: "25000", orderId: "SYNTHETIC-ONLY" };
  return projectMoRecords([row], { requiredFields: [] }).candidates;
}

describe("MO-51 PDF export gate", () => {
  it("uses exact A4 landscape MediaBox geometry and 300-DPI raster artwork", () => {
    expect(MO_PDF_GEOMETRY.widthMm).toBe(297);
    expect(MO_PDF_GEOMETRY.heightMm).toBe(210);
    expect(MO_PDF_GEOMETRY.widthPt).toBeCloseTo(841.8897638, 6);
    expect(MO_PDF_GEOMETRY.heightPt).toBeCloseTo(595.2755906, 6);
    expect(MO_PDF_GEOMETRY.rasterDpi).toBe(300);
  });

  it("rejects an empty eligible sequence without creating an empty PDF", async () => {
    await expect(createMoPdfBlob([], "")).rejects.toThrow("MO_PDF_NO_ELIGIBLE_RECORDS");
  });

  it("rejects invalid CNIC before rasterization or PDF creation", async () => {
    await expect(createMoPdfBlob(candidate(), "123456789012")).rejects.toThrow("MO_SENDER_CNIC_INVALID");
  });

  it("honors cancellation before creating temporary frames or output", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createMoPdfBlob(candidate(), "", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("can cancel lossless raster encoding between bounded row chunks", async () => {
    const width = 512;
    const height = 512;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const controller = new AbortController();
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([MO_PDF_GEOMETRY.widthPt, MO_PDF_GEOMETRY.heightPt]);
    setTimeout(() => controller.abort(), 0);

    await expect(drawMoRasterImage(pdf, page, { width, height, data: pixels }, { x: 0, y: 0, width: 1, height: 1 }, true, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses lossless PDF predictor image streams and preserves the legacy PNG raster", async () => {
    const width = 256;
    const height = 192;
    const canvas = createCanvas(width, height);
    const canvasContext = canvas.getContext("2d");
    const imageData = canvasContext.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const inSyntheticInk = (x > 18 && x < 238 && y > 12 && y < 176 && ((x % 17) < 3 || (y % 23) < 2));
        imageData.data[offset] = 18;
        imageData.data[offset + 1] = 18;
        imageData.data[offset + 2] = 18;
        imageData.data[offset + 3] = inSyntheticInk ? ((x + y) % 5 === 0 ? 128 : 255) : 0;
      }
    }
    canvasContext.putImageData(imageData, 0, 0);

    const legacyStartedAt = performance.now();
    const baseline = await PDFDocument.create();
    const baselinePage = baseline.addPage([MO_PDF_GEOMETRY.widthPt, MO_PDF_GEOMETRY.heightPt]);
    const pngImage = await baseline.embedPng(canvas.toBuffer("image/png"));
    baselinePage.drawImage(pngImage, { x: 0, y: 0, width: MO_PDF_GEOMETRY.widthPt, height: MO_PDF_GEOMETRY.heightPt });
    const baselineBytes = await baseline.save();
    const legacyDurationMs = performance.now() - legacyStartedAt;

    const predictorStartedAt = performance.now();
    const optimized = await PDFDocument.create();
    const optimizedPage = optimized.addPage([MO_PDF_GEOMETRY.widthPt, MO_PDF_GEOMETRY.heightPt]);
    await drawMoRasterImage(optimized, optimizedPage, { width, height, data: imageData.data }, { x: 0, y: 0, width: MO_PDF_GEOMETRY.widthPt, height: MO_PDF_GEOMETRY.heightPt });
    const optimizedBytes = await optimized.save();
    const predictorDurationMs = performance.now() - predictorStartedAt;
    const benchmarkEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (benchmarkEnv?.LP_PDF_BENCHMARK === "1") {
      console.info("Synthetic MO image-pipeline benchmark", {
        width,
        height,
        legacyBytes: baselineBytes.byteLength,
        predictorBytes: optimizedBytes.byteLength,
        reductionPercent: Number(((1 - optimizedBytes.byteLength / baselineBytes.byteLength) * 100).toFixed(1)),
        legacyDurationMs: Number(legacyDurationMs.toFixed(1)),
        predictorDurationMs: Number(predictorDurationMs.toFixed(1)),
      });
    }

    const loaded = await PDFDocument.load(optimizedBytes);
    const xObjects = loaded.getPages()[0].node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    const imageRef = xObjects.values()[0] as PDFRef;
    expect(imageRef).toBeDefined();
    const image = loaded.context.lookup(imageRef, PDFRawStream);
    const imageParameters = image.dict.lookup(PDFName.of("DecodeParms"), PDFDict);
    expect(imageParameters.lookup(PDFName.of("Predictor"), PDFNumber).asNumber()).toBe(15);
    expect(imageParameters.lookup(PDFName.of("Colors"), PDFNumber).asNumber()).toBe(3);
    expect(loaded.getPages()[0].getSize().width).toBeCloseTo(MO_PDF_GEOMETRY.widthPt, 6);
    expect(loaded.getPages()[0].getSize().height).toBeCloseTo(MO_PDF_GEOMETRY.heightPt, 6);
    const mask = image.dict.lookup(PDFName.of("SMask"), PDFRawStream);
    const maskParameters = mask.dict.lookup(PDFName.of("DecodeParms"), PDFDict);
    expect(maskParameters.lookup(PDFName.of("Predictor"), PDFNumber).asNumber()).toBe(15);
    expect(maskParameters.lookup(PDFName.of("Colors"), PDFNumber).asNumber()).toBe(1);

    expect(optimizedBytes.byteLength).toBeLessThan(baselineBytes.byteLength);
    expect(await rasterFirstPdfPage(optimizedBytes)).toEqual(await rasterFirstPdfPage(baselineBytes));
  });
});
