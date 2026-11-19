import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { readSheet as readXlsxSheet } from "read-excel-file/node";
import { A4, A4_LABEL_COLUMNS_MM, A4_LABEL_ROWS_MM, A4_POINTS, addA4Page, detectMapping, findAmbiguousMappings, fitText, getPaperPreset, labelBox, LABEL_HEIGHT_MM, LABELS_PER_PAGE, LABEL_WIDTH_MM, normalizeAddressText, normalizePakistaniPhone, normalizeRows, pagePoints, pagesForCount, parseCsv, safeContactRemoval, safeCsvCell } from "../src/engine";
import { fitCommissionExpression, HP_P2055_SAFE_EDGE_MM, LABEL_FOOTER, LABEL_LAYOUT, destinationBoxes, formatVpl, labelBoxes, labelContentTransform, recipientBoxes, transformLabelContentBox, transformLabelContentPoint } from "../src/layout";
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

  it("normalizes common English address terms but preserves names and Urdu source text", () => {
    expect(normalizeAddressText("house 12\r\nMAIN RoAd, sector 4, McDonald Estate"))
      .toBe("House 12 Main Road, Sector 4, McDonald Estate");
    expect(normalizeAddressText("گلی نمبر ایک، HOUSE 12"))
      .toBe("گلی نمبر ایک، House 12");
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
    expect(order.warnings).toContain("Source Order ID is missing; the printed reference is local-only.");
    expect(order.warnings).toContain("Tracking number is missing; barcode cannot be generated.");
    const [numericPhone] = normalizeRows(headers, [["2", "Sample", 3001234567, "Main Street", "", "", "Seeds"]], mapping, false);
    expect(numericPhone.phone).toBe("03001234567");
    expect(numericPhone.warnings).toContain("Phone cell was numeric; verify leading zeros against the original source.");
  });

  it("maps the GFS 18-11 workbook header shape without using workbook data", () => {
    const headers = ["Order Reference/ID", "Order Date", "Customer Name", "Full Delivery Address", "Nearby Landmark", "City", "Contact Number", "Province", "Product", "COD", "Tracking", "Sender", "S.Address"];
    expect(detectMapping(headers)).toMatchObject({
      orderId: "Order Reference/ID",
      orderDate: "Order Date",
      name: "Customer Name",
      address: "Full Delivery Address",
      landmark: "Nearby Landmark",
      phone: "Contact Number",
      city: "City",
      province: "Province",
      product: "Product",
      cod: "COD",
      tracking: "Tracking",
      senderName: "Sender",
      senderAddress: "S.Address",
    });
  });

  it("formats numeric Excel dates for the MO-51 Month Stamp without changing CSV text", () => {
    const headers = ["Order Date"];
    const serialFor = (year: number, month: number, day: number, epoch: number) => (Date.UTC(year, month - 1, day) - epoch) / 86_400_000;
    const serial1900 = serialFor(2026, 11, 18, Date.UTC(1899, 11, 30));
    const serial1904 = serialFor(2026, 11, 18, Date.UTC(1904, 0, 1));
    expect(normalizeRows(headers, [[serial1900]], detectMapping(headers), false, false)[0].orderDate).toBe("18-11-26");
    expect(normalizeRows(headers, [[serial1904]], detectMapping(headers), false, true)[0].orderDate).toBe("18-11-26");
    expect(normalizeRows(headers, [[0]], detectMapping(headers), false, false)[0].orderDate).toBe("0");
    expect(normalizeRows(headers, [[0]], detectMapping(headers), false, true)[0].orderDate).toBe("01-01-04");
    expect(normalizeRows(headers, [["2026/11/18"]], detectMapping(headers), true)[0].orderDate).toBe("2026/11/18");
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
    expect(restoreZeroFormattedCells(new Uint8Array(workbook), matrix)).toBe(false);
    const headers = (matrix.shift() ?? []).map((cell) => String(cell ?? ""));
    const orderRows = normalizeRows(headers, matrix, detectMapping(headers));
    expect(orderRows).toHaveLength(1);
    expect(orderRows[0].phone).toBe("03330000000");
    expect(orderRows[0].warnings).not.toContain("Phone cell was numeric; verify leading zeros against the original source.");
    expect(orderRows[0].tracking).toBe("TRACK-SYN-0001");
    expect(orderRows[0].cod).toBe("1250");
    expect(orderRows[0].city).toBe("Sahiwal");
    expect(orderRows[0].province).toBe("Punjab");
    const date1904Xml = new TextDecoder().decode(files["xl/workbook.xml"]).replace("<sheets>", '<workbookPr date1904="1"/><sheets>');
    const date1904Workbook = Buffer.from(zipSync({ ...files, "xl/workbook.xml": xml(date1904Xml) }));
    expect(restoreZeroFormattedCells(new Uint8Array(date1904Workbook), [])).toBe(true);
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

  it.each([18, 19, 55, 100, 500])("accounts for all %i synthetic import rows", (count) => {
    const headers = ["Order ID", "Name", "Cell #", "Address", "Tracking Number", "COD", "Product", "City", "Province", "Nearby Landmark"];
    const mapping = detectMapping(headers);
    const fixture = Array.from({ length: count }, (_, index) => [index % 3 ? `TEST-${index + 1}` : "", `Synthetic ${index + 1}`, index % 29 ? `0300${String(index).padStart(7, "0")}` : "", `Long road ${index}, house ${index + 1}`, `TRACK-${index + 1}`, String((index % 9) * 125), `Product ${index % 6}`, "Sahiwal", "Punjab", "Near landmark"]);
    const imported = normalizeRows(headers, fixture, mapping, true);
    expect(imported).toHaveLength(count);
    expect(imported.map((row) => row.rowNumber)).toEqual(Array.from({ length: count }, (_, index) => index + 2));
    expect(imported.filter((row) => row.orderId).length + imported.filter((row) => !row.orderId).length).toBe(count);
    expect(imported.filter((row) => row.warnings.includes("Contact number is missing.")).length).toBeGreaterThan(0);
  });

  it("paginates 18, 19, 55, 100, 500 and variable sheet starts", () => {
    expect(pagesForCount(18)).toBe(1);
    expect(pagesForCount(19)).toBe(2);
    expect(pagesForCount(55)).toBe(4);
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
    expect(boxes.trackingText).toMatchObject({ x: 1.7, y: 0.8, width: 31.5, height: 2.0 });
    expect(boxes.barcode).toMatchObject({ x: 1.7, y: 3.0, width: 31.5, height: 8.4 });
    expect(boxes.vpl).toMatchObject({ x: 44.4, y: 0.5, width: 19.4, height: 7.0 });
    expect(boxes.destination).toMatchObject({ x: 34.7, y: 7.7, width: 29, height: 6.8 });
    expect(boxes.city.y).toBeGreaterThanOrEqual(boxes.vpl.y + boxes.vpl.height);
    expect(boxes.orderProduct).toMatchObject({ x: 1.3, y: 14.8, width: 62.4, height: 4.7 });
    expect(boxes.orderId.y).toBe(boxes.contact.y);
    expect(boxes.contactDivider.x).toBeGreaterThan(boxes.orderId.x);
    expect(boxes.product.y).toBeCloseTo(boxes.to.y + boxes.to.height + 0.3);
    expect(boxes.footer.y).toBeCloseTo(boxes.product.y + boxes.product.height + 0.2);
    expect(boxes.to).toMatchObject({ x: 1.3, y: 19.8, width: 62.4, height: 15.8 });
    expect(boxes.nearbyLabel.y - (boxes.address.y + boxes.address.height)).toBeLessThanOrEqual(0.5);
    expect(boxes.nearbyLabel.y).toBeGreaterThanOrEqual(boxes.address.y + boxes.address.height);
    for (const box of Object.values(boxes)) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(LABEL_WIDTH_MM);
      expect(box.y + box.height).toBeLessThanOrEqual(LABEL_HEIGHT_MM);
    }
  });

  it("applies the HP safe area only to sheet-edge labels", () => {
    const preset = getPaperPreset("CUSTOM");
    const allBoxes = labelBoxes(preset);
    const boxes = Object.entries(allBoxes).filter(([name]) => name !== "outline" && name !== "barcode").map(([, box]) => box);
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    const horizontalInset = HP_P2055_SAFE_EDGE_MM - preset.columnStartsMm[0]!;
    const verticalInset = HP_P2055_SAFE_EDGE_MM - preset.rowStartsMm[0]!;
    const first = labelContentTransform(preset, 0);
    expect(first.offsetX).toBeCloseTo(horizontalInset, 10);
    expect(first.offsetY).toBeCloseTo(verticalInset, 10);
    expect(first.scaleX).toBeCloseTo((preset.labelWidthMm - horizontalInset) / maxX, 10);
    expect(first.scaleY).toBeCloseTo((preset.labelHeightMm - verticalInset) / maxY, 10);
    expect(labelContentTransform(preset, 1).scaleX).toBe(1);
    expect(labelContentTransform(preset, 1).offsetX).toBe(0);
    expect(labelContentTransform(preset, 1).scaleY).toBe(first.scaleY);
    expect(labelContentTransform(preset, 2).scaleX).toBeLessThan(1);
    expect(labelContentTransform(preset, 2).scaleY).toBe(first.scaleY);
    expect(labelContentTransform(preset, 7)).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });
    expect(labelContentTransform(preset, 15).scaleX).toBeLessThan(1);
    expect(labelContentTransform(preset, 15).scaleY).toBeCloseTo((254 - HP_P2055_SAFE_EDGE_MM - preset.rowStartsMm[5]!) / maxY, 10);
    expect(labelContentTransform(preset, 0, false)).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });
    expect(labelContentTransform(getPaperPreset("A4"), 0)).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });

    for (let slot = 0; slot < 18; slot += 1) {
      const column = slot % 3;
      const row = Math.floor(slot / 3);
      const transform = labelContentTransform(preset, slot);
      const pageX = preset.columnStartsMm[column]!;
      const pageY = preset.rowStartsMm[row]!;
      const physicalCell = labelBox(slot, 1, preset);
      expect(physicalCell).toMatchObject({ page: 1, slot, x: pageX, y: pageY });
      for (const box of boxes) {
        const mapped = transformLabelContentBox(box, transform);
        expect(mapped.x).toBeGreaterThanOrEqual(-0.001);
        expect(mapped.y).toBeGreaterThanOrEqual(-0.001);
        expect(mapped.x + mapped.width).toBeLessThanOrEqual(preset.labelWidthMm + 0.001);
        expect(mapped.y + mapped.height).toBeLessThanOrEqual(preset.labelHeightMm + 0.001);
        expect(pageX + mapped.x).toBeGreaterThanOrEqual(HP_P2055_SAFE_EDGE_MM - 0.001);
        expect(pageY + mapped.y).toBeGreaterThanOrEqual(HP_P2055_SAFE_EDGE_MM - 0.001);
        expect(pageX + mapped.x + mapped.width).toBeLessThanOrEqual(preset.widthMm - HP_P2055_SAFE_EDGE_MM + 0.001);
        expect(pageY + mapped.y + mapped.height).toBeLessThanOrEqual(preset.heightMm - HP_P2055_SAFE_EDGE_MM + 0.001);
      }
      const barcodePosition = transformLabelContentPoint(allBoxes.barcode, transform);
      expect(pageX + barcodePosition.x).toBeGreaterThanOrEqual(HP_P2055_SAFE_EDGE_MM - 0.001);
      expect(pageY + barcodePosition.y).toBeGreaterThanOrEqual(HP_P2055_SAFE_EDGE_MM - 0.001);
      expect(pageX + barcodePosition.x + allBoxes.barcode.width * transform.scaleX).toBeLessThanOrEqual(preset.widthMm - HP_P2055_SAFE_EDGE_MM + 0.001);
      expect(pageY + barcodePosition.y + allBoxes.barcode.height).toBeLessThanOrEqual(preset.heightMm - HP_P2055_SAFE_EDGE_MM + 0.001);
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
    expect(boxes.address.y + boxes.address.height).toBeCloseTo(30.1);
  });

  it("rebalances the destination city and province rows for long names", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 10 }) } as CanvasRenderingContext2D;
    const provinceLong = destinationBoxes(ctx, "Nowshera", "Khyber Pakhtunkhwa (KPK)");
    expect(provinceLong.city.height).toBeLessThanOrEqual(LABEL_LAYOUT.city.height);
    expect(provinceLong.province.height).toBeGreaterThan(LABEL_LAYOUT.province.height);
    expect(provinceLong.province.y + provinceLong.province.height).toBeCloseTo(14.5);
    const cityLong = destinationBoxes(ctx, "A long destination city", "Punjab");
    expect(cityLong.city.height).toBeGreaterThan(LABEL_LAYOUT.city.height);
    expect(cityLong.province.height).toBeLessThan(LABEL_LAYOUT.province.height);
  });

  it("expands the destination into the amount-box area without changing the label geometry", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 2 }) } as CanvasRenderingContext2D;
    const boxes = labelBoxes(getPaperPreset("CUSTOM"));
    const destination = destinationBoxes(ctx, "Sahiwal", "Punjab", getPaperPreset("CUSTOM"), true);
    expect(boxes.vpl.x).toBeCloseTo(44.4 * 63 / 65);
    expect(boxes.vpl.y).toBeCloseTo(0.5 * 42 / 44);
    expect(boxes.vpl.width).toBeCloseTo(19.4 * 63 / 65);
    expect(boxes.vpl.height).toBeCloseTo(7 * 42 / 44);
    expect(destination.container).toMatchObject({ x: boxes.destination.x, y: boxes.vpl.y, width: boxes.destination.width });
    expect(destination.container.height).toBeCloseTo(14 * 42 / 44);
    expect(destination.city.y).toBeLessThan(boxes.destination.y);
    expect(destination.province.y + destination.province.height).toBeCloseTo(14.5 * 42 / 44);
  });

  it("fits a single-line amount/fee pair and keeps the fee subordinate", () => {
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * Number.parseFloat(/([0-9.]+)px/u.exec((ctx as { font: string }).font)?.[1] ?? "10") * 0.55 }) } as CanvasRenderingContext2D;
    const fit = fitCommissionExpression(ctx, "25000", 175, 100, 26);
    expect(fit.fits).toBe(true);
    expect(fit.commissionFontSize).toBeCloseTo(fit.fontSize * 0.3);
  });

  it("defines exact A4 and custom 3x6 paper geometries without changing A4 defaults", async () => {
    const custom = getPaperPreset("CUSTOM");
    expect(getPaperPreset("A4")).toMatchObject({ widthMm: 210, heightMm: 297, labelWidthMm: 65, labelHeightMm: 44, columnGapMm: 1, rowGapMm: 1 });
    expect(custom).toMatchObject({ widthMm: 190.5, heightMm: 254, labelWidthMm: 63, labelHeightMm: 42, columns: 3, rows: 6, columnGapMm: 0.5, rowGapMm: 0.333 });
    expect(custom.columnStartsMm).toEqual([0.25, 63.75, 127.25]);
    expect(custom.rowStartsMm).toEqual([0.1675, 42.5005, 84.8335, 127.1665, 169.4995, 211.8325]);
    expect(labelBox(0, 1, custom)).toMatchObject({ x: 0.25, y: 0.1675 });
    expect(labelBox(17, 1, custom)).toMatchObject({ x: 127.25, y: 211.8325 });
    const customPdf = await PDFDocument.create();
    const customPage = addA4Page(customPdf, custom);
    expect(customPage.getSize().width).toBeCloseTo(190.5 * 72 / 25.4, 6);
    expect(customPage.getSize().height).toBeCloseTo(254 * 72 / 25.4, 6);
    expect(pagePoints()).toEqual(A4_POINTS);
    expect(custom.marginWarning).toContain("0.25 mm side and 0.1675 mm top/bottom margins");
  });

});
