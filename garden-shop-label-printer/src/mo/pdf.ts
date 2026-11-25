import { PDFDocument, PDFNumber, PDFOperator, PDFOperatorNames, type PDFImage, type PDFPage, type PDFRef } from "pdf-lib";
import html2canvas from "html2canvas";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { findMoLayoutDiagnostics, renderMoPreviewDocuments, type MoBackPreviewRotation } from "./renderer";
import { emptyMoSessionMapping, hasVisibleMoFields, resolveMoVisibleFields, type MoSessionMapping } from "./mapping";
import { hasLegacyMoPartyPositions, resolveMoLayoutSource, type MoLayout } from "./layout";

const PT_PER_MM = 72 / 25.4;
const PAGE_WIDTH_PT = 297 * PT_PER_MM;
const PAGE_HEIGHT_PT = 210 * PT_PER_MM;
const CSS_WIDTH = 297 / 25.4 * 96;
const CSS_HEIGHT = 210 / 25.4 * 96;
const DPI = 300;
export const MO_PDF_GEOMETRY = Object.freeze({
  widthMm: 297,
  heightMm: 210,
  widthPt: PAGE_WIDTH_PT,
  heightPt: PAGE_HEIGHT_PT,
  rasterDpi: DPI,
});

export type MoPdfProgress = Readonly<{ completedPages: number; totalPages: number }>;
export type MoPdfPhase = "html-generation" | "dom-ready" | "pdf-local-validation" | "overlay-preparation" | "html2canvas" | "raster-readback" | "image-encode" | "png-encode" | "pdf-assembly" | "pdf-save";
export type MoBatchSideMode = "paired" | "front-only" | "back-only";
export type MoPdfOptions = Readonly<{
  signal?: AbortSignal;
  backRotation?: MoBackPreviewRotation;
  mappings?: ReadonlyMap<number, MoSessionMapping>;
  draftMode?: boolean;
  layout?: MoLayout;
  sideMode?: MoBatchSideMode;
  imageEncoding?: "raw-overlays" | "legacy-png";
  onProgress?: (progress: MoPdfProgress) => void;
  onTiming?: (phase: MoPdfPhase, durationMs: number) => void;
}>;

export type MoRasterPixels = Readonly<{ width: number; height: number; data: Uint8ClampedArray }>;

type EmbeddedMoImage = Readonly<{ kind: "raw-rgba"; ref: PDFRef; width: number; height: number }> | Readonly<{ kind: "legacy-png"; image: PDFImage }>;

type ImagePlacement = Readonly<{ x: number; y: number; width: number; height: number }>;

