import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  PAPER_PRESETS,
  type PaperPreset,
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
  trackingText: { x: 1.7, y: 0.8, width: 31.5, height: 2.0 },
  barcode: { x: 1.7, y: 3.0, width: 31.5, height: 8.4 },
  trackingDivider: { x: 34.0, y: 0.5, width: 0.25, height: 14.0 },
  vpl: { x: 44.4, y: 0.5, width: 19.4, height: 7.0 },
  destination: { x: 34.7, y: 7.7, width: 29, height: 6.8 },
  city: { x: 35.1, y: 7.9, width: 28.2, height: 4.0 },
  province: { x: 35.1, y: 12.1, width: 28.2, height: 2.4 },
  orderProduct: { x: 1.3, y: 14.8, width: 62.4, height: 4.7 },
  orderId: { x: 1.3, y: 14.8, width: 30.8, height: 4.7 },
  contactDivider: { x: 32.5, y: 15.0, width: 0.25, height: 4.3 },
  contact: { x: 33.1, y: 14.8, width: 30.6, height: 4.7 },
  to: { x: 1.3, y: 19.8, width: 62.4, height: 15.8, radius: 1 },
  toTag: { x: 1.8, y: 20.1, width: 7.1, height: 2.8 },
  name: { x: 9.5, y: 20.1, width: 53.5, height: 2.8 },
  address: { x: 9.5, y: 23.2, width: 53.5, height: 6.8 },
  nearbyLabel: { x: 2, y: 30.3, width: 10.5, height: 3.5 },
  landmark: { x: 12.8, y: 30.3, width: 49.5, height: 3.5 },
  product: { x: 1.3, y: 35.9, width: 62.4, height: 3.1 },
  productLabel: { x: 2, y: 36.05, width: 8.5, height: 2.7 },
  productValue: { x: 11, y: 36.05, width: 52, height: 2.7 },
  footer: { x: 1.3, y: 39.2, width: 62.4, height: 4.2 },
  footerFrom: { x: 1.6, y: 39.65, width: 9.0, height: 3.3 },
  footerSender: { x: 11.1, y: 39.6, width: 18.8, height: 3.4 },
  footerDivider: { x: 30.4, y: 39.6, width: 0.25, height: 3.3 },
  footerAddress: { x: 31.2, y: 39.65, width: 31.8, height: 3.3 },
} as const;

export const LABEL_FOOTER = "From: Garden Shop | C/o City Post Office, Sahiwal";
export const LABEL_FOOTER_ADDRESS = "C/o City Post Office, Sahiwal";

export type BoxMm = { x: number; y: number; width: number; height: number };
export type LabelBoxes = {
  [Key in Exclude<keyof typeof LABEL_LAYOUT, "widthMm" | "heightMm">]: BoxMm;
};

export function labelBoxes(preset: PaperPreset = PAPER_PRESETS.A4): LabelBoxes {
  const { widthMm: _width, heightMm: _height, ...boxes } = LABEL_LAYOUT;
  const scaleX = preset.labelWidthMm / LABEL_WIDTH_MM;
  const scaleY = preset.labelHeightMm / LABEL_HEIGHT_MM;
  return Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, {
    x: box.x * scaleX, y: box.y * scaleY, width: box.width * scaleX, height: box.height * scaleY,
  }])) as LabelBoxes;
}

export const HP_P2055_IMAGEABLE_EDGE_MM = 4.233;
export const HP_P2055_PRINT_ALLOWANCE_MM = 1;
export const HP_P2055_SAFE_EDGE_MM = HP_P2055_IMAGEABLE_EDGE_MM + HP_P2055_PRINT_ALLOWANCE_MM;

export type LabelContentTransform = { offsetX: number; offsetY: number; scaleX: number; scaleY: number };

const IDENTITY_LABEL_CONTENT_TRANSFORM: LabelContentTransform = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

