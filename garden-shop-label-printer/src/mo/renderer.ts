import sourceHtml from "../../MO 51/VP_Money_Order_Form_A5.html?raw";
import urduRegularUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2?url";
import urduMediumUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-500-normal.woff2?url";
import urduBoldUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2?url";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import { imposeMoCandidates, type MoFaceSlots, type MoSheet } from "./imposition";
import { emptyMoSessionMapping, hasVisibleMoFields, resolveMoVisibleFields, type MoSessionMapping, type MoVisibleField } from "./mapping";
import { MO_LAYOUT_SOURCES, resolveMoLayoutSource, type MoDataSource, type MoLayout } from "./layout";

const FRONT_SECTION_INDEX = 0;
const BACK_SECTION_INDEX = 1;

export const MO_FORM_GEOMETRY = Object.freeze({
  sheetWidthMm: 297,
  sheetHeightMm: 210,
  halfWidthMm: 148.5,
  halfHeightMm: 210,
  sourceWidthMm: 148,
  sourceHeightMm: 220,
  uniformScale: Math.min(148.5 / 148, 210 / 220),
});

export type MoBackPreviewRotation = "none" | "rotate-180";

export type MoPreviewDocuments = Readonly<{
  front: string;
  back: string;
  physicalRotationApproved: false;
  draftMode: boolean;
}>;

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function appendMoValue(container: HTMLElement | undefined, field: MoVisibleField | undefined, key: string, left = "2px"): void {
  if (!container || !field?.value.trim()) return;
  container.style.position = "relative";
  const value = container.ownerDocument.createElement("span");
  value.className = "mo-user-value";
  value.dataset.moField = key;
  value.dataset.moProvenance = field.provenance;
  value.textContent = field.value;
  value.dir = "auto";
  value.style.cssText = `position:absolute;left:${left};bottom:0;background:#fff;padding:0 2px;white-space:nowrap;unicode-bidi:isolate;font:9px 'Times New Roman',serif;line-height:1.1`;
  container.append(value);
}

/** Section 1's two complete party blocks are swapped; their captions and following postcode boxes move as a unit. */
function placeReceiverAboveSender(sourcePage: HTMLElement): void {
  const partyLabels = Array.from(sourcePage.querySelectorAll<HTMLElement>('div[style*="width:104px"]'));
  const senderLabel = partyLabels.find((block) => block.textContent?.includes("بھیجنے والے کا نام"));
  const receiverLabel = partyLabels.find((block) => block.textContent?.includes("وصول کرنے والے"));
  const sender = senderLabel?.parentElement as HTMLElement | undefined;
  const receiver = receiverLabel?.parentElement as HTMLElement | undefined;
  if (!sender || !receiver || !sender.nextElementSibling || !receiver.nextElementSibling || sender.parentElement !== receiver.parentElement) {
    throw new Error("MO_TEMPLATE_PARTY_BLOCKS_NOT_FOUND");
  }
  const senderPostcode = sender.nextElementSibling;
  const receiverPostcode = receiver.nextElementSibling;
  sender.dataset.moPartyBlock = "sender";
  receiver.dataset.moPartyBlock = "receiver";
  sender.querySelector<HTMLElement>("div")?.setAttribute("data-mo-party-caption", "sender");
  receiver.querySelector<HTMLElement>("div")?.setAttribute("data-mo-party-caption", "receiver");
  const senderMarker = sourcePage.ownerDocument.createComment("sender-block-position");
  const receiverMarker = sourcePage.ownerDocument.createComment("receiver-block-position");
  sender.before(senderMarker);
  receiver.before(receiverMarker);
  senderMarker.replaceWith(receiver, receiverPostcode);
  receiverMarker.replaceWith(sender, senderPostcode);
}

function senderCnicLine(sourcePage: HTMLElement): HTMLElement {
  const sender = sourcePage.querySelector<HTMLElement>('[data-mo-party-block="sender"]');
  const labels = sender?.querySelector<HTMLElement>('div[style*="width:104px"]');
  if (!sender || !labels?.textContent?.includes("شناختی کارڈ نمبر")) throw new Error("MO_TEMPLATE_SENDER_CNIC_LABEL_NOT_FOUND");
  const writingLines = sender.children[2]
    ? Array.from(sender.children[2].children).filter((element): element is HTMLElement =>
      element instanceof HTMLElement && element.style.height === "19px" && Boolean(element.style.borderBottom),
    )
    : [];
  if (writingLines.length !== 4) throw new Error("MO_TEMPLATE_SENDER_CNIC_POSITION_NOT_FOUND");
  const line = writingLines[2];
  line.dataset.moSenderCnicAnchor = "true";
  line.style.position = "relative";
  return line;
}

