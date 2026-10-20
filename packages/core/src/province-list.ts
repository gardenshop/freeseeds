export type ProvinceDeliveryRow = { province: string; delivery_fee_pkr: number };

export function provinceDeliveryListRows(rows: ProvinceDeliveryRow[], locale: "en" | "ur"): Array<{ id: string; title: string; description: string }> {
  if (rows.length > 10) throw new Error("PROVINCE_LIST_ROW_LIMIT_EXCEEDED");
  return rows.map((row) => {
    const title = row.province.trim();
    if (!title || title.length > 24) throw new Error("PROVINCE_LIST_TITLE_INVALID");
    if (!Number.isSafeInteger(row.delivery_fee_pkr) || row.delivery_fee_pkr < 0) throw new Error("PROVINCE_DELIVERY_FEE_INVALID");
    const description = locale === "ur"
      ? `ڈلیوری فیس: ${row.delivery_fee_pkr.toLocaleString("en-PK")} روپے`
      : `Delivery Fee: Rs. ${row.delivery_fee_pkr.toLocaleString("en-PK")}`;
    if (description.length > 72) throw new Error("PROVINCE_LIST_DESCRIPTION_INVALID");
    return { id: `PROVINCE_${title.toUpperCase().replace(/ /g, "_")}`, title, description };
  });
}