function abortError(): DOMException {
  return new DOMException("MO PDF export cancelled", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(abortError());
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

async function withRenderedFace<T>(
  srcdoc: string,
  signal: AbortSignal | undefined,
  backgroundColor: string | null,
  onTiming: MoPdfOptions["onTiming"],
  consume: (canvas: HTMLCanvasElement) => Promise<T>,
): Promise<T> {
  throwIfAborted(signal);
  const domStartedAt = performance.now();
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.title = "Temporary MO-51 PDF rasterizer";
  frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1123px;height:794px;border:0";
  let canvas: HTMLCanvasElement | undefined;
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      frame.addEventListener("load", () => resolve(), { once: true });
      frame.addEventListener("error", () => reject(new Error("MO_PDF_PREVIEW_FRAME_FAILED")), { once: true });
    });
    frame.srcdoc = srcdoc;
    document.body.append(frame);
    await abortable(loaded, signal);
    const doc = frame.contentDocument;
    if (!doc?.fonts) throw new Error("MO_PDF_FONT_API_UNAVAILABLE");
    await abortable(doc.fonts.ready.then(() => undefined), signal);
    throwIfAborted(signal);
    const sheet = doc.querySelector<HTMLElement>(".mo-sheet");
    if (!sheet) throw new Error(`MO_PDF_PREVIEW_SHEET_MISSING:${doc.readyState}`);
    onTiming?.("dom-ready", performance.now() - domStartedAt);
    const localValidationStartedAt = performance.now();
    const localDiagnostics = findMoLayoutDiagnostics(doc);
    onTiming?.("pdf-local-validation", performance.now() - localValidationStartedAt);
    const overflows = localDiagnostics.filter((issue) => issue.code === "overflow").map((issue) => issue.message);
    if (overflows.length) throw new Error(`MO_FIELD_OVERFLOW:${overflows.join(",")}`);
    const overlaps = localDiagnostics.filter((issue) => issue.code === "overlap" || issue.code === "artwork-overlap").map((issue) => issue.message);
    if (overlaps.length) throw new Error(`MO_FIELD_OVERLAP:${overlaps.join(",")}`);
    const bounds = sheet.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    const rasterStartedAt = performance.now();
    canvas = await abortable(html2canvas(sheet, {
      scale: DPI / 96,
      backgroundColor,
      width,
      height,
      windowWidth: CSS_WIDTH,
      windowHeight: CSS_HEIGHT,
      useCORS: false,
      allowTaint: false,
      logging: false,
      foreignObjectRendering: false,
      removeContainer: true,
    }), signal);
    onTiming?.("html2canvas", performance.now() - rasterStartedAt);
    throwIfAborted(signal);
    if (canvas.width !== Math.floor(width * DPI / 96) || canvas.height !== Math.floor(height * DPI / 96)) throw new Error(`MO_PDF_RASTER_SIZE_INVALID:${canvas.width}x${canvas.height}`);
    return await consume(canvas);
  } finally {
    frame.remove();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

async function facePng(srcdoc: string, signal?: AbortSignal, backgroundColor: string | null = "#fff", onTiming?: MoPdfOptions["onTiming"]): Promise<Uint8Array> {
  return withRenderedFace(srcdoc, signal, backgroundColor, onTiming, async (canvas) => {
    const encodeStartedAt = performance.now();
    const png = await abortable(new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("MO_PDF_PNG_ENCODE_FAILED")), "image/png")), signal);
    throwIfAborted(signal);
    const bytes = new Uint8Array(await png.arrayBuffer());
    onTiming?.("png-encode", performance.now() - encodeStartedAt);
    return bytes;
  });
}

async function faceRaster(srcdoc: string, signal?: AbortSignal, backgroundColor: string | null = "#fff", onTiming?: MoPdfOptions["onTiming"]): Promise<MoRasterPixels> {
  return withRenderedFace(srcdoc, signal, backgroundColor, onTiming, async (canvas) => {
    const readbackStartedAt = performance.now();
    const context = canvas.getContext("2d");
    if (!context) throw new Error("MO_PDF_CANVAS_CONTEXT_UNAVAILABLE");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    onTiming?.("raster-readback", performance.now() - readbackStartedAt);
    throwIfAborted(signal);
    return Object.freeze({ width: canvas.width, height: canvas.height, data: pixels.data });
  });
}

async function splitRawRgbaChannels(raster: MoRasterPixels, hasAlpha: boolean, signal?: AbortSignal): Promise<Readonly<{ color: Uint8Array; alpha?: Uint8Array }>> {
  const { width, height, data } = raster;
  if (data.length !== width * height * 4) throw new Error("MO_PDF_RASTER_CHANNELS_INVALID");
  const pixels = width * height;
  const color = new Uint8Array(pixels * 3);
  const alpha = hasAlpha ? new Uint8Array(pixels) : undefined;
  for (let y = 0; y < height; y += 1) {
    if (y > 0 && y % 512 === 0) {
      throwIfAborted(signal);
      await yieldToUi();
      throwIfAborted(signal);
    }
    const sourceRow = y * width * 4;
    const targetRow = y * width * 3;
    for (let x = 0; x < width; x += 1) {
      const sourcePixel = sourceRow + x * 4;
      const targetPixel = targetRow + x * 3;
      color[targetPixel] = data[sourcePixel];
      color[targetPixel + 1] = data[sourcePixel + 1];
      color[targetPixel + 2] = data[sourcePixel + 2];
      if (alpha) alpha[y * width + x] = data[sourcePixel + 3];
    }
  }
  throwIfAborted(signal);
  return { color, alpha };
}