function localDocument(
  slots: MoFaceSlots,
  sourcePageIndex: 0 | 1,
  senderCnic: string,
  rotation: MoBackPreviewRotation,
  mappings: ReadonlyMap<number, MoSessionMapping>,
  layout?: MoLayout,
): string {
  const cnic = formatSenderCnic(senderCnic);
  if (cnic.status === "invalid") throw new Error("MO_SENDER_CNIC_INVALID");

  const parsed = new DOMParser().parseFromString(sourceHtml, "text/html");
  parsed.querySelectorAll("link, script, style").forEach((element) => element.remove());
  const sourcePages = parsed.querySelectorAll<HTMLElement>(".page");
  if (sourcePages.length !== 2) throw new Error("MO_TEMPLATE_PAGE_COUNT_INVALID");

  const half = (candidate: MoCandidate | null, slot: "left" | "right") => {
    if (!candidate) return `<div class="mo-half mo-blank" data-mo-slot="${slot}" aria-label="Blank unused form area"></div>`;
    const sourcePage = sourcePages[sourcePageIndex].cloneNode(true) as HTMLElement;
    if (sourcePageIndex === FRONT_SECTION_INDEX) placeReceiverAboveSender(sourcePage);
    const cnicLine = sourcePageIndex === FRONT_SECTION_INDEX ? senderCnicLine(sourcePage) : undefined;
    sourcePage.dataset.moSourceIndex = String(candidate.sourceIndex);
    sourcePage.dataset.moPrefix = candidate.prefix;
    const layoutActive = Boolean(layout?.fields.length);
    const visibleFields = layoutActive ? {} : resolveMoVisibleFields(candidate, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping());
    sourcePage.dataset.moVisibleFields = Object.entries(visibleFields).filter(([, field]) => Boolean(field?.value.trim())).map(([key]) => key).join(",");
    sourcePage.style.margin = "0";
    sourcePage.style.boxShadow = "none";
    sourcePage.style.overflow = "visible";
    sourcePage.style.position = "absolute";
    sourcePage.style.left = `${(MO_FORM_GEOMETRY.halfWidthMm - MO_FORM_GEOMETRY.sourceWidthMm * MO_FORM_GEOMETRY.uniformScale) / 2}mm`;
    sourcePage.style.top = "0";
    sourcePage.style.transformOrigin = "top left";
    sourcePage.style.transform = `scale(${MO_FORM_GEOMETRY.uniformScale})`;

    if (sourcePageIndex === FRONT_SECTION_INDEX) {
      sourcePage.querySelector<HTMLElement>('div[style*="width:172px"]')?.setAttribute("data-mo-allowed-text-overlap", "declaredPrincipal,manualPrincipal,principal");
    }

    sourcePage.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
      if (element.style.fontFamily.includes("Noto Nastaliq Urdu")) {
        element.style.fontFamily = "'Noto Naskh Arabic', serif";
        if (Number.parseFloat(element.style.fontSize) < 9) element.style.fontSize = "9px";
      }
    });

    if (!layoutActive && sourcePageIndex === FRONT_SECTION_INDEX) {
      const articleLabel = Array.from(sourcePage.querySelectorAll("span")).find((element) => element.textContent?.trim() === "No. of V. P. Article");
      appendMoValue(articleLabel?.parentElement as HTMLElement | undefined, visibleFields.articleNumber, "article-number", "90px");
      const principalBox = sourcePage.querySelector<HTMLElement>('div[style*="width:172px"]');
      if (principalBox) principalBox.dataset.moAllowedTextOverlap = "declaredPrincipal,manualPrincipal,principal";
      appendMoValue(principalBox ?? undefined, visibleFields.principal, "principal");

      const partyBlocks = Array.from(sourcePage.querySelectorAll<HTMLElement>('div[style*="width:104px"]'));
      const senderBlock = partyBlocks.find((block) => block.textContent?.includes("بھیجنے والے کا نام"));
      const receiverBlock = partyBlocks.find((block) => block !== senderBlock && block.textContent?.includes("وصول کرنے والے"));
      const senderLines = senderBlock?.parentElement?.children[2]?.children;
      const receiverLines = receiverBlock?.parentElement?.children[2]?.children;
      appendMoValue(senderLines?.[0] as HTMLElement | undefined, visibleFields.senderName, "sender-name");
      const senderAddress = [visibleFields.senderAddress?.value, visibleFields.senderPhone?.value].filter(Boolean).join(" / ");
      appendMoValue(senderLines?.[1] as HTMLElement | undefined, senderAddress ? Object.freeze({ value: senderAddress, provenance: visibleFields.senderAddress?.provenance ?? visibleFields.senderPhone?.provenance ?? "manual MO-session entry" }) : undefined, "sender-address-phone");
      appendMoValue(receiverLines?.[0] as HTMLElement | undefined, visibleFields.receiverName, "receiver-name");
      appendMoValue(receiverLines?.[1] as HTMLElement | undefined, visibleFields.receiverAddress, "receiver-address");
      appendMoValue(receiverLines?.[2] as HTMLElement | undefined, visibleFields.receiverPhone, "receiver-phone");
    }

    if (sourcePageIndex === FRONT_SECTION_INDEX && cnic.status === "valid") {
      if (!cnicLine) throw new Error("MO_TEMPLATE_SENDER_CNIC_POSITION_NOT_FOUND");
      const value = sourcePage.ownerDocument.createElement("span");
      value.className = "mo-sender-cnic-value";
      value.dataset.moSenderCnic = "true";
      value.dataset.moField = "sender-cnic";
      value.dataset.moLayoutSource = "senderCnic";
      value.dir = "ltr";
      value.textContent = cnic.formatted;
      const cnicLayout = layout?.fields.find((field) => field.source === "senderCnic");
      if (cnicLayout) value.dataset.moLayoutField = cnicLayout.id;
      const cnicFontPx = cnicLayout ? cnicLayout.fontSizePt * 96 / 72 : 10;
      const cnicFontWeight = cnicLayout?.bold ? "700" : "400";
      value.style.cssText = `position:absolute;left:2px;right:2px;bottom:0;box-sizing:border-box;background:#fff;padding:0 2px;white-space:nowrap;direction:ltr;unicode-bidi:isolate;font:${cnicFontWeight} ${cnicFontPx}px 'Times New Roman',serif;line-height:1.1;text-align:${cnicLayout?.alignment ?? "left"}`;
      cnicLine.append(value);
    }

    const previewTransform = sourcePageIndex === BACK_SECTION_INDEX && rotation === "rotate-180" ? "transform:rotate(180deg);transform-origin:center" : "";
    const draftMarker = hasVisibleMoFields(visibleFields) ? `<div class="mo-draft-marker" role="note">USER-CONFIRMED DRAFT · NOT POSTAL VERIFIED</div>` : "";
    const layoutFields = layoutActive && layout
      ? layout.fields.filter((field) => field.source !== "senderCnic" && field.face === (sourcePageIndex === FRONT_SECTION_INDEX ? "front" : "back")).map((field) => {
        const resolved = resolveMoLayoutSource(candidate, field.source, senderCnic, mappings.get(candidate.sourceIndex) ?? emptyMoSessionMapping());
        const box = sourcePage.ownerDocument.createElement("div");
        box.className = "mo-layout-field";
        box.dataset.moLayoutField = field.id;
        box.dataset.moLayoutSource = field.source;
        box.style.cssText = `position:absolute;left:${field.xMm}mm;top:${field.yMm}mm;width:${field.widthMm}mm;height:${field.heightMm}mm;box-sizing:border-box;color:#000;font:${field.bold ? "700 " : "400 "}${field.fontSizePt}pt 'Noto Naskh Arabic',Arial,sans-serif;line-height:1.2;text-align:${field.alignment};white-space:${field.wrap ? "normal" : "nowrap"};overflow:visible`;
        if (resolved) {
          const text = sourcePage.ownerDocument.createElement("span");
          text.dataset.moLayoutText = field.id;
          text.dataset.moProvenance = resolved.provenance;
          text.textContent = resolved.value;
          text.dir = "auto";
          text.style.cssText = `display:block;width:${field.wrap ? "100%" : "max-content"};min-height:100%;overflow:visible;line-height:1.2;white-space:${field.wrap ? "normal" : "nowrap"};unicode-bidi:isolate`;
          box.append(text);
        } else if (field.source !== "senderCnic") {
          box.dataset.moLayoutMissing = field.source;
          box.textContent = `MISSING ${field.source}`;
        }
        return box.outerHTML;
      }).join("")
      : "";
    return `<div class="mo-half" data-mo-slot="${slot}" data-mo-source-index="${candidate.sourceIndex}" data-mo-draft="${String(hasVisibleMoFields(visibleFields))}" style="${previewTransform}">${draftMarker}${sourcePage.outerHTML}${layoutFields}</div>`;
  };

  const face = sourcePageIndex === FRONT_SECTION_INDEX ? "front" : "back";
  const pageCss = `
    @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:400;font-display:block;src:url('${urduRegularUrl}') format('woff2')}
    @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:500;font-display:block;src:url('${urduMediumUrl}') format('woff2')}
    @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:700;font-display:block;src:url('${urduBoldUrl}') format('woff2')}
    *{box-sizing:border-box}html,body{margin:0;padding:0;width:297mm;height:210mm;overflow:hidden;background:#fff}
    body{display:flex;direction:ltr}.mo-half{position:relative;flex:0 0 148.5mm;width:148.5mm;height:210mm;overflow:hidden;background:#fff}
    .mo-half>.page{margin:0!important;box-shadow:none!important;break-after:auto!important}
    .mo-blank{background:#fff}.page{font-kerning:normal;text-rendering:optimizeLegibility}
    .mo-draft-marker{position:absolute;z-index:20;top:1mm;right:1mm;border:0.3mm solid #a71923;background:#fff;color:#a71923;padding:0.5mm 1mm;font:7px Arial,sans-serif;white-space:nowrap}
    .mo-layout-field{z-index:10;box-sizing:border-box;color:#000;background:transparent;border:0}.mo-layout-field[data-mo-layout-missing]{color:#a71923;background:#fff5f5;border:.2mm solid #a71923;font:7px Arial,sans-serif}
  `;
  return `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MO-51 ${face} preview</title><style>${pageCss}</style></head><body><div class="mo-sheet" data-mo-face="${face}" data-mo-rotation="${rotation}" style="display:flex;width:297mm;height:210mm;direction:ltr">${half(slots.left, "left")}${half(slots.right, "right")}</div></body></html>`;
}

