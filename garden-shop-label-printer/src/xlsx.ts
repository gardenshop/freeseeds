import { unzipSync } from "fflate";

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function normalizePart(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\//, "").split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "";
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function padWithNumberMask(value: number, format: string): string | undefined {
  const mask = format.split(";")[0].trim();
  if (!/^0+$/.test(mask) || !Number.isSafeInteger(value) || value < 0) return undefined;
  return String(value).padStart(mask.length, "0");
}

export function restoreZeroFormattedCells(bytes: Uint8Array, rows: unknown[][]): void {
  const archive = unzipSync(bytes);
  const decode = (path: string) => {
    const part = archive[path];
    return part ? new TextDecoder().decode(part) : "";
  };
  const workbook = decode("xl/workbook.xml");
  const firstSheet = /<sheet\b[^>]*>/.exec(workbook)?.[0];
  const relationshipId = firstSheet && attribute(firstSheet, "r:id");
  if (!relationshipId) return;
  const relations = decode("xl/_rels/workbook.xml.rels");
  const sheetRelation = relations.match(/<Relationship\b[^>]*\/>/g)?.find((tag) => attribute(tag, "Id") === relationshipId);
  const target = sheetRelation && attribute(sheetRelation, "Target");
  if (!target) return;
  const sheetPath = normalizePart(target.startsWith("xl/") ? target : `xl/${target}`);
  const sheetXml = decode(sheetPath);
  const stylesXml = decode("xl/styles.xml");
  if (!sheetXml || !stylesXml) return;

  const formats = new Map<number, string>();
  const numFmts = /<numFmt\b[^>]*\/>/g;
  for (const match of stylesXml.matchAll(numFmts)) {
    const id = Number(attribute(match[0], "numFmtId"));
    const code = attribute(match[0], "formatCode");
    if (Number.isInteger(id) && code) formats.set(id, code);
  }
  const xfsBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1];
  const numberFormatByStyle = (xfsBlock?.match(/<xf\b[^>]*\/?>(?:<\/xf>)?/g) ?? []).map((tag) => Number(attribute(tag, "numFmtId") ?? 0));

  for (const rowTag of sheetXml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)) {
    const rowNumber = Number(attribute(rowTag[0].slice(0, rowTag[0].indexOf(">") + 1), "r"));
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    for (const cellTag of rowTag[0].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const opening = cellTag[0].slice(0, cellTag[0].indexOf(">") + 1);
      const reference = attribute(opening, "r");
      const styleIndex = Number(attribute(opening, "s") ?? 0);
      const formatId = numberFormatByStyle[styleIndex];
      if (!reference || formatId === undefined) continue;
      const format = formats.get(formatId);
      if (!format || !/^0+$/.test(format.split(";")[0].trim())) continue;
      const raw = /<v>([^<]*)<\/v>/.exec(cellTag[0])?.[1];
      const numeric = raw === undefined ? undefined : Number(raw);
      const row = rows[rowNumber - 1];
      const column = columnIndex(reference);
      if (!row || column < 0 || typeof row[column] !== "number" || numeric === undefined) continue;
      row[column] = padWithNumberMask(numeric, format) ?? row[column];
    }
  }
}