async function embedRawRgbaRaster(pdf: PDFDocument, raster: MoRasterPixels, hasAlpha: boolean, signal?: AbortSignal, onTiming?: MoPdfOptions["onTiming"]): Promise<EmbeddedMoImage> {
  throwIfAborted(signal);
  const encodeStartedAt = performance.now();
  const context = pdf.context;
  const channels = await splitRawRgbaChannels(raster, hasAlpha, signal);
  const alphaRef = channels.alpha
    ? context.register(context.flateStream(channels.alpha, {
      Type: "XObject",
      Subtype: "Image",
      Width: raster.width,
      Height: raster.height,
      BitsPerComponent: 8,
      ColorSpace: "DeviceGray",
    }))
    : undefined;
  throwIfAborted(signal);
  const ref = context.register(context.flateStream(channels.color, {
    Type: "XObject",
    Subtype: "Image",
    Width: raster.width,
    Height: raster.height,
    BitsPerComponent: 8,
    ColorSpace: "DeviceRGB",
    SMask: alphaRef,
  }));
  onTiming?.("image-encode", performance.now() - encodeStartedAt);
  return Object.freeze({ kind: "raw-rgba", ref, width: raster.width, height: raster.height });
}

async function embedLegacyFace(pdf: PDFDocument, srcdoc: string, backgroundColor: string | null, signal?: AbortSignal, onTiming?: MoPdfOptions["onTiming"]): Promise<EmbeddedMoImage> {
  return Object.freeze({ kind: "legacy-png", image: await pdf.embedPng(await facePng(srcdoc, signal, backgroundColor, onTiming)) });
}

function drawEmbeddedImage(page: PDFPage, image: EmbeddedMoImage, placement: ImagePlacement): void {
  if (image.kind === "legacy-png") {
    page.drawImage(image.image, placement);
    return;
  }
  const key = page.node.newXObject("Image", image.ref);
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.PushGraphicsState),
    PDFOperator.of(PDFOperatorNames.ConcatTransformationMatrix, [
      PDFNumber.of(placement.width), PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(placement.height), PDFNumber.of(placement.x), PDFNumber.of(placement.y),
    ]),
    PDFOperator.of(PDFOperatorNames.DrawObject, [key]),
    PDFOperator.of(PDFOperatorNames.PopGraphicsState),
  );
}

export async function drawMoRasterImage(
  pdf: PDFDocument,
  page: PDFPage,
  raster: MoRasterPixels,
  placement: ImagePlacement,
  hasAlpha = true,
  signal?: AbortSignal,
): Promise<void> {
  const image = await embedRawRgbaRaster(pdf, raster, hasAlpha, signal);
  drawEmbeddedImage(page, image, placement);
}

type LayoutOverlayDocument = Readonly<{ srcdoc: string; xMm: number; yMm: number; widthMm: number; heightMm: number }>;

function layoutOverlayDocument(source: Document, slot: "left" | "right", rotate: boolean): LayoutOverlayDocument | undefined {
  const half = source.querySelector<HTMLElement>(`.mo-half[data-mo-slot="${slot}"]`);
  if (!half) throw new Error("MO_LAYOUT_OVERLAY_HALF_MISSING");
  const fields = Array.from(half.querySelectorAll<HTMLElement>(":scope > .mo-layout-field"));
  if (!fields.length) return undefined;
  const boxes = fields.map((field) => {
    const readMm = (value: string): number => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) throw new Error("MO_LAYOUT_OVERLAY_GEOMETRY_INVALID");
      return parsed;
    };
    const left = readMm(field.style.left);
    const top = readMm(field.style.top);
    const width = readMm(field.style.width);
    const height = readMm(field.style.height);
    return { field: field.cloneNode(true) as HTMLElement, left, top, width, height };
  });
  const positioned = boxes.map((box) => ({
    ...box,
    left: rotate ? 148.5 - box.left - box.width : box.left,
    top: rotate ? 210 - box.top - box.height : box.top,
  }));
  const xMm = Math.min(...positioned.map((box) => box.left));
  const yMm = Math.min(...positioned.map((box) => box.top));
  const rightMm = Math.max(...positioned.map((box) => box.left + box.width));
  const bottomMm = Math.max(...positioned.map((box) => box.top + box.height));
  const widthMm = rightMm - xMm;
  const heightMm = bottomMm - yMm;
  for (const box of positioned) {
    box.field.style.left = `${box.left - xMm}mm`;
    box.field.style.top = `${box.top - yMm}mm`;
    if (rotate) {
      box.field.style.transform = "rotate(180deg)";
      box.field.style.transformOrigin = "center";
    }
  }
  const style = source.querySelector("style")?.textContent ?? "";
  const content = positioned.map(({ field }) => field.outerHTML).join("");
  const overlay = `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><style>${style}html,body{margin:0!important;background:transparent!important;overflow:hidden}.mo-layout-crop{position:relative;overflow:hidden;background:transparent}.mo-layout-field{overflow:visible!important}</style></head><body><div class="mo-sheet mo-layout-crop" style="display:block;width:${widthMm}mm;height:${heightMm}mm">${content}</div></body></html>`;
  return Object.freeze({ srcdoc: overlay, xMm, yMm, widthMm, heightMm });
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Creates a blank manual-completion MO-51 packet. I3 deliberately does not
 * place imported order fields on the form while postal roles remain unresolved.
 * Image assets are cached only because the current renderer has no per-order
 * visible fields other than the one shared Sender CNIC.
 */