/** Render two isolated preview documents from the uploaded blank form. No source row fields are injected. */
export function renderMoPreviewDocuments(
  sheet: MoSheet,
  senderCnic: string,
  backRotation: MoBackPreviewRotation = "none",
  mappings: ReadonlyMap<number, MoSessionMapping> = new Map(),
  layout?: MoLayout,
): MoPreviewDocuments {
  const layoutActive = Boolean(layout?.fields.length);
  const draftMode = !layoutActive && [...mappings].some(([sourceIndex, mapping]) => {
    const candidate = [sheet.front.left, sheet.front.right].find((record) => record?.sourceIndex === sourceIndex);
    return candidate ? hasVisibleMoFields(resolveMoVisibleFields(candidate, mapping)) : false;
  });
  return Object.freeze({
    front: localDocument(sheet.front, FRONT_SECTION_INDEX, senderCnic, "none", mappings, layout),
    back: localDocument(sheet.back, BACK_SECTION_INDEX, senderCnic, backRotation, mappings, layout),
    physicalRotationApproved: false,
    draftMode,
  });
}

export type MoLayoutDiagnostic = Readonly<{
  code: "overflow" | "overlap" | "artwork-overlap" | "missing" | "legacy";
  message: string;
  fieldId?: string;
  relatedFieldId?: string;
  source?: MoDataSource;
}>;

