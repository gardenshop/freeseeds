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
  heightPx: 16,
  horizontalQuietZonePx: 10,
  verticalQuietZonePx: 1,
  minimumModuleMm: 0.19,
} as const;

export { A4_LABEL_COLUMNS_MM, A4_LABEL_ROWS_MM } from "./engine";

export function usesArabicScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

export function usesComplexScript(text: string): boolean {
  return NON_LATIN.test(text);
}

export function labelFontFamily(text: string): string {
  return usesArabicScript(text) ? ARABIC_FONT : "Arial, sans-serif";
}

export function formatVpl(value: string): string {
  const amount = value.trim()
    .replace(/^(?:(?:VPL|COD|Rs\.?)\s*)+/i, "")
    .replace(/\s*\/\-\s*$/, "");
  return amount ? `VPL ${amount}/-` : "VPL AMOUNT NEEDED";
}

export const LABEL_LAYOUT = {
  widthMm: LABEL_WIDTH_MM,
  heightMm: LABEL_HEIGHT_MM,
  outline: { x: 0.4, y: 0.4, width: 64.2, height: 43.2, radius: 1, stroke: 0.2 },
  orderId: { x: 1.2, y: 1.2, width: 19.8, height: 6.2 },
  product: { x: 21, y: 1.2, width: 22.6, height: 6.2 },
  vpl: { x: 44.4, y: 1.2, width: 19.4, height: 6.2 },
  trackingCaption: { x: 1.7, y: 8.5, width: 31.5, height: 1.7 },
  tracking: { x: 1.7, y: 10.2, width: 31.5, height: 3.3 },
  barcode: { x: 1.7, y: 13.7, width: 31.5, height: 4.8 },
  trackingDivider: { x: 34, y: 8.5, width: 0.25, height: 10.2 },
  destination: { x: 34.7, y: 8.5, width: 29, height: 10.2 },
  city: { x: 35.1, y: 8.8, width: 28.2, height: 5.7 },
  province: { x: 35.1, y: 15.1, width: 28.2, height: 3.1 },
  to: { x: 1.3, y: 19.2, width: 62.4, height: 18.1, radius: 1 },
  toTag: { x: 1.8, y: 19.7, width: 7.1, height: 3.2 },
  name: { x: 9.5, y: 19.7, width: 45.5, height: 3.2 },
  address: { x: 9.5, y: 23, width: 53.5, height: 9.6 },
  nearbyLabel: { x: 2, y: 33.4, width: 9.5, height: 3.2 },
  landmark: { x: 11.8, y: 33.4, width: 19, height: 3.2 },
  contactDivider: { x: 31.5, y: 32.8, width: 0.25, height: 4.5 },
  contact: { x: 32.7, y: 33.4, width: 30, height: 3.2 },
  footer: { x: 1.2, y: 37.8, width: 62.6, height: 5.2 },
  footerFrom: { x: 1.6, y: 38.35, width: 8.3, height: 4.05 },
  footerSender: { x: 10.4, y: 38.25, width: 18.8, height: 4.1 },
  footerDivider: { x: 29.7, y: 38.3, width: 0.25, height: 4 },
  footerAddress: { x: 30.5, y: 38.4, width: 32.5, height: 3.8 },
} as const;

export const LABEL_FOOTER = "From: Garden Shop | C/o City Post Office, Sahiwal, Punjab";

export type BoxMm = { x: number; y: number; width: number; height: number };
export type LabelBoxes = {
  [Key in Exclude<keyof typeof LABEL_LAYOUT, "widthMm" | "heightMm">]: BoxMm;
};

export function labelBoxes(): LabelBoxes {
  const { widthMm: _width, heightMm: _height, ...boxes } = LABEL_LAYOUT;
  return boxes;
}

export function recipientBoxes(ctx: CanvasRenderingContext2D, name: string) {
  const initial = LABEL_LAYOUT.name;
  const initialFit = fitTextMm(ctx, name, initial.width, initial.height, 16, 12, true, 1);
  const nameBox: BoxMm = { ...initial, height: initialFit.fits ? initial.height : 6.4 };
  const addressY = nameBox.y + nameBox.height + 0.1;
  return {
    name: nameBox,
    address: {
      ...LABEL_LAYOUT.address,
      y: addressY,
      height: 32.6 - addressY,
    },
  };
}

export function destinationBoxes(ctx: CanvasRenderingContext2D, city: string, province: string) {
  const cityBase = LABEL_LAYOUT.city;
  const provinceBase = LABEL_LAYOUT.province;
  const cityFits = fitTextMm(ctx, city, cityBase.width, cityBase.height, 18, 12, true, 0.95).fits;
  const provinceFits = fitTextMm(ctx, province, provinceBase.width, provinceBase.height, 11, 8.5, true, 1).fits;
  const cityHeight = !cityFits && provinceFits ? 6.2 : !provinceFits && cityFits ? 4.1 : !cityFits ? 4.1 : cityBase.height;
  const provinceY = cityBase.y + cityHeight + 0.6;
  return {
    city: { ...cityBase, height: cityHeight },
    province: { ...provinceBase, y: provinceY, height: 18.2 - provinceY },
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
  wrap = true,
) {
  return fitText(
    ctx,
    text,
    widthMm * PX_PER_MM,
    heightMm * PX_PER_MM,
    { maxFont: maxFontPx, minFont: minFontPx, bold, lineHeight, fontFamily: labelFontFamily(text), noWrap: !wrap },
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
  wrap = true,
) {
  return fitText(ctx, text, widthPx, heightPx, {
    maxFont: maxFontPx,
    minFont: minFontPx,
    bold,
    lineHeight,
    fontFamily: labelFontFamily(text),
    noWrap: !wrap,
  });
}
