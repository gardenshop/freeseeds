import { createCanvas } from "@napi-rs/canvas";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, MultiFormatReader } from "@zxing/library";
import JsBarcode from "jsbarcode";
import { describe, expect, it } from "vitest";
import { CODE128_LAYOUT } from "../src/layout";

describe("Code 128 output verification", () => {
  it.each([18, 19, 55, 100, 500])("generates and decodes all %i tracking barcodes exactly", (count) => {
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
    const values = Array.from({ length: count }, (_, index) => `TRK${String(index + 1).padStart(10, "0")}`);
    for (const expected of values) {
      const canvas = createCanvas(10, 10);
      JsBarcode(canvas as unknown as HTMLCanvasElement, expected, {
        format: "CODE128",
        displayValue: false,
        margin: CODE128_LAYOUT.horizontalQuietZonePx,
        marginTop: CODE128_LAYOUT.verticalQuietZonePx,
        marginBottom: CODE128_LAYOUT.verticalQuietZonePx,
        marginLeft: CODE128_LAYOUT.horizontalQuietZonePx,
        marginRight: CODE128_LAYOUT.horizontalQuietZonePx,
        height: CODE128_LAYOUT.heightPx,
        width: CODE128_LAYOUT.moduleWidthPx,
      });
      expect(canvas.height).toBe(CODE128_LAYOUT.heightPx + 2 * CODE128_LAYOUT.verticalQuietZonePx);
      expect(CODE128_LAYOUT.moduleWidthPx * 25.4 / 96).toBeGreaterThan(CODE128_LAYOUT.minimumModuleMm);
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const row = Math.floor(canvas.height / 2);
      const isDark = (x: number) => {
        const offset = (row * canvas.width + x) * 4;
        return pixels[offset + 3] > 0 && pixels[offset] < 128;
      };
      const firstBar = Array.from({ length: canvas.width }, (_, x) => x).find(isDark);
      const lastBar = Array.from({ length: canvas.width }, (_, x) => x).reverse().find(isDark);
      expect(firstBar).toBeGreaterThanOrEqual(CODE128_LAYOUT.horizontalQuietZonePx);
      expect(canvas.width - 1 - lastBar!).toBeGreaterThanOrEqual(CODE128_LAYOUT.horizontalQuietZonePx);
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      const source = new HTMLCanvasElementLuminanceSource(canvas as unknown as HTMLCanvasElement);
      const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText();
      expect(decoded).toBe(expected);
    }
  }, 120_000);
});