function sourceLabel(source: string | undefined, fallback = "Mapped field"): string {
  return MO_LAYOUT_SOURCES.find((item) => item.id === source)?.label ?? fallback;
}

function staticFieldLabel(field: string | undefined): string {
  const labels: Readonly<Record<string, string>> = {
    "article-number": "V.P. article number",
    principal: "Amount principal",
    "sender-name": "Sender name",
    "sender-address-phone": "Sender address/contact",
    "receiver-name": "Receiver name",
    "receiver-address": "Receiver address",
    "receiver-phone": "Receiver contact phone",
    "sender-cnic": "Sender CNIC",
  };
  return labels[field ?? ""] ?? (field ?? "Artwork field").replace(/[-_]+/gu, " ");
}

function recordLocation(element: HTMLElement): string {
  const half = element.closest<HTMLElement>(".mo-half[data-mo-source-index]");
  const page = element.closest<HTMLElement>(".page[data-mo-source-index]");
  const sourceIndex = Number(half?.dataset.moSourceIndex ?? page?.dataset.moSourceIndex);
  const record = Number.isFinite(sourceIndex) ? `Source row ${sourceIndex + 1}` : "MO artwork";
  const slot = half?.dataset.moSlot;
  const face = element.closest<HTMLElement>(".mo-sheet[data-mo-face]")?.dataset.moFace;
  return `${record}${slot ? `, ${slot} form` : ""}${face ? ` (${face})` : ""}`;
}

type GraphemeSegment = Readonly<{ index: number; segment: string }>;
const GraphemeSegmenter = (Intl as unknown as { Segmenter?: new (locales?: string | string[], options?: { granularity: "grapheme" }) => { segment(value: string): Iterable<GraphemeSegment> } }).Segmenter;
const graphemeSegmenter = GraphemeSegmenter ? new GraphemeSegmenter(undefined, { granularity: "grapheme" }) : undefined;

