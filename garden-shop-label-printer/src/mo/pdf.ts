import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates } from "./imposition";
import { findMoFieldOverflows, renderMoPreviewDocuments, type MoBackPreviewRotation } from "./renderer";
import { emptyMoSessionMapping, hasVisibleMoFields, resolveMoVisibleFields, type MoSessionMapping } from "./mapping";

const PT_PER_MM = 72 / 25.4;
const PAGE_WIDTH_PT = 297 * PT_PER_MM;
const PAGE_HEIGHT_PT = 210 * PT_PER_MM;
const CSS_WIDTH = 297 / 25.4 * 96;
const CSS_HEIGHT = 210 / 25.4 * 96;
const DPI = 300;
const PX_WIDTH = Math.floor(CSS_WIDTH * DPI / 96);
const PX_HEIGHT = Math.floor(CSS_HEIGHT * DPI / 96);

export const MO_PDF_GEOMETRY = Object.freeze({
  widthMm: 297,
  heightMm: 210,
  widthPt: PAGE_WIDTH_PT,
  heightPt: PAGE_HEIGHT_PT,
  rasterDpi: DPI,
});

export type MoPdfProgress = Readonly<{ completedPages: number; totalPages: number }>;
export type MoPdfOptions = Readonly<{
  signal?: AbortSignal;
  backRotation?: MoBackPreviewRotation;
  mappings?: ReadonlyMap<number, MoSessionMapping>;
  draftMode?: boolean;
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

async function facePng(srcdoc: string, signal?: AbortSignal): Promise<Uint8Array> {
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
    canvas = await abortable(html2canvas(sheet, {
      scale: DPI / 96,
      backgroundColor: "#fff",
      width: CSS_WIDTH,
      height: CSS_HEIGHT,
      windowWidth: CSS_WIDTH,
      windowHeight: CSS_HEIGHT,
      useCORS: false,
      allowTaint: false,
      logging: false,
      foreignObjectRendering: false,
      removeContainer: true,
    }), signal);
    throwIfAborted(signal);
    if (canvas.width !== PX_WIDTH || canvas.height !== PX_HEIGHT) throw new Error(`MO_PDF_RASTER_SIZE_INVALID:${canvas.width}x${canvas.height}`);
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
  const { signal, onProgress, backRotation = "none", mappings = new Map(), draftMode = false } = options;
  throwIfAborted(signal);
  if (!candidates.length) throw new Error("MO_PDF_NO_ELIGIBLE_RECORDS");
  const cnic = formatSenderCnic(senderCnicInput);
  if (cnic.status === "invalid") throw new Error("MO_SENDER_CNIC_INVALID");

  const hasDraftFields = candidates.some((candidate) => hasVisibleMoFields(resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping())));
  if (draftMode && !hasDraftFields) throw new Error("MO_DRAFT_REQUIRES_USER_CONFIRMED_FIELDS");
  const appliedMappings = draftMode ? mappings : new Map<number, MoSessionMapping>();

  const plan = imposeMoCandidates(candidates);
  const totalPages = plan.pdfPageCount;
  const pdf = await PDFDocument.create();
  pdf.setTitle(draftMode ? "MO-51 user-confirmed incomplete draft forms" : "MO-51 blank manual-completion forms");
  pdf.setSubject(draftMode ? "User-confirmed draft values; unresolved postal fields remain blank; not an official completed money order" : "Blank forms for manual completion; not an official completed money order");
  pdf.setKeywords(draftMode ? ["MO-51", "user-confirmed draft", "not postal verified", "incomplete"] : ["MO-51", "blank", "manual completion", "not completed"]);
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  let completedPages = 0;

  for (const sheet of plan.sheets) {
    for (const face of ["front", "back"] as const) {
      throwIfAborted(signal);
      const visualFields = [sheet.front.left, sheet.front.right].map((candidate) => candidate ? resolveMoVisibleFields(candidate, appliedMappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping()) : null);
      const key = `${face}:${sheet.front.right ? "two-forms" : "blank-right"}:${cnic.status === "valid" ? cnic.formatted : "no-cnic"}:${face === "back" ? backRotation : "none"}:${JSON.stringify(visualFields)}`;
      let image = imageCache.get(key);
      if (!image) {
        const docs = renderMoPreviewDocuments(sheet, cnic.status === "valid" ? cnic.formatted : "", backRotation, appliedMappings);
        const png = await facePng(docs[face], signal);
        throwIfAborted(signal);
        image = await pdf.embedPng(png);
        imageCache.set(key, image);
      }

      const page = pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });
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
