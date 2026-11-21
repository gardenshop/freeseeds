import sourceHtml from "../../MO 51/VP_Money_Order_Form_A5.html?raw";
import urduRegularUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2?url";
import urduMediumUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-500-normal.woff2?url";
import urduBoldUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2?url";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import type { MoFaceSlots, MoSheet } from "./imposition";
import { emptyMoSessionMapping, hasVisibleMoFields, resolveMoVisibleFields, type MoSessionMapping, type MoVisibleField } from "./mapping";
import { resolveMoLayoutSource, type MoLayout } from "./layout";

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
      const labels = Array.from(sourcePage.querySelectorAll<HTMLElement>('div[style*="width:104px"]')).find((block) => block.textContent?.includes("بھیجنے والے کا نام"));
      if (!labels?.textContent?.includes("شناختی کارڈ نمبر")) throw new Error("MO_TEMPLATE_SENDER_CNIC_LABEL_NOT_FOUND");
      const block = labels?.parentElement;
      const writingLines = block?.children[2]
        ? Array.from(block.children[2].children).filter((element): element is HTMLElement =>
          element instanceof HTMLElement && element.style.height === "19px" && Boolean(element.style.borderBottom),
        )
        : [];
      if (writingLines.length !== 4) throw new Error("MO_TEMPLATE_SENDER_CNIC_POSITION_NOT_FOUND");
      const line = writingLines[2];
      line.style.position = "relative";
      const value = sourcePage.ownerDocument.createElement("span");
      value.className = "mo-sender-cnic-value";
      value.dataset.moSenderCnic = "true";
      value.dataset.moField = "sender-cnic";
      value.dir = "ltr";
      value.textContent = cnic.formatted;
      const cnicLayout = layout?.fields.find((field) => field.source === "senderCnic");
      const cnicFontPx = cnicLayout ? cnicLayout.fontSizePt * 96 / 72 : 10;
      value.style.cssText = `position:absolute;left:2px;bottom:0;background:#fff;padding:0 2px;white-space:nowrap;direction:ltr;unicode-bidi:isolate;font:${cnicFontPx}px 'Times New Roman',serif;line-height:1.1;text-align:${cnicLayout?.alignment ?? "left"}`;
      line.append(value);
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
        box.style.cssText = `position:absolute;left:${field.xMm}mm;top:${field.yMm}mm;width:${field.widthMm}mm;height:${field.heightMm}mm;box-sizing:border-box;color:#000;font:${field.bold ? "700 " : "400 "}${field.fontSizePt}pt 'Noto Naskh Arabic',Arial,sans-serif;text-align:${field.alignment};white-space:${field.wrap ? "normal" : "nowrap"};overflow:visible`;
        if (resolved) {
          const text = sourcePage.ownerDocument.createElement("span");
          text.dataset.moLayoutText = field.id;
          text.dataset.moProvenance = resolved.provenance;
          text.textContent = resolved.value;
          text.dir = "auto";
          text.style.cssText = `display:${field.wrap ? "block" : "inline-block"};width:${field.wrap ? "100%" : "max-content"};min-height:100%;overflow:visible;white-space:${field.wrap ? "normal" : "nowrap"};unicode-bidi:isolate`;
          box.append(text);
        } else if (field.source !== "senderCnic") {
          box.dataset.moLayoutMissing = field.id;
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

/** Caller checks this in both onscreen preview and PDF raster frames. Never truncate mapped text. */
export function findMoFieldOverflows(doc: Document): readonly string[] {
  const overflows: string[] = [];
  for (const field of Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-field]"))) {
    const parent = field.parentElement;
    if (!parent) {
      overflows.push(`${field.dataset.moField ?? "unknown"}:no-container`);
      continue;
    }
    const outer = parent.getBoundingClientRect();
    const inner = field.getBoundingClientRect();
    if (!outer.width || !outer.height || inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5 || inner.top < outer.top - 0.5 || inner.bottom > outer.bottom + 0.5) {
      overflows.push(`${field.dataset.moField ?? "unknown"}:${inner.width.toFixed(1)}/${outer.width.toFixed(1)}px`);
    }
  }
  for (const field of Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-layout-text]"))) {
    const box = field.parentElement;
    if (!box) continue;
    if (field.scrollWidth > box.clientWidth + 1 || field.scrollHeight > box.clientHeight + 1) overflows.push(`${field.dataset.moLayoutText ?? "layout-field"}:text-overflow`);
  }
  return Object.freeze(overflows);
}

export function findMoLayoutMissingFields(doc: Document): readonly string[] {
  return Object.freeze(Array.from(doc.querySelectorAll<HTMLElement>("[data-mo-layout-missing]"), (field) => field.dataset.moLayoutMissing ?? "unknown"));
}

/** Dynamic layout boxes must not intersect each other or the pinned session-only CNIC. */
export function findMoFieldOverlaps(doc: Document): readonly string[] {
  const overlaps: string[] = [];
  const intersects = (left: DOMRect, right: DOMRect): boolean => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 0.5
    && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 0.5;
  for (const half of Array.from(doc.querySelectorAll<HTMLElement>(".mo-half[data-mo-slot],.mo-layout-crop"))) {
    const fields = Array.from(half.querySelectorAll<HTMLElement>(":scope > .mo-layout-field"));
    for (let left = 0; left < fields.length; left += 1) {
      for (let right = left + 1; right < fields.length; right += 1) {
        if (intersects(fields[left].getBoundingClientRect(), fields[right].getBoundingClientRect())) {
          overlaps.push(`${half.dataset.moSlot}:overlap:${fields[left].dataset.moLayoutSource ?? "field"}/${fields[right].dataset.moLayoutSource ?? "field"}`);
        }
      }
    }
    const cnic = half.querySelector<HTMLElement>(".mo-sender-cnic-value");
    if (cnic) for (const field of fields) if (intersects(cnic.getBoundingClientRect(), field.getBoundingClientRect())) {
      overlaps.push(`${half.dataset.moSlot}:overlap:senderCnic/${field.dataset.moLayoutSource ?? "field"}`);
    }
  }
  return Object.freeze(overlaps.filter((value, index, values) => values.indexOf(value) === index));
}

export function escapeMoAttribute(value: string): string {
  return escapeAttribute(value);
}
