import { createCanvas } from "@napi-rs/canvas";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, MultiFormatReader } from "@zxing/library";
import JsBarcode from "jsbarcode";
import { describe, expect, it } from "vitest";

describe("Code 128 output verification", () => {
  it.each([18, 19, 100, 500])("generates and decodes all %i tracking barcodes exactly", (count) => {
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
    const values = Array.from({ length: count }, (_, index) => `TRK${String(index + 1).padStart(10, "0")}`);
    for (const expected of values) {
      const canvas = createCanvas(10, 10);
      JsBarcode(canvas as unknown as HTMLCanvasElement, expected, {
        format: "CODE128",
        displayValue: false,
        margin: 4,
        height: 8,
        width: 1,
      });
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      const source = new HTMLCanvasElementLuminanceSource(canvas as unknown as HTMLCanvasElement);
      const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText();
      expect(decoded).toBe(expected);
    }
  }, 120_000);
});