function textNodeGlyphRects(node: Node): readonly DOMRect[] {
  const text = node.textContent ?? "";
  if (!text.trim()) return [];
  let offset = 0;
  const fallbackSegments = Array.from(text).map((segment) => {
    const current = { index: offset, segment };
    offset += segment.length;
    return current;
  });
  const segments: readonly GraphemeSegment[] = graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text)) : fallbackSegments;
  const range = node.ownerDocument!.createRange();
  const rects: DOMRect[] = [];
  for (const segment of segments) {
    if (!segment.segment.trim()) continue;
    range.setStart(node, segment.index);
    range.setEnd(node, segment.index + segment.segment.length);
    rects.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0.25 && rect.height > 0.5));
  }
  return rects;
}

function renderedTextRects(element: HTMLElement): readonly DOMRect[] {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, document.defaultView?.NodeFilter.SHOW_TEXT ?? 4);
  const rects: DOMRect[] = [];
  let node = walker.nextNode();
  while (node) {
    rects.push(...textNodeGlyphRects(node));
    node = walker.nextNode();
  }
  return rects;
}

function staticArtworkTextRects(page: HTMLElement): readonly Readonly<{ rect: DOMRect; label: string }>[] {
  const document = page.ownerDocument;
  const walker = document.createTreeWalker(page, document.defaultView?.NodeFilter.SHOW_TEXT ?? 4);
  const rects: Array<Readonly<{ rect: DOMRect; label: string }>> = [];
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const label = node.textContent?.trim().replace(/\s+/gu, " ") ?? "";
    if (label && !parent?.closest("[data-mo-field],[data-mo-layout-text],[data-mo-sender-cnic],[data-mo-layout-missing],.mo-editor-field,.mo-editor-binding,[data-mo-editor-only]")) {
      rects.push(...textNodeGlyphRects(node).map((rect) => Object.freeze({ rect, label: label.slice(0, 48) })));
    }
    node = walker.nextNode();
  }
  return rects;
}

function staticArtworkGraphicRects(page: HTMLElement): readonly Readonly<{ rect: DOMRect; label: string; allowedSources: readonly string[] }>[] {
  const result: Array<Readonly<{ rect: DOMRect; label: string; allowedSources: readonly string[] }>> = [];
  for (const element of Array.from(page.querySelectorAll<HTMLElement>("*"))) {
    if (element.closest("[data-mo-field],[data-mo-layout-text],[data-mo-sender-cnic],[data-mo-layout-missing]")) continue;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style) continue;
    const sideCount = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].filter((width) => Number.parseFloat(width) > 0.5).length;
    const background = style.backgroundColor.replaceAll(" ", "");
    const filled = background !== "transparent" && background !== "rgba(0,0,0,0)" && !/^rgba?\(255,255,255(?:,1)?\)$/u.test(background);
    if (sideCount < 3 && !filled) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) continue;
    result.push(Object.freeze({
      rect,
      label: "printed artwork/stamp box",
      allowedSources: Object.freeze((element.dataset.moAllowedTextOverlap ?? "").split(",").filter(Boolean)),
    }));
  }
  return Object.freeze(result);
}

type StaticArtworkRect = Readonly<{ rect: DOMRect; label: string; allowedSources: readonly string[] }>;
type StaticArtworkGeometryCache = Map<string, readonly StaticArtworkRect[]>;

function staticArtworkCacheKey(half: HTMLElement): string {
  const sheet = half.closest<HTMLElement>(".mo-sheet[data-mo-face]");
  return `${sheet?.dataset.moFace ?? "unknown"}|${sheet?.dataset.moRotation ?? "none"}|${half.dataset.moSlot ?? "unknown"}`;
}

function yieldToMoLayoutUi(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let fallback = 0;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    fallback = window.setTimeout(finish, 50);
    if (document.visibilityState === "visible") window.requestAnimationFrame(finish);
    else finish();
  });
}