export async function createMoPdfBlob(
  candidates: readonly MoCandidate[],
  senderCnicInput: string,
  options: MoPdfOptions = {},
): Promise<Blob> {
  const { signal, onProgress, onTiming, backRotation = "none", mappings = new Map(), draftMode = false, layout, sideMode = "paired", imageEncoding = "legacy-png" } = options;
  throwIfAborted(signal);
  if (!candidates.length) throw new Error("MO_PDF_NO_ELIGIBLE_RECORDS");
  const cnic = formatSenderCnic(senderCnicInput);
  if (cnic.status === "invalid") throw new Error("MO_SENDER_CNIC_INVALID");

  const layoutActive = Boolean(layout?.fields.length);
  if (layoutActive && layout && hasLegacyMoPartyPositions(layout)) throw new Error("MO_LAYOUT_PARTY_POSITION_CORRECTION_REQUIRED");
  const hasDraftFields = !layoutActive && candidates.some((candidate) => hasVisibleMoFields(resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())));
  if (draftMode && !hasDraftFields) throw new Error("MO_DRAFT_REQUIRES_USER_CONFIRMED_FIELDS");
  const appliedMappings = layoutActive || draftMode ? mappings : new Map<number, MoSessionMapping>();
  if (layoutActive && layout) {
    for (const candidate of candidates) {
      for (const field of layout.fields) {
        if (field.source !== "senderCnic" && !resolveMoLayoutSource(candidate, field.source, senderCnicInput, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())) {
          throw new Error(`MO_LAYOUT_SOURCE_MISSING:eligible-${candidates.indexOf(candidate) + 1}:${field.source}`);
        }
      }
    }
  }

  const plan = imposeMoCandidates(candidates);
  const faces = sideMode === "paired" ? ["front", "back"] as const : [sideMode === "front-only" ? "front" : "back"] as const;
  const totalPages = plan.sheetCount * faces.length;
  const pdf = await PDFDocument.create();
  pdf.setTitle(layoutActive ? "MO-51 user-defined layout batch" : draftMode ? "MO-51 user-confirmed incomplete draft forms" : "MO-51 blank manual-completion forms");
  pdf.setSubject(layoutActive ? "User-defined field layout batch; official postal acceptance is not asserted" : draftMode ? "User-confirmed draft values; unresolved postal fields remain blank; not an official completed money order" : "Blank forms for manual completion; not an official completed money order");
  pdf.setKeywords(layoutActive ? ["MO-51", "user-defined layout", "batch"] : draftMode ? ["MO-51", "user-confirmed draft", "not postal verified", "incomplete"] : ["MO-51", "blank", "manual completion", "not completed"]);
  const blankArtworkCache = new Map<string, EmbeddedMoImage>();
  const layoutArtworkCache = new Map<string, EmbeddedMoImage>();
  let completedPages = 0;

  for (const sheet of plan.sheets) {
    throwIfAborted(signal);
    const htmlStartedAt = performance.now();
    const docs = renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation, appliedMappings, layoutActive ? layout : undefined);
    onTiming?.("html-generation", performance.now() - htmlStartedAt);
    for (const face of faces) {
      throwIfAborted(signal);
      const faceCandidates = face === "front" ? sheet.front : sheet.back;
      const assemblyStartedAt = performance.now();
      let facePreparationMs = 0;
      const onPageTiming: MoPdfOptions["onTiming"] = (phase, durationMs) => {
        onTiming?.(phase, durationMs);
        if (phase === "dom-ready" || phase === "pdf-local-validation" || phase === "overlay-preparation" || phase === "html2canvas" || phase === "raster-readback" || phase === "image-encode" || phase === "png-encode") {
          facePreparationMs += durationMs;
        }
      };
      const page = pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
      if (layoutActive && layout) {
        const cnicValue = cnic.status === "valid" ? cnic.formatted : "";
        const artworkKey = `${face}:${faceCandidates.right ? "two-forms" : "blank-right"}:${face === "back" ? backRotation : "none"}:${cnicValue}`;
        const staticArtworkOnly = cnicValue.length === 0;
        let artwork = staticArtworkOnly ? layoutArtworkCache.get(artworkKey) : undefined;
        if (!artwork) {
          const artworkDocs = renderMoPreviewDocuments(sheet, cnicValue, backRotation, new Map());
          artwork = await embedLegacyFace(pdf, artworkDocs[face], "#fff", signal, onPageTiming);
          if (staticArtworkOnly) layoutArtworkCache.set(artworkKey, artwork);
        }
        drawEmbeddedImage(page, artwork, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });

        const overlayStartedAt = performance.now();
        const overlaySource = new DOMParser().parseFromString(docs[face], "text/html");
        const overlays = new Map<"left" | "right", ReturnType<typeof layoutOverlayDocument>>([
          ["left", layoutOverlayDocument(overlaySource, "left", face === "back" && backRotation === "rotate-180")],
          ["right", layoutOverlayDocument(overlaySource, "right", face === "back" && backRotation === "rotate-180")],
        ]);
        onPageTiming("overlay-preparation", performance.now() - overlayStartedAt);
        for (const slot of ["left", "right"] as const) {
          const candidate = faceCandidates[slot];
          if (!candidate) continue;
          const overlay = overlays.get(slot);
          if (!overlay) continue;
          const mmToPoints = PAGE_WIDTH_PT / 297;
          const image = imageEncoding === "legacy-png"
            ? await embedLegacyFace(pdf, overlay.srcdoc, null, signal, onPageTiming)
            : await embedRawRgbaRaster(pdf, await faceRaster(overlay.srcdoc, signal, null, onPageTiming), true, signal, onPageTiming);
          drawEmbeddedImage(page, image, {
            x: ((slot === "right" ? 148.5 : 0) + overlay.xMm) * mmToPoints,
            y: PAGE_HEIGHT_PT - (overlay.yMm + overlay.heightMm) * mmToPoints,
            width: overlay.widthMm * mmToPoints,
            height: overlay.heightMm * mmToPoints,
          });
        }
      } else {
        const visualFields = [faceCandidates.left, faceCandidates.right].map((candidate) => candidate ? resolveMoVisibleFields(candidate, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()) : null);
        const key = `${face}:${faceCandidates.right ? "two-forms" : "blank-right"}:${cnic.status === "valid" ? cnic.formatted : "no-cnic"}:${face === "back" ? backRotation : "none"}:${JSON.stringify(visualFields)}`;
        const staticArtworkOnly = visualFields.every((fields) => !fields || !hasVisibleMoFields(fields)) && cnic.status !== "valid";
        let image = staticArtworkOnly ? blankArtworkCache.get(key) : undefined;
        if (!image) {
          image = await embedLegacyFace(pdf, docs[face], "#fff", signal, onPageTiming);
          if (staticArtworkOnly) blankArtworkCache.set(key, image);
        }
        drawEmbeddedImage(page, image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });
      }
      onTiming?.("pdf-assembly", Math.max(0, performance.now() - assemblyStartedAt - facePreparationMs));
      completedPages += 1;
      onProgress?.(Object.freeze({ completedPages, totalPages }));
      await yieldToUi();
    }
  }

  throwIfAborted(signal);
  const pdfSaveStartedAt = performance.now();
  const bytes = await pdf.save({ useObjectStreams: true });
  onTiming?.("pdf-save", performance.now() - pdfSaveStartedAt);
  throwIfAborted(signal);
  const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer as ArrayBuffer
    : bytes.slice().buffer as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}
