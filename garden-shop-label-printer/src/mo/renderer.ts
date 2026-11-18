import sourceHtml from "../../MO 51/VP_Money_Order_Form_A5.html?raw";
import urduRegularUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff2?url";
import urduMediumUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-500-normal.woff2?url";
import urduBoldUrl from "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff2?url";
import type { MoCandidate } from "./adapter";
import { formatSenderCnic } from "./cnic";
import type { MoFaceSlots, MoSheet } from "./imposition";

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

function localDocument(slots: MoFaceSlots, sourcePageIndex: 0 | 1, senderCnic: string, rotation: MoBackPreviewRotation): string {
  const cnic = formatSenderCnic(senderCnic);
  if (cnic.status === "invalid") throw new Error("MO_SENDER_CNIC_INVALID");

  const parsed = new DOMParser().parseFromString(sourceHtml, "text/html");
  parsed.querySelectorAll("link, script, style").forEach((element) => element.remove());
  const sourcePages = parsed.querySelectorAll<HTMLElement>(".page");
  if (sourcePages.length !== 2) throw new Error("MO_TEMPLATE_PAGE_COUNT_INVALID");

  const half = (candidate: MoCandidate | null, slot: "left" | "right") => {
    if (!candidate) return `<div class="mo-half mo-blank" data-mo-slot="${slot}" aria-label="Blank unused form area"></div>`;
    const sourcePage = sourcePages[sourcePageIndex].cloneNode(true) as HTMLElement;
    sourcePage.dataset.moSourceIndex = String(candidate.sourceIndex);
    sourcePage.dataset.moPrefix = candidate.prefix;
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

    if (sourcePageIndex === FRONT_SECTION_INDEX && cnic.status === "valid") {
      const labels = sourcePage.querySelector<HTMLElement>('div[style*="width:104px"]');
      if (!labels?.textContent?.includes("شناختی کارڈ نمبر")) throw new Error("MO_TEMPLATE_SENDER_CNIC_LABEL_NOT_FOUND");
      const block = labels?.parentElement;
      const writingLines = block?.children[2]
        ? Array.from(block.children[2].children).filter((element): element is HTMLElement =>
          element instanceof HTMLElement && element.children.length === 0 && element.style.height === "19px" && Boolean(element.style.borderBottom),
        )
        : [];
      if (writingLines.length !== 4) throw new Error("MO_TEMPLATE_SENDER_CNIC_POSITION_NOT_FOUND");
      const line = writingLines[2];
      line.style.position = "relative";
      const value = sourcePage.ownerDocument.createElement("span");
      value.className = "mo-sender-cnic-value";
      value.dataset.moSenderCnic = "true";
      value.dir = "ltr";
      value.textContent = cnic.formatted;
      value.style.cssText = "position:absolute;left:2px;bottom:0;background:#fff;padding:0 2px;white-space:nowrap;direction:ltr;unicode-bidi:isolate;font:10px 'Times New Roman',serif;line-height:1.1";
      line.append(value);
    }

    const previewTransform = sourcePageIndex === BACK_SECTION_INDEX && rotation === "rotate-180" ? "transform:rotate(180deg);transform-origin:center" : "";
    return `<div class="mo-half" data-mo-slot="${slot}" data-mo-source-index="${candidate.sourceIndex}" style="${previewTransform}">${sourcePage.outerHTML}</div>`;
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
  `;
  return `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MO-51 ${face} preview</title><style>${pageCss}</style></head><body><div class="mo-sheet" data-mo-face="${face}" data-mo-rotation="${rotation}" style="display:flex;width:297mm;height:210mm;direction:ltr">${half(slots.left, "left")}${half(slots.right, "right")}</div></body></html>`;
}

/** Render two isolated preview documents from the uploaded blank form. No source row fields are injected. */
export function renderMoPreviewDocuments(
  sheet: MoSheet,
  senderCnic: string,
  backRotation: MoBackPreviewRotation = "none",
): MoPreviewDocuments {
  return Object.freeze({
    front: localDocument(sheet.front, FRONT_SECTION_INDEX, senderCnic, "none"),
    back: localDocument(sheet.back, BACK_SECTION_INDEX, senderCnic, backRotation),
    physicalRotationApproved: false,
  });
}

export function escapeMoAttribute(value: string): string {
  return escapeAttribute(value);
}