/** Inspect rendered text against its actual printable field box; values are never truncated or silently shrunk. */
export function findMoLayoutDiagnostics(doc: Document, artworkGeometryCache?: StaticArtworkGeometryCache): readonly MoLayoutDiagnostic[] {
  const issues: MoLayoutDiagnostic[] = [];
  const push = (issue: MoLayoutDiagnostic): void => { issues.push(Object.freeze(issue)); };
  for (const field of Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-field]"))) {
    const parent = field.parentElement;
    if (!parent) {
      const source = field.dataset.moLayoutSource as MoDataSource | undefined;
      const label = source ? sourceLabel(source) : staticFieldLabel(field.dataset.moField);
      push({ code: "overflow", message: `${recordLocation(field)}: ${label} has no printable line bounds.`, fieldId: field.dataset.moLayoutField, source });
      continue;
    }
    const outer = parent.getBoundingClientRect();
    const inner = field.getBoundingClientRect();
    const isPinnedCnic = field.dataset.moField === "sender-cnic";
    const overflow = isPinnedCnic
      ? !outer.width || !outer.height || field.scrollWidth > parent.clientWidth + 1 || field.scrollHeight > parent.clientHeight + 1
      : !outer.width || !outer.height || inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5 || inner.top < outer.top - 0.5 || inner.bottom > outer.bottom + 0.5;
    if (overflow) {
      const source = field.dataset.moLayoutSource as MoDataSource | undefined;
      const label = source ? sourceLabel(source) : staticFieldLabel(field.dataset.moField);
      push({ code: "overflow", message: `${recordLocation(field)}: ${label} exceeds its printable line bounds.`, fieldId: field.dataset.moLayoutField, source });
    }
  }
  for (const field of Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-layout-text]"))) {
    const box = field.parentElement;
    if (!box) continue;
    const fieldBounds = box.getBoundingClientRect();
    const textBounds = field.getBoundingClientRect();
    const outside = field.scrollWidth > box.clientWidth + 1 || field.scrollHeight > box.clientHeight + 1
      || textBounds.left < fieldBounds.left - 0.5 || textBounds.right > fieldBounds.right + 0.5
      || textBounds.top < fieldBounds.top - 0.5 || textBounds.bottom > fieldBounds.bottom + 0.5;
    if (outside) {
      const fieldId = box.dataset.moLayoutField ?? field.dataset.moLayoutText;
      const source = box.dataset.moLayoutSource as MoDataSource | undefined;
      const measurement = `text ${Math.round(textBounds.width)}×${Math.round(textBounds.height)}px; field ${Math.round(fieldBounds.width)}×${Math.round(fieldBounds.height)}px`;
      push({ code: "overflow", message: `${recordLocation(field)}: ${sourceLabel(source)} text exceeds its printable field bounds (${measurement}).`, fieldId, source });
    }
  }
  for (const field of Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-layout-missing]"))) {
    const source = field.dataset.moLayoutSource as MoDataSource | undefined;
    push({ code: "missing", message: `${recordLocation(field)}: ${sourceLabel(source)} has no value for this record.`, fieldId: field.dataset.moLayoutField, source });
  }

  const intersects = (left: DOMRect, right: DOMRect): boolean => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 0.5
    && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 0.5;
  for (const half of Array.from(doc.querySelectorAll<HTMLElement>(".mo-half[data-mo-slot],.mo-layout-crop"))) {
    const fields = Array.from(half.querySelectorAll<HTMLElement>(":scope > .mo-layout-field"));
    for (let left = 0; left < fields.length; left += 1) {
      for (let right = left + 1; right < fields.length; right += 1) {
        if (intersects(fields[left].getBoundingClientRect(), fields[right].getBoundingClientRect())) {
          const source = fields[left].dataset.moLayoutSource as MoDataSource | undefined;
          const other = sourceLabel(fields[right].dataset.moLayoutSource, "another field");
          push({ code: "overlap", message: `${recordLocation(fields[left])}: ${sourceLabel(source)} overlaps ${other}.`, fieldId: fields[left].dataset.moLayoutField, relatedFieldId: fields[right].dataset.moLayoutField, source });
        }
      }
    }
    const cnic = half.querySelector<HTMLElement>(".mo-sender-cnic-value");
    if (cnic) for (const field of fields) if (intersects(cnic.getBoundingClientRect(), field.getBoundingClientRect())) {
      const source = field.dataset.moLayoutSource as MoDataSource | undefined;
      push({ code: "overlap", message: `${recordLocation(field)}: Sender CNIC overlaps ${sourceLabel(source)}.`, fieldId: cnic.dataset.moLayoutField, relatedFieldId: field.dataset.moLayoutField, source: "senderCnic" });
    }
    const staticPage = half.querySelector<HTMLElement>(".page[data-mo-source-index]");
    if (staticPage) {
      const cacheKey = staticArtworkCacheKey(half);
      let artworkRects = artworkGeometryCache?.get(cacheKey);
      if (!artworkRects) {
        artworkRects = Object.freeze([
          ...staticArtworkTextRects(staticPage).map((artwork) => Object.freeze({ ...artwork, allowedSources: Object.freeze([] as string[]) })),
          ...staticArtworkGraphicRects(staticPage),
        ]);
        artworkGeometryCache?.set(cacheKey, artworkRects);
      }
      const dynamicText = Array.from(half.querySelectorAll<HTMLElement>(".mo-layout-field [data-mo-layout-text],.page [data-mo-field]"));
      for (const field of dynamicText) {
        const glyphRects = renderedTextRects(field);
        const layoutBox = field.closest<HTMLElement>(".mo-layout-field");
        const source = (layoutBox?.dataset.moLayoutSource ?? field.dataset.moLayoutSource) as MoDataSource | undefined;
        const staticField = field.dataset.moField;
        const collisions = artworkRects.filter((artwork) => !artwork.allowedSources.includes(source ?? "") && !artwork.allowedSources.includes(staticField ?? "")).filter((artwork) => glyphRects.some((glyph) => intersects(glyph, artwork.rect)));
        if (!collisions.length) continue;
        const label = source ? sourceLabel(source) : staticFieldLabel(field.dataset.moField);
        const printed = collisions[0];
        const halfRect = half.getBoundingClientRect();
        const printedXmm = halfRect.width ? (printed.rect.left - halfRect.left) * 148.5 / halfRect.width : 0;
        const printedYmm = halfRect.height ? (printed.rect.top - halfRect.top) * 210 / halfRect.height : 0;
        push({ code: "artwork-overlap", message: `${recordLocation(field)}: ${label} overlaps ${printed.label === "printed artwork/stamp box" ? printed.label : `printed MO text “${printed.label}”`} near x=${printedXmm.toFixed(1)} mm, y=${printedYmm.toFixed(1)} mm.`, fieldId: layoutBox?.dataset.moLayoutField ?? field.dataset.moLayoutField, source });
      }
    }
  }
  return Object.freeze(issues.filter((issue, index, values) => values.findIndex((other) => other.code === issue.code && other.message === issue.message && other.fieldId === issue.fieldId) === index));
}

