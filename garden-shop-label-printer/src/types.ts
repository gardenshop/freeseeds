export type Order = {
  rowNumber: number;
  serial: string;
  orderId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  sourceAddress: string;
  facebookName: string;
  tracking: string;
  cod: string;
  product: string;
  city: string;
  province: string;
  landmark: string;
  senderName: string;
  senderAddress: string;
  warnings: string[];
};

export type ImportMapping = Record<keyof Omit<Order, "rowNumber" | "sourceAddress" | "warnings">, string>;

export type AuditEvent = {
  eventType: "FILE_PROCESSED" | "LABELS_GENERATED" | "PDF_GENERATED" | "PRINT_REQUESTED" | "PRINT_CONFIRMED" | "REPRINT_REQUESTED" | "APP_ERROR";
  batchId: string;
  templateVersion: string;
  counts: { rows?: number; labels?: number; warnings?: number; failed?: number; pages?: number };
  errorCode?: string;
};

export const FIELDS: Array<{ key: keyof ImportMapping; label: string; aliases: string[]; required: boolean }> = [
  { key: "serial", label: "Sr. no", aliases: ["Sr. no", "Sr no", "Serial no", "S.no"], required: false },
  { key: "orderId", label: "Order ID", aliases: ["Order ID", "Order Number", "Order No"], required: false },
  { key: "name", label: "Name", aliases: ["Name", "Customer Name", "Consignee Name"], required: true },
  { key: "email", label: "consigneeEmail", aliases: ["consigneeEmail", "Email", "Email Address"], required: false },
  { key: "phone", label: "Cell #", aliases: ["Cell #", "Cell", "Phone", "Contact Number", "Mobile"], required: true },
  { key: "address", label: "Address", aliases: ["Address", "Delivery Address"], required: true },
  { key: "facebookName", label: "Facebook Name", aliases: ["Facebook Name"], required: false },
  { key: "tracking", label: "Tracking Number", aliases: ["Tracking Number", "Tracking", "Consignment Number"], required: false },
  { key: "cod", label: "COD / VPL COD", aliases: ["COD", "VPL COD", "COD Amount"], required: false },
  { key: "product", label: "Product", aliases: ["Product", "Products", "Item"], required: false },
  { key: "city", label: "City", aliases: ["City", "Destination City"], required: false },
  { key: "province", label: "Province", aliases: ["Province", "State"], required: false },
  { key: "landmark", label: "Near by", aliases: ["Nearby Landmark", "Near by", "Landmark", "Nearby Famous Place"], required: false },
  { key: "senderName", label: "Sender Name", aliases: ["Sender Name"], required: false },
  { key: "senderAddress", label: "Sender Address", aliases: ["Sender Address"], required: false },
];

export const EMPTY_ORDER = (): Order => ({
  rowNumber: 0, serial: "", orderId: "", name: "", email: "", phone: "", address: "", sourceAddress: "", facebookName: "", tracking: "", cod: "", product: "", city: "", province: "", landmark: "", senderName: "Garden Shop", senderAddress: "C/o City Post Office, Sahiwal", warnings: [],
});
