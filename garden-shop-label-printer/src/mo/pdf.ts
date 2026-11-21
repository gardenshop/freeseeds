import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { findMoFieldOverflows, findMoFieldOverlaps, renderMoPreviewDocuments, type MoBackPreviewRotation } from "./renderer";
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
export type MoBatchSideMode = "paired" | "front-only" | "back-only";
export type MoPdfOptions = Readonly<{
  signal?: AbortSignal;
  backRotation?: MoBackPreviewRotation;
  mappings?: ReadonlyMap<number, MoSessionMapping>;
  draftMode?: boolean;
  layout?: MoLayout;
  sideMode?: MoBatchSideMode;
  onProgress?: (progress: MoPdfProgress) => void;
}>;

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

async function facePng(srcdoc: string, signal?: AbortSignal, backgroundColor: string | null = "#fff"): Promise<Uint8Array> {
  throwIfAborted(signal);
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
    const overflows = findMoFieldOverflows(doc);
    if (overflows.length) throw new Error(`MO_FIELD_OVERFLOW:${overflows.join(",")}`);
    const overlaps = findMoFieldOverlaps(doc);
    if (overlaps.length) throw new Error(`MO_FIELD_OVERLAP:${overlaps.join(",")}`);
    const bounds = sheet.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
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
    throwIfAborted(signal);
    if (canvas.width !== Math.floor(width * DPI / 96) || canvas.height !== Math.floor(height * DPI / 96)) throw new Error(`MO_PDF_RASTER_SIZE_INVALID:${canvas.width}x${canvas.height}`);
    const png = await abortable(new Promise<Blob>((resolve, reject) => canvas!.toBlob((blob) => blob ? resolve(blob) : reject(new Error("MO_PDF_PNG_ENCODE_FAILED")), "image/png")), signal);
    throwIfAborted(signal);
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    frame.remove();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function layoutOverlayDocument(srcdoc: string, slot: "left" | "right", rotate: boolean): Readonly<{ srcdoc: string; xMm: number; yMm: number; widthMm: number; heightMm: number }> | undefined {
  const source = new DOMParser().parseFromString(srcdoc, "text/html");
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
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
  const { signal, onProgress, backRotation = "none", mappings = new Map(), draftMode = false, layout, sideMode = "paired" } = options;
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
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  const layoutArtworkCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  const layoutOverlayCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  let completedPages = 0;

  for (const sheet of plan.sheets) {
    for (const face of faces) {
      throwIfAborted(signal);
      const faceCandidates = face === "front" ? sheet.front : sheet.back;
      const visualFields = layoutActive && layout
        ? [faceCandidates.left, faceCandidates.right].map((candidate) => candidate ? layout.fields.filter((field) => field.face === face).map((field) => resolveMoLayoutSource(candidate, field.source, senderCnicInput, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())) : null)
        : [faceCandidates.left, faceCandidates.right].map((candidate) => candidate ? resolveMoVisibleFields(candidate, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()) : null);
      const docs = renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation, appliedMappings, layoutActive ? layout : undefined);
      const page = pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
      if (layoutActive && layout) {
        const cnicValue = cnic.status === "valid" ? cnic.formatted : "";
        const artworkKey = `${face}:${faceCandidates.right ? "two-forms" : "blank-right"}:${face === "back" ? backRotation : "none"}:${cnicValue}`;
        let artwork = layoutArtworkCache.get(artworkKey);
        if (!artwork) {
          const artworkDocs = renderMoPreviewDocuments(sheet, cnicValue, backRotation, new Map());
          artwork = await pdf.embedPng(await facePng(artworkDocs[face], signal));
          layoutArtworkCache.set(artworkKey, artwork);
        }
        page.drawImage(artwork, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });

        for (const slot of ["left", "right"] as const) {
          const candidate = faceCandidates[slot];
          if (!candidate) continue;
          const overlay = layoutOverlayDocument(docs[face], slot, face === "back" && backRotation === "rotate-180");
          if (!overlay) continue;
          const overlayValues = layout.fields
            .filter((field) => field.face === face && field.source !== "senderCnic")
            .map((field) => ({
              source: field.source,
              xMm: field.xMm,
              yMm: field.yMm,
              widthMm: field.widthMm,
              heightMm: field.heightMm,
              fontSizePt: field.fontSizePt,
              bold: field.bold,
              alignment: field.alignment,
              wrap: field.wrap,
              value: resolveMoLayoutSource(candidate, field.source, senderCnicInput, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())?.value ?? "",
            }));
          const overlayKey = `${face}:${face === "back" ? backRotation : "none"}:${JSON.stringify(overlayValues)}`;
          let image = layoutOverlayCache.get(overlayKey);
          if (!image) {
            image = await pdf.embedPng(await facePng(overlay.srcdoc, signal, null));
            layoutOverlayCache.set(overlayKey, image);
          }
          const mmToPoints = PAGE_WIDTH_PT / 297;
          page.drawImage(image, {
            x: ((slot === "right" ? 148.5 : 0) + overlay.xMm) * mmToPoints,
            y: PAGE_HEIGHT_PT - (overlay.yMm + overlay.heightMm) * mmToPoints,
            width: overlay.widthMm * mmToPoints,
            height: overlay.heightMm * mmToPoints,
          });
        }
      } else {
        const key = `${face}:${faceCandidates.right ? "two-forms" : "blank-right"}:${cnic.status === "valid" ? cnic.formatted : "no-cnic"}:${face === "back" ? backRotation : "none"}:${JSON.stringify(visualFields)}`;
        let image = imageCache.get(key);
        if (!image) {
          image = await pdf.embedPng(await facePng(docs[face], signal));
          imageCache.set(key, image);
        }
        page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });
      }
      completedPages += 1;
      onProgress?.(Object.freeze({ completedPages, totalPages }));
      await yieldToUi();
    }
  }

  throwIfAborted(signal);
  const bytes = await pdf.save({ useObjectStreams: true });
  throwIfAborted(signal);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}
