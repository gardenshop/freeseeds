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
  trackingCaption: { x: 1.7, y: 0.6, width: 30.5, height: 1.7 },
  tracking: { x: 1.7, y: 2.4, width: 30.5, height: 2.8 },
  barcode: { x: 1.7, y: 5.4, width: 30.5, height: 4.7 },
  trackingDivider: { x: 32.6, y: 0.6, width: 0.25, height: 9.5 },
  destination: { x: 33.2, y: 0.6, width: 15.4, height: 9.5 },
  city: { x: 33.5, y: 0.8, width: 14.8, height: 5.1 },
  province: { x: 33.5, y: 6.3, width: 14.8, height: 3.3 },
  vpl: { x: 49.0, y: 1.1, width: 14.2, height: 7.8 },
  to: { x: 1.3, y: 10.8, width: 62.4, height: 22.6, radius: 1 },
  toTag: { x: 1.8, y: 11.2, width: 7.1, height: 3.1 },
  name: { x: 9.5, y: 11.2, width: 45.5, height: 3.1 },
  address: { x: 9.5, y: 14.8, width: 53.5, height: 10.2 },
  nearbyLabel: { x: 2, y: 25.5, width: 9.5, height: 2.8 },
  landmark: { x: 11.8, y: 25.5, width: 19, height: 2.8 },
  contactDivider: { x: 31.5, y: 28.8, width: 0.25, height: 3.4 },
  contact: { x: 32.7, y: 29.1, width: 30, height: 3.0 },
  orderProduct: { x: 1.3, y: 33.7, width: 62.4, height: 5.3 },
  orderId: { x: 1.3, y: 33.7, width: 28.5, height: 5.3 },
  product: { x: 29.8, y: 33.7, width: 33.9, height: 5.3 },
  footer: { x: 1.3, y: 39.3, width: 62.4, height: 4.1 },
  footerFrom: { x: 1.6, y: 39.75, width: 8.0, height: 3.2 },
  footerSender: { x: 10.0, y: 39.7, width: 17.0, height: 3.3 },
  footerDivider: { x: 27.5, y: 39.7, width: 0.25, height: 3.2 },
  footerAddress: { x: 28.3, y: 39.75, width: 35.0, height: 3.2 },
} as const;

export const LABEL_FOOTER = "From: Garden Shop | C/o City Post Office, Sahiwal";
export const LABEL_FOOTER_ADDRESS = "C/o City Post Office, Sahiwal";

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
  const initialFit = fitTextMm(ctx, name, initial.width, initial.height, 12, 9, true, 1);
  const nameBox: BoxMm = { ...initial, height: initialFit.fits ? initial.height : 6.4 };
  const addressY = nameBox.y + nameBox.height + 0.1;
  return {
    name: nameBox,
    address: {
      ...LABEL_LAYOUT.address,
      y: addressY,
      height: 25.1 - addressY,
    },
  };
}

export function destinationBoxes(ctx: CanvasRenderingContext2D, city: string, province: string) {
  const cityBase = LABEL_LAYOUT.city;
  const provinceBase = LABEL_LAYOUT.province;
  const cityFits = fitTextMm(ctx, city, cityBase.width, cityBase.height, 18, 12, true, 0.95).fits;
  const provinceFits = fitTextMm(ctx, province, provinceBase.width, provinceBase.height, 11, 8.5, true, 1).fits;
  const longProvince = province.trim().length > 15 || !provinceFits;
  const cityHeight = longProvince && province.trim().length > 15 ? 4.4 : !cityFits ? 6.2 : cityBase.height;
  const provinceY = cityBase.y + cityHeight + 0.4;
  return {
    city: { ...cityBase, height: cityHeight },
    province: { ...provinceBase, y: provinceY, height: 9.7 - provinceY },
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
