import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import jsQR from "jsqr";
import sharp from "sharp";
import { scanRGBABuffer } from "@undecaf/zbar-wasm";

function decodeWithJsQr(rgba, width, height) {
  const decoded = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
  return decoded ? { payload: decoded.data, version: decoded.version, location: decoded.location } : undefined;
}

async function decodeWithZbar(image) {
  const { data, info } = await sharp(image).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const symbols = await scanRGBABuffer(buffer, info.width, info.height);
  const qr = symbols.find((symbol) => symbol.typeName === "ZBAR_QRCODE");
  return qr?.decode();
}

async function quietZoneCrop(source, location, version, sourceWidth, sourceHeight) {
  const corners = [location.topLeftCorner, location.topRightCorner, location.bottomLeftCorner, location.bottomRightCorner];
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const qrSide = Math.ceil(Math.max(maxX - minX, maxY - minY));
  const modules = 17 + 4 * version;
  const quiet = Math.ceil((qrSide / modules) * 4);
  const side = qrSide + quiet * 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const left = Math.round(centerX - qrSide / 2);
  const top = Math.round(centerY - qrSide / 2);
  if (left < 0 || top < 0 || left + qrSide > sourceWidth || top + qrSide > sourceHeight) throw new Error("QR_BOUNDARY_OUT_OF_IMAGE");
  const crop = await source.clone().extract({ left, top, width: qrSide, height: qrSide }).png().toBuffer();
  const padded = await sharp({ create: { width: side, height: side, channels: 3, background: "white" } })
    .composite([{ input: crop, left: quiet, top: quiet }])
    .png()
    .toBuffer();
  return sharp(padded)
    .resize(800, 800, { kernel: "nearest" })
    .png()
    .toBuffer();
}

function payloadFields(payload, depth = 0) {
  const fields = [];
  if (depth > 4) return fields;
  const text = payload.trim();
  try {
    const value = JSON.parse(text);
    fields.push(...Object.values(value).filter((item) => typeof item === "string" || typeof item === "number").map(String));
  } catch {}
  try {
    const url = new URL(text);
    fields.push(url.hostname, ...url.pathname.split("/"), ...[...url.searchParams.values()]);
  } catch {}
  fields.push(text);
  let offset = 0;
  while (offset + 4 <= text.length) {
    const tag = text.slice(offset, offset + 2);
    const lengthText = text.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) break;
    const length = Number(lengthText);
    const value = text.slice(offset + 4, offset + 4 + length);
    if (value.length !== length) break;
    fields.push(value);
    if ((Number(tag) >= 26 && Number(tag) <= 51) || tag === "62") fields.push(...payloadFields(value, depth + 1));
    offset += 4 + length;
  }
  return fields;
}

function destinationIdentifierExactFieldMatch(payload, expected) {
  if (!expected) return undefined;
  const normalizedExpected = expected.replace(/[\s-]/g, "").toUpperCase();
  return payloadFields(payload).some((field) => {
    let decoded = field;
    try {
      decoded = decodeURIComponent(field.replace(/%(?![\da-f]{2})/gi, "%25"));
    } catch {}
    const normalized = /^\d+$/.test(normalizedExpected)
      ? decoded.replace(/\D/g, "")
      : decoded.replace(/[\s-]/g, "").toUpperCase();
    return normalized === normalizedExpected;
  });
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourcePath = argument("--source");
const outputPath = argument("--output");
const expected = argument("--expected");
const alternate = argument("--alternate");
if (!sourcePath || !outputPath) throw new Error("USAGE: node extract-payment-qr.mjs --source <image> --output <png> [--expected <account>");
if (resolve(sourcePath) === resolve(outputPath)) throw new Error("SOURCE_AND_OUTPUT_MUST_DIFFER");

const original = await readFile(sourcePath);
if (original.byteLength > 8 * 1024 * 1024) throw new Error("SOURCE_IMAGE_TOO_LARGE");
const oriented = sharp(original).rotate().ensureAlpha();
const { data, info } = await oriented.raw().toBuffer({ resolveWithObject: true });
const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
const firstOriginal = decodeWithJsQr(rgba, info.width, info.height);
if (!firstOriginal) throw new Error("SOURCE_QR_DECODE_FAILED_JSQR");
const secondOriginal = await decodeWithZbar(original);
if (secondOriginal === undefined) throw new Error("SOURCE_QR_DECODE_FAILED_ZBAR");
if (firstOriginal.payload !== secondOriginal) throw new Error("SOURCE_QR_PAYLOADS_DIFFER");

const sourceSharp = sharp(original).rotate();
const derivative = await quietZoneCrop(sourceSharp, firstOriginal.location, firstOriginal.version, info.width, info.height);
const derivativePixels = await sharp(derivative).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const derivativeRgba = new Uint8ClampedArray(derivativePixels.data.buffer, derivativePixels.data.byteOffset, derivativePixels.data.byteLength);
const firstDerivative = decodeWithJsQr(derivativeRgba, derivativePixels.info.width, derivativePixels.info.height);
if (!firstDerivative) throw new Error("DERIVATIVE_SCAN_FAILED_JSQR");
const secondDerivative = await decodeWithZbar(derivative);
if (secondDerivative === undefined) throw new Error("DERIVATIVE_SCAN_FAILED_ZBAR");
if (firstDerivative.payload !== firstOriginal.payload || secondDerivative !== firstOriginal.payload) throw new Error("DERIVATIVE_PAYLOAD_MISMATCH");

await writeFile(outputPath, derivative);
const metadata = await sharp(derivative).metadata();
console.log(JSON.stringify({
  sourceSha256: createHash("sha256").update(original).digest("hex"),
  derivativeSha256: createHash("sha256").update(derivative).digest("hex"),
  sourcePayloadSha256: createHash("sha256").update(firstOriginal.payload).digest("hex"),
  extractorVersion: "gfs-176-v1",
  decoderVersions: "jsqr@1.4.0;@undecaf/zbar-wasm@0.11.0",
  decoderAgreement: firstOriginal.payload === secondOriginal,
  derivativePayloadMatch: firstDerivative.payload === firstOriginal.payload && secondDerivative === firstOriginal.payload,
  scanPass: Boolean(firstDerivative && secondDerivative),
  configuredIdentifierExactFieldMatch: destinationIdentifierExactFieldMatch(firstOriginal.payload, expected),
  alternateIdentifierExactFieldMatch: destinationIdentifierExactFieldMatch(firstOriginal.payload, alternate),
  derivativeMime: "image/png",
  derivativeWidth: metadata.width,
  derivativeHeight: metadata.height,
  sourceBytes: original.byteLength,
  derivativeBytes: derivative.byteLength
}));
