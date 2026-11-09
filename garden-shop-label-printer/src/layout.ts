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
  moduleWidthPx: 2,
  heightPx: 82,
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
  trackingText: { x: 1.7, y: 0.8, width: 31.5, height: 2.2 },
  barcode: { x: 1.7, y: 3.2, width: 31.5, height: 14.2 },
  trackingDivider: { x: 34.0, y: 1.0, width: 0.25, height: 16.4 },
  vpl: { x: 44.4, y: 1.1, width: 19.4, height: 7.5 },
  destination: { x: 34.7, y: 8.7, width: 29, height: 8.4 },
  city: { x: 35.1, y: 9.0, width: 28.2, height: 4.0 },
  province: { x: 35.1, y: 13.2, width: 28.2, height: 3.6 },
  orderProduct: { x: 1.3, y: 17.6, width: 62.4, height: 4.8 },
  orderId: { x: 1.3, y: 17.6, width: 30.8, height: 4.8 },
  contactDivider: { x: 32.5, y: 17.8, width: 0.25, height: 4.4 },
  contact: { x: 33.1, y: 17.6, width: 30.6, height: 4.8 },
  to: { x: 1.3, y: 22.7, width: 62.4, height: 14.0, radius: 1 },
  toTag: { x: 1.8, y: 23.0, width: 7.1, height: 2.8 },
  name: { x: 9.5, y: 23.0, width: 45.5, height: 3.0 },
  address: { x: 9.5, y: 26.25, width: 53.5, height: 7.45 },
  nearbyLabel: { x: 2, y: 33.9, width: 9.5, height: 2.5 },
  landmark: { x: 11.8, y: 33.9, width: 50.5, height: 2.5 },
  product: { x: 1.3, y: 37.0, width: 62.4, height: 2.1 },
  productLabel: { x: 2, y: 37.05, width: 8.5, height: 1.9 },
  productValue: { x: 11, y: 37.05, width: 52, height: 1.9 },
  footer: { x: 1.3, y: 39.4, width: 62.4, height: 3.9 },
  footerFrom: { x: 1.6, y: 39.75, width: 9.0, height: 3.1 },
  footerSender: { x: 11.1, y: 39.7, width: 18.8, height: 3.3 },
  footerDivider: { x: 30.4, y: 39.7, width: 0.25, height: 3.2 },
  footerAddress: { x: 31.2, y: 39.75, width: 31.8, height: 3.2 },
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
  const nameBox: BoxMm = { ...initial, height: initialFit.fits ? initial.height : 4.25 };
  const addressY = nameBox.y + nameBox.height + 0.2;
  return {
    name: nameBox,
    address: {
      ...LABEL_LAYOUT.address,
      y: addressY,
      height: LABEL_LAYOUT.nearbyLabel.y - 0.2 - addressY,
    },
  };
}

export function destinationBoxes(ctx: CanvasRenderingContext2D, city: string, province: string) {
  const cityBase = LABEL_LAYOUT.city;
  const provinceBase = LABEL_LAYOUT.province;
  const cityFits = fitTextMm(ctx, city, cityBase.width, cityBase.height, 18, 12, true, 0.95).fits;
  const provinceFits = fitTextMm(ctx, province, provinceBase.width, provinceBase.height, 11, 8.5, true, 1).fits;
  const longProvince = province.trim().length > 15 || !provinceFits;
  const cityHeight = !cityFits ? 6 : longProvince ? 3.9 : cityBase.height;
  const provinceY = cityBase.y + cityHeight + 0.2;
  return {
    city: { ...cityBase, height: cityHeight },
    province: { ...provinceBase, y: provinceY, height: 17.4 - provinceY },
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