export type MoBatchLayoutValidation = Readonly<{
  checkedRecords: number;
  sheetCount: number;
  checkedFaceDocuments: number;
  diagnostics: readonly MoLayoutDiagnostic[];
  validationDurationMs: number;
  staticArtworkGeometryMeasurements: number;
  staticArtworkGeometryCacheHits: number;
}>;

/** Validate each selected record on both HTML faces in isolated, offscreen layout documents. */
export async function validateMoBatchLayout(
  candidates: readonly MoCandidate[],
  senderCnic: string,
  backRotation: MoBackPreviewRotation,
  mappings: ReadonlyMap<number, MoSessionMapping>,
  layout: MoLayout,
  faces: readonly ("front" | "back")[] = ["front", "back"],
  signal?: AbortSignal,
  onProgress?: (checkedFaceDocuments: number, totalFaceDocuments: number) => void,
): Promise<MoBatchLayoutValidation> {
  const imposition = imposeMoCandidates(candidates);
  const startedAt = performance.now();
  const diagnostics: MoLayoutDiagnostic[] = [];
  let checkedFaceDocuments = 0;
  let staticArtworkGeometryMeasurements = 0;
  let staticArtworkGeometryCacheHits = 0;
  const totalFaceDocuments = imposition.sheetCount * faces.length;
  if (!candidates.length || !layout.fields.length) {
    onProgress?.(0, totalFaceDocuments);
    return Object.freeze({ checkedRecords: candidates.length, sheetCount: imposition.sheetCount, checkedFaceDocuments, diagnostics: Object.freeze([]), validationDurationMs: performance.now() - startedAt, staticArtworkGeometryMeasurements, staticArtworkGeometryCacheHits });
  }
  const frames = new Map<"front" | "back", HTMLIFrameElement>();
  const documents = new Map<"front" | "back", Document>();
  const artworkGeometryCache: StaticArtworkGeometryCache = new Map();
  try {
    const firstSheet = imposition.sheets[0];
     if (!firstSheet) return Object.freeze({ checkedRecords: candidates.length, sheetCount: 0, checkedFaceDocuments, diagnostics: Object.freeze([]), validationDurationMs: performance.now() - startedAt, staticArtworkGeometryMeasurements, staticArtworkGeometryCacheHits });
    const firstDocs = renderMoPreviewDocuments(firstSheet, senderCnic, backRotation, mappings, layout);
    for (const face of faces) {
      if (signal?.aborted) throw new Error("MO_LAYOUT_BATCH_VALIDATION_CANCELLED");
      const frame = document.createElement("iframe");
      frame.title = `Temporary MO-51 ${face} validation`;
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.cssText = "position:fixed;left:-1200px;top:0;width:1123px;height:794px;border:0;opacity:0;pointer-events:none;z-index:-1";
      const loaded = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("MO_LAYOUT_BATCH_DOCUMENT_TIMEOUT")), 30000);
        frame.addEventListener("load", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
        frame.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("MO_LAYOUT_BATCH_DOCUMENT_LOAD_FAILED")); }, { once: true });
      });
      frame.srcdoc = firstDocs[face];
      document.body.append(frame);
      await loaded;
      const frameDocument = frame.contentDocument;
      if (!frameDocument?.querySelector(".mo-sheet")) throw new Error(`MO_LAYOUT_BATCH_DOCUMENT_NOT_READY:${face}`);
      await frameDocument.fonts.ready;
      frames.set(face, frame);
      documents.set(face, frameDocument);
    }

    for (const sheet of imposition.sheets) {
      if (signal?.aborted) throw new Error("MO_LAYOUT_BATCH_VALIDATION_CANCELLED");
      const docs = sheet === firstSheet ? firstDocs : renderMoPreviewDocuments(sheet, senderCnic, backRotation, mappings, layout);
      for (const face of faces) {
        if (signal?.aborted) throw new Error("MO_LAYOUT_BATCH_VALIDATION_CANCELLED");
        const frameDocument = documents.get(face);
        const frame = frames.get(face);
        if (!frameDocument || !frame) throw new Error(`MO_LAYOUT_BATCH_DOCUMENT_NOT_READY:${face}:sheet-${sheet.sheetNumber}`);
        if (sheet !== firstSheet) {
          const parsed = new DOMParser().parseFromString(docs[face], "text/html");
          const nextSheet = parsed.querySelector(".mo-sheet");
          if (!nextSheet) throw new Error(`MO_LAYOUT_BATCH_DOCUMENT_NOT_READY:${face}:sheet-${sheet.sheetNumber}`);
          frameDocument.body.replaceChildren(frameDocument.importNode(nextSheet, true));
          await new Promise<void>((resolve) => frame.contentWindow?.requestAnimationFrame(() => frame.contentWindow?.requestAnimationFrame(() => resolve())) ?? resolve());
          await frameDocument.fonts.ready;
        }
        if (!frameDocument.querySelector(".mo-sheet")) throw new Error(`MO_LAYOUT_BATCH_DOCUMENT_NOT_READY:${face}:sheet-${sheet.sheetNumber}`);
        const measuredBefore = artworkGeometryCache.size;
        const populatedHalves = frameDocument.querySelectorAll(".mo-half[data-mo-slot] .page[data-mo-source-index]").length;
        diagnostics.push(...findMoLayoutDiagnostics(frameDocument, artworkGeometryCache));
        const measuredNow = artworkGeometryCache.size - measuredBefore;
        staticArtworkGeometryMeasurements += measuredNow;
        staticArtworkGeometryCacheHits += Math.max(0, populatedHalves - measuredNow);
        checkedFaceDocuments += 1;
        onProgress?.(checkedFaceDocuments, totalFaceDocuments);
        await yieldToMoLayoutUi();
        if (signal?.aborted) throw new Error("MO_LAYOUT_BATCH_VALIDATION_CANCELLED");
      }
    }
  } finally {
    for (const frame of frames.values()) frame.remove();
  }
  const unique = diagnostics.filter((issue, index, values) => values.findIndex((other) => other.code === issue.code && other.message === issue.message && other.fieldId === issue.fieldId && other.relatedFieldId === issue.relatedFieldId) === index);
  return Object.freeze({
    checkedRecords: candidates.length,
    sheetCount: imposition.sheetCount,
    checkedFaceDocuments,
    diagnostics: Object.freeze(unique),
    validationDurationMs: performance.now() - startedAt,
    staticArtworkGeometryMeasurements,
    staticArtworkGeometryCacheHits,
  });
}

/** Compatibility helpers expose readable messages to the PDF fail-closed gate. */
export function findMoFieldOverflows(doc: Document): readonly string[] {
  return Object.freeze(findMoLayoutDiagnostics(doc).filter((issue) => issue.code === "overflow").map((issue) => issue.message));
}

export function findMoLayoutMissingFields(doc: Document): readonly string[] {
  return Object.freeze(findMoLayoutDiagnostics(doc).filter((issue) => issue.code === "missing").map((issue) => issue.message));
}

/** Dynamic layout boxes must not intersect each other or the anchored session-only CNIC. */
export function findMoFieldOverlaps(doc: Document): readonly string[] {
  return Object.freeze(findMoLayoutDiagnostics(doc).filter((issue) => issue.code === "overlap" || issue.code === "artwork-overlap").map((issue) => issue.message));
}

export function escapeMoAttribute(value: string): string {
  return escapeAttribute(value);
}