/** Maps only label content into the printer's imageable area; sheet/label coordinates never move. */
export function labelContentTransform(
  preset: PaperPreset,
  slot: number,
  hpP2055SafeArea = true,
): LabelContentTransform {
  if (!hpP2055SafeArea || preset.id !== "CUSTOM") return IDENTITY_LABEL_CONTENT_TRANSFORM;
  if (!Number.isInteger(slot) || slot < 0 || slot >= preset.rows * preset.columns) throw new Error("LABEL_SLOT_INVALID");

  const boxes = Object.entries(labelBoxes(preset)).filter(([name]) => name !== "outline").map(([, box]) => box);
  const contentRightMm = Math.max(...boxes.map((box) => box.x + box.width));
  const contentBottomMm = Math.max(...boxes.map((box) => box.y + box.height));
  const column = slot % preset.columns;
  const row = Math.floor(slot / preset.columns);
  const columnStart = preset.columnStartsMm[column];
  const rowStart = preset.rowStartsMm[row];
  if (columnStart === undefined || rowStart === undefined) throw new Error("LABEL_SLOT_INVALID");

  let offsetX = 0;
  let offsetY = 0;
  let scaleX = 1;
  let scaleY = 1;
  if (column === 0) {
    offsetX = HP_P2055_SAFE_EDGE_MM - columnStart;
    scaleX = (preset.labelWidthMm - offsetX) / contentRightMm;
  } else if (column === preset.columns - 1) {
    scaleX = (preset.widthMm - HP_P2055_SAFE_EDGE_MM - columnStart) / contentRightMm;
  }
  if (row === 0) {
    offsetY = HP_P2055_SAFE_EDGE_MM - rowStart;
    scaleY = (preset.labelHeightMm - offsetY) / contentBottomMm;
  } else if (row === preset.rows - 1) {
    scaleY = (preset.heightMm - HP_P2055_SAFE_EDGE_MM - rowStart) / contentBottomMm;
  }
  if (scaleX <= 0 || scaleY <= 0) throw new Error("PRINT_SAFE_AREA_UNAVAILABLE");
  return { offsetX, offsetY, scaleX, scaleY };
}

export function transformLabelContentBox(box: BoxMm, transform: LabelContentTransform): BoxMm {
  return {
    x: transform.offsetX + box.x * transform.scaleX,
    y: transform.offsetY + box.y * transform.scaleY,
    width: box.width * transform.scaleX,
    height: box.height * transform.scaleY,
  };
}

export function transformLabelContentPoint(point: { x: number; y: number }, transform: LabelContentTransform) {
  return {
    x: transform.offsetX + point.x * transform.scaleX,
    y: transform.offsetY + point.y * transform.scaleY,
  };
}

export function recipientBoxes(ctx: CanvasRenderingContext2D, name: string, preset: PaperPreset = PAPER_PRESETS.A4) {
  const boxes = labelBoxes(preset);
  const initial = boxes.name;
  const initialFit = fitTextMm(ctx, name, initial.width, initial.height, 12, 9, true, 1);
  const nameBox: BoxMm = { ...initial, height: initialFit.fits ? initial.height : 4.25 * preset.labelHeightMm / LABEL_HEIGHT_MM };
  const addressY = nameBox.y + nameBox.height + 0.2;
  return {
    name: nameBox,
    address: {
      ...boxes.address,
      y: addressY,
      height: boxes.nearbyLabel.y - 0.2 * preset.labelHeightMm / LABEL_HEIGHT_MM - addressY,
    },
  };
}

export function destinationBoxes(ctx: CanvasRenderingContext2D, city: string, province: string, preset: PaperPreset = PAPER_PRESETS.A4) {
  const boxes = labelBoxes(preset);
  const cityBase = boxes.city;
  const provinceBase = boxes.province;
  const cityFits = fitTextMm(ctx, city, cityBase.width, cityBase.height, 18, 7, true, 0.95).fits;
  const provinceFits = fitTextMm(ctx, province, provinceBase.width, provinceBase.height, 11, 6, true, 1).fits;
  const longProvince = province.trim().length > 15 || !provinceFits;
  const scaleY = preset.labelHeightMm / LABEL_HEIGHT_MM;
  const cityHeight = longProvince ? cityBase.height - 0.4 * scaleY : !cityFits ? 4.4 * scaleY : cityBase.height;
  const provinceY = cityBase.y + cityHeight + 0.2 * scaleY;
  return {
    city: { ...cityBase, height: cityHeight },
    province: { ...provinceBase, y: provinceY, height: 14.5 * scaleY - provinceY },
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
