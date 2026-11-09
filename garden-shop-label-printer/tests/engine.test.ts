import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { readSheet as readXlsxSheet } from "read-excel-file/node";
import { A4, A4_LABEL_COLUMNS_MM, A4_LABEL_ROWS_MM, A4_POINTS, addA4Page, detectMapping, findAmbiguousMappings, fitText, labelBox, LABEL_HEIGHT_MM, LABELS_PER_PAGE, LABEL_WIDTH_MM, normalizeAddressText, normalizePakistaniPhone, normalizeRows, pagesForCount, parseCsv, safeContactRemoval, safeCsvCell } from "../src/engine";
import { LABEL_FOOTER, LABEL_LAYOUT, destinationBoxes, formatVpl, labelBoxes, recipientBoxes } from "../src/layout";
import { restoreZeroFormattedCells } from "../src/xlsx";

describe("local workbook and sheet engine", () => {
  it("parses quoted CSV values, embedded commas, quotes and newlines", () => {
    expect(parseCsv('Name,Address\r\n"A, B","House 1, Street 2"\r\n"C ""D""","line one\nline two"')).toEqual([
      ["Name", "Address"], ["A, B", "House 1, Street 2"], ["C \"D\"", "line one\nline two"],
    ]);
  });

  it("fails malformed CSV and safely removes an exact contact match only", () => {
    expect(() => parseCsv('Name,Address\nA,"broken')).toThrow("CSV_UNCLOSED_QUOTE");
    expect(safeContactRemoval("Street 4, 03330000000, Sahiwal", "03330000000")).toEqual({ address: "Street 4, Sahiwal", removed: true });
    expect(safeContactRemoval("Street 4, 0333000000, Sahiwal", "03330000000").address).toBe("Street 4, 0333000000, Sahiwal");
  });

  it("keeps the original source address when removing an exact displayed phone duplicate", () => {
    const headers = ["Name", "Cell #", "Address"];
    const [order] = normalizeRows(headers, [["Sample", "03330000000", "Street 5, 03330000000, Sahiwal"]], detectMapping(headers), true);
    expect(order.address).toBe("Street 5, Sahiwal");
    expect(order.sourceAddress).toBe("Street 5, 03330000000, Sahiwal");
    expect(order.warnings.some((warning) => warning.startsWith("Exact contact match"))).toBe(true);
  });

  it("normalizes spreadsheet line breaks and tabs without changing the source value", () => {
    const headers = ["Name", "Cell #", "Address"];
    const source = "House 225\r\n\tStreet 22   Sector G-6/1\nIslamabad";
    const [order] = normalizeRows(headers, [["Sample", "03330000000", source]], detectMapping(headers), true);
    expect(normalizeAddressText(source)).toBe("House 225 Street 22 Sector G-6/1 Islamabad");
    expect(order.address).toBe("House 225 Street 22 Sector G-6/1 Islamabad");
    expect(order.sourceAddress).toBe(source);
  });

  it("normalizes supported Pakistani mobile formats and rejects incomplete values", () => {
    expect(normalizePakistaniPhone("3330000000")).toBe("03330000000");
    expect(normalizePakistaniPhone("3350000000")).toBe("03350000000");
    expect(normalizePakistaniPhone("3010000000")).toBe("03010000000");
    expect(normalizePakistaniPhone("0333-000-0000")).toBe("03330000000");
    expect(normalizePakistaniPhone("+92 (333) 000-0000")).toBe("03330000000");
    expect(normalizePakistaniPhone("92 335 000 0000")).toBe("03350000000");
    expect(normalizePakistaniPhone("03440000001")).toBe("03440000001");
    expect(normalizePakistaniPhone("335000000")).toBeUndefined();
    expect(normalizePakistaniPhone("0215550000")).toBeUndefined();
    expect(normalizePakistaniPhone("03ABC123456")).toBeUndefined();
  });

  it("flags invalid imported phones and preserves them for correction without treating them as output", () => {
    const headers = ["Name", "Cell #", "Address"];
    const [order] = normalizeRows(headers, [["Synthetic Receiver", "335963244", "Synthetic Street"]], detectMapping(headers), true);
    expect(order.phone).toBe("335963244");
    expect(normalizePakistaniPhone(order.phone)).toBeUndefined();
    expect(order.warnings).toContain("Contact number is invalid; enter a Pakistani mobile number with 11 digits.");
  });

  it("preserves phone values as text and never invents order IDs", () => {
    const headers = ["Sr. no", "Name", "Cell #", "Address", "Facebook Name", "COD", "Product"];
    const mapping = detectMapping(headers);
    const [order] = normalizeRows(headers, [["1", "Sample", "03330000000", "Main Street", "FB-person", "1250", "Seeds"]], mapping, true);
    expect(order.phone).toBe("03330000000");
    expect(order.orderId).toBe("");
    expect(order.tracking).toBe("");
    expect(order.warnings).toContain("Order ID is missing; none was generated.");
    expect(order.warnings).toContain("Tracking number is missing; barcode cannot be generated.");
    const [numericPhone] = normalizeRows(headers, [["2", "Sample", 3001234567, "Main Street", "", "", "Seeds"]], mapping, false);
    expect(numericPhone.phone).toBe("03001234567");
    expect(numericPhone.warnings).toContain("Phone cell was numeric; verify leading zeros against the original source.");
  });

  it("imports a real synthetic XLSX workbook and preserves textual leading zeros", async () => {
    const xml = (value: string) => new TextEncoder().encode(value);
    const files = {
      "[Content_Types].xml": xml('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      "_rels/.rels": xml('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      "xl/workbook.xml": xml('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Orders" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
      "xl/styles.xml": xml('<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="00000000000"/></numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>'),
      "xl/worksheets/sheet1.xml": xml('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Order ID</t></is></c><c r="B1" t="inlineStr"><is><t>Name</t></is></c><c r="C1" t="inlineStr"><is><t>Cell #</t></is></c><c r="D1" t="inlineStr"><is><t>Address</t></is></c><c r="E1" t="inlineStr"><is><t>Tracking Number</t></is></c><c r="F1" t="inlineStr"><is><t>COD</t></is></c><c r="G1" t="inlineStr"><is><t>Product</t></is></c><c r="H1" t="inlineStr"><is><t>City</t></is></c><c r="I1" t="inlineStr"><is><t>Province</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>GS-SYN-001</t></is></c><c r="B2" t="inlineStr"><is><t>Synthetic Receiver</t></is></c><c r="C2" s="1"><v>3330000000</v></c><c r="D2" t="inlineStr"><is><t>Test Street 1</t></is></c><c r="E2" t="inlineStr"><is><t>TRACK-SYN-0001</t></is></c><c r="F2"><v>1250</v></c><c r="G2" t="inlineStr"><is><t>Seed Mix</t></is></c><c r="H2" t="inlineStr"><is><t>Sahiwal</t></is></c><c r="I2" t="inlineStr"><is><t>Punjab</t></is></c></row></sheetData></worksheet>'),
    };
    const workbook = Buffer.from(zipSync(files));
    const matrix = await readXlsxSheet(workbook);
    restoreZeroFormattedCells(new Uint8Array(workbook), matrix);
    const headers = (matrix.shift() ?? []).map((cell) => String(cell ?? ""));
    const orderRows = normalizeRows(headers, matrix, detectMapping(headers));
    expect(orderRows).toHaveLength(1);
    expect(orderRows[0].phone).toBe("03330000000");
    expect(orderRows[0].warnings).not.toContain("Phone cell was numeric; verify leading zeros against the original source.");
    expect(orderRows[0].tracking).toBe("TRACK-SYN-0001");
    expect(orderRows[0].cod).toBe("1250");
    expect(orderRows[0].city).toBe("Sahiwal");
    expect(orderRows[0].province).toBe("Punjab");
  });

  it("uses Facebook Name as tracking only after explicit mapping", () => {
    const headers = ["Name", "Cell #", "Address", "Facebook Name"];
    const mapping = detectMapping(headers);
    const [withoutSelection] = normalizeRows(headers, [["Sample", "03330000000", "Main Street", "track-abc"]], mapping, true);
    expect(withoutSelection.tracking).toBe("");
    mapping.tracking = "Facebook Name";
    const [withSelection] = normalizeRows(headers, [["Sample", "03330000000", "Main Street", "track-abc"]], mapping, true);
    expect(withSelection.tracking).toBe("track-abc");
  });

  it("requires explicit selection when source headers are ambiguous", () => {
    const headers = ["Name", "Customer Name", "Cell #", "Address"];
    expect(findAmbiguousMappings(headers)).toEqual([{ key: "name", label: "Name", headers: ["Name", "Customer Name"] }]);
    expect(detectMapping(headers).name).toBe("");
  });

  it("marks duplicate phone and tracking without removing rows", () => {
    const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product"];
    const mapping = detectMapping(headers);
    const imported = normalizeRows(headers, Array.from({ length: 19 }, (_, index) => [`ORD-${index}`, `Person ${index}`, index % 2 ? "03000000001" : "03000000002", `Street ${index}`, "TRACK-REPEAT", String(index * 100), `Product ${index}`]), mapping, true);
    expect(imported).toHaveLength(19);
    expect(imported.every((row) => row.warnings.includes("Duplicate tracking number."))).toBe(true);
  });

  it.each([18, 19, 100, 500])("accounts for all %i synthetic import rows", (count) => {
    const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark"];
    const mapping = detectMapping(headers);
    const fixture = Array.from({ length: count }, (_, index) => [index % 3 ? `TEST-${index + 1}` : "", `Synthetic ${index + 1}`, index % 29 ? `0300${String(index).padStart(7, "0")}` : "", `Long road ${index}, house ${index + 1}`, `TRACK-${index + 1}`, String((index % 9) * 125), `Product ${index % 6}`, "Sahiwal", "Punjab", "Near landmark"]);
    const imported = normalizeRows(headers, fixture, mapping, true);
    expect(imported).toHaveLength(count);
    expect(imported.map((row) => row.rowNumber)).toEqual(Array.from({ length: count }, (_, index) => index + 2));
    expect(imported.filter((row) => row.orderId).length + imported.filter((row) => !row.orderId).length).toBe(count);
    expect(imported.filter((row) => row.warnings.includes("Contact number is missing.")).length).toBeGreaterThan(0);
  });

  it("paginates 18, 19, 100, 500 and variable sheet starts", () => {
    expect(pagesForCount(18)).toBe(1);
    expect(pagesForCount(19)).toBe(2);
    expect(pagesForCount(100)).toBe(6);
    expect(pagesForCount(500)).toBe(28);
    expect(pagesForCount(18, 18)).toBe(2);
    expect(labelBox(0)).toMatchObject({ page: 1, slot: 0, x: 6.5, y: 14 });
    expect(labelBox(2)).toMatchObject({ x: 138.5, y: 14 });
    expect(labelBox(17)).toMatchObject({ page: 1, slot: 17, x: 138.5, y: 239 });
    expect(A4_LABEL_COLUMNS_MM).toEqual([6.5, 72.5, 138.5]);
    expect(A4_LABEL_ROWS_MM).toEqual([14, 59, 104, 149, 194, 239]);
    expect(LABELS_PER_PAGE).toBe(18);
    expect(A4).toEqual({ width: 210, height: 297 });
    expect(LABEL_WIDTH_MM).toBe(65);
    expect(LABEL_HEIGHT_MM).toBe(44);
    expect(A4_POINTS.width).toBeCloseTo(595.2756, 3);
    expect(A4_POINTS.height).toBeCloseTo(841.8898, 3);
  });

  it("escapes spreadsheet formula prefixes", () => {
    expect(safeCsvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(safeCsvCell("Garden Shop")).toBe('"Garden Shop"');
  });

  it("wraps long addresses without truncating source text and flags illegible overflow", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 5 }) } as CanvasRenderingContext2D;
    const text = "A very long synthetic delivery address ".repeat(12);
    const fitted = fitText(ctx, text, 100, 10, { maxFont: 8, minFont: 5 });
    expect(fitted.fits).toBe(false);
    expect(fitted.lines.join(" ")).toContain("address");
    expect(fitted.lines.join(" ").length).toBeGreaterThan(100);
  });

  it("keeps single-line fields intact while fitting them to width", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 4 }) } as CanvasRenderingContext2D;
    const fitted = fitText(ctx, "VPL 1250/-", 42, 20, { maxFont: 20, minFont: 13, noWrap: true });
    expect(fitted.fits).toBe(true);
    expect(fitted.lines).toEqual(["VPL 1250/-"]);
    expect(fitted.fontSize).toBeLessThan(20);
  });

  it("creates PDF pages with exact A4 media dimensions", async () => {
    const pdf = await PDFDocument.create();
    const page = addA4Page(pdf);
    expect(page.getSize().width).toBeCloseTo(595.2756, 3);
    expect(page.getSize().height).toBeCloseTo(841.8898, 3);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("keeps every shared design block inside the exact label box", () => {
    const boxes = labelBoxes();
    expect(LABEL_FOOTER).toBe("From: Garden Shop | C/o City Post Office, Sahiwal");
    expect(LABEL_LAYOUT.widthMm).toBe(65);
    expect(LABEL_LAYOUT.heightMm).toBe(44);
    expect(boxes.orderId.x).toBeLessThan(boxes.product.x);
    expect(boxes.to).toMatchObject({ x: 1.3, y: 10.8, width: 62.4, height: 22.6 });
    expect(boxes.trackingCaption).toMatchObject({ x: 1.7, y: 0.6, width: 30.5, height: 1.7 });
    expect(boxes.barcode).toMatchObject({ x: 1.7, y: 5.4, width: 30.5, height: 4.7 });
    expect(boxes.vpl).toMatchObject({ x: 49, y: 1.1, width: 14.2, height: 7.8 });
    expect(boxes.tracking.y).toBeLessThan(boxes.barcode.y);
    expect(boxes.destination.x).toBeGreaterThan(boxes.barcode.x);
    for (const box of Object.values(boxes)) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(LABEL_WIDTH_MM);
      expect(box.y + box.height).toBeLessThanOrEqual(LABEL_HEIGHT_MM);
    }
  });

  it("formats the VPL capsule and expands a receiver name only when needed", () => {
    expect(formatVpl("550")).toBe("VPL 550/-");
    expect(formatVpl("Rs 1,250/-")).toBe("VPL 1,250/-");
    expect(formatVpl("VPL COD Rs 550")).toBe("VPL 550/-");
    expect(formatVpl("")).toBe("VPL AMOUNT NEEDED");
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 9 }) } as CanvasRenderingContext2D;
    const boxes = recipientBoxes(ctx, "A long synthetic receiver name that wraps");
    expect(boxes.name.height).toBeGreaterThan(LABEL_LAYOUT.name.height);
    expect(boxes.address.y).toBeGreaterThan(boxes.name.y + boxes.name.height);
    expect(boxes.address.y + boxes.address.height).toBeCloseTo(25.1);
  });

  it("rebalances the destination city and province rows for long names", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 9 }) } as CanvasRenderingContext2D;
    const provinceLong = destinationBoxes(ctx, "Nowshera", "Khyber Pakhtunkhwa (KPK)");
    expect(provinceLong.city.height).toBeLessThan(LABEL_LAYOUT.city.height);
    expect(provinceLong.province.height).toBeGreaterThan(LABEL_LAYOUT.province.height);
    expect(provinceLong.province.y + provinceLong.province.height).toBeCloseTo(9.7);
    const cityLong = destinationBoxes(ctx, "A long destination city", "Punjab");
    expect(cityLong.city.height).toBeGreaterThan(LABEL_LAYOUT.city.height);
    expect(cityLong.province.height).toBeLessThan(LABEL_LAYOUT.province.height);
  });
});
