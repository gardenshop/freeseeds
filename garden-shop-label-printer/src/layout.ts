import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  fitText,
} from "./engine";

const PX_PER_MM = 96 / 25.4;
const ARABIC_SCRIPT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u;
const NON_LATIN = /[^\u0000-\u00ff]/u;
const ARABIC_FONT = '"Noto Naskh Arabic", Arial, sans-serif';

export const CODE128_LAYOUT = {
  moduleWidthPx: 1,
  heightPx: 22,
  horizontalQuietZonePx: 10,
  verticalQuietZonePx: 1,
  minimumModuleMm: 0.19,
} as const;

export function usesArabicScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

export function usesComplexScript(text: string): boolean {
  return NON_LATIN.test(text);
}

export function labelFontFamily(text: string): string {
  return usesArabicScript(text) ? ARABIC_FONT : "Arial, sans-serif";
}

export const LABEL_LAYOUT = {
  widthMm: LABEL_WIDTH_MM,
  heightMm: LABEL_HEIGHT_MM,
  borderMm: 0.2,
  insetMm: 1,
  sectionGapMm: 0.4,
  topHeightMm: 6.5,
  middleHeightMm: 9,
  footerHeightMm: 3,
  toInsetMm: 0.65,
  toHeadingMm: 2,
  toNameMm: 4.5,
  toLandmarkMm: 2.5,
  toContactMm: 3,
  fieldGapMm: 0.3,
  orderProductRatio: 0.72,
  orderIdRatio: 0.45,
  barcodeRatio: 0.7,
} as const;

export const LABEL_FOOTER =
  "From: Garden Shop | C/o City Post Office, Sahiwal, Punjab";

export type BoxMm = { x: number; y: number; width: number; height: number };

export function labelBoxes(): {
  content: BoxMm;
  top: BoxMm;
  orderId: BoxMm;
  product: BoxMm;
  cod: BoxMm;
  middle: BoxMm;
  tracking: BoxMm;
  barcode: BoxMm;
  destination: BoxMm;
  to: BoxMm;
  toHeading: BoxMm;
  name: BoxMm;
  address: BoxMm;
  landmark: BoxMm;
  contact: BoxMm;
  footer: BoxMm;
} {
  const s = LABEL_LAYOUT;
  const width = s.widthMm - 2 * (s.insetMm + s.borderMm);
  const contentHeight = s.heightMm - 2 * (s.insetMm + s.borderMm);
  const content: BoxMm = {
    x: s.insetMm + s.borderMm,
    y: s.insetMm + s.borderMm,
    width,
    height: contentHeight,
  };
  const top: BoxMm = { x: content.x, y: content.y, width, height: s.topHeightMm };
  const orderProductWidth = width * s.orderProductRatio;
  const orderIdWidth = orderProductWidth * s.orderIdRatio;
  const middleY = top.y + top.height + s.sectionGapMm;
  const middle: BoxMm = {
    x: content.x,
    y: middleY,
    width,
    height: s.middleHeightMm,
  };
  const barcodeWidth = width * s.barcodeRatio;
  const toY = middle.y + middle.height + s.sectionGapMm;
  const footerY = content.y + content.height - s.footerHeightMm;
  const to: BoxMm = {
    x: content.x,
    y: toY,
    width,
    height: footerY - toY - s.sectionGapMm,
  };
  const toX = to.x + s.toInsetMm;
  const toWidth = to.width - 2 * s.toInsetMm;
  const fieldGap = s.fieldGapMm;
  const toHeading: BoxMm = {
    x: toX,
    y: to.y + s.toInsetMm,
    width: toWidth,
    height: s.toHeadingMm,
  };
  const name: BoxMm = {
    x: toX,
    y: toHeading.y + toHeading.height + fieldGap,
    width: toWidth,
    height: s.toNameMm,
  };
  const landmark: BoxMm = {
    x: toX,
    y: to.y + to.height - s.toInsetMm - s.toContactMm - fieldGap - s.toLandmarkMm,
    width: toWidth,
    height: s.toLandmarkMm,
  };
  const contact: BoxMm = {
    x: toX,
    y: to.y + to.height - s.toInsetMm - s.toContactMm,
    width: toWidth,
    height: s.toContactMm,
  };
  const address: BoxMm = {
    x: toX,
    y: name.y + name.height + fieldGap,
    width: toWidth,
    height: landmark.y - fieldGap - (name.y + name.height + fieldGap),
  };
  return {
    content,
    top,
    orderId: { x: top.x, y: top.y, width: orderIdWidth, height: top.height },
    product: {
      x: top.x + orderIdWidth,
      y: top.y,
      width: orderProductWidth - orderIdWidth,
      height: top.height,
    },
    cod: {
      x: top.x + orderProductWidth,
      y: top.y,
      width: width - orderProductWidth,
      height: top.height,
    },
    middle,
    tracking: {
      x: middle.x,
      y: middle.y,
      width: barcodeWidth,
      height: 2.5,
    },
    barcode: {
      x: middle.x,
      y: middle.y + 2.5,
      width: barcodeWidth,
      height: middle.height - 2.5,
    },
    destination: {
      x: middle.x + barcodeWidth,
      y: middle.y,
      width: width - barcodeWidth,
      height: middle.height,
    },
    to,
    toHeading,
    name,
    address,
    landmark,
    contact,
    footer: {
      x: content.x,
      y: footerY,
      width,
      height: s.footerHeightMm,
    },
  };
}

export function fitTextMm(
  ctx: CanvasRenderingContext2D,
  text: string,
  widthMm: number,
  heightMm: number,
  maxFontPx: number,
  minFontPx: number,
  bold = false,
  lineHeight = 1.15,
) {
  return fitText(
    ctx,
    text,
    widthMm * PX_PER_MM,
    heightMm * PX_PER_MM,
    { maxFont: maxFontPx, minFont: minFontPx, bold, lineHeight, fontFamily: labelFontFamily(text) },
  );
}

export function fitTextPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  widthPx: number,
  heightPx: number,
  maxFontPx: number,
  minFontPx: number,
  bold = false,
  lineHeight = 1.15,
) {
  return fitText(ctx, text, widthPx, heightPx, {
    maxFont: maxFontPx,
    minFont: minFontPx,
    bold,
    lineHeight,
    fontFamily: labelFontFamily(text),
  });
}
