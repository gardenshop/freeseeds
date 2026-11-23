import {
  correctMoPartyPositions,
  hasLegacyMoPartyPositions,
  validateMoLayout,
  type MoDataSource,
  type MoLayout,
  type MoLayoutField,
} from "./layout";

type Geometry = Readonly<Pick<MoLayoutField, "xMm" | "yMm" | "widthMm" | "heightMm" | "wrap">>;

export type MoLayoutRepairChange = Readonly<{
  fieldId: string;
  source: MoDataSource;
  before: Geometry;
  after: Geometry;
}>;

export type MoLayoutRepairUnresolved = Readonly<{
  fieldId: string;
  source: MoDataSource;
  message: string;
}>;

export type MoLayoutRepairPlan = Readonly<{
  layout: MoLayout;
  changes: readonly MoLayoutRepairChange[];
  unresolved: readonly MoLayoutRepairUnresolved[];
  legacyPartyPositionsCorrected: boolean;
}>;

type Profile = Readonly<{ xMm: number; yMm: number; widthMm: number; heightMm: number; wrap: boolean }>;

const frontProfiles: Partial<Record<MoDataSource, Profile>> = Object.freeze({
  tracking: { xMm: 103, yMm: 45, widthMm: 36, heightMm: 4.8, wrap: false },
  manualArticleNumber: { xMm: 103, yMm: 45, widthMm: 36, heightMm: 4.8, wrap: false },
  declaredPrincipal: { xMm: 18, yMm: 50, widthMm: 35, heightMm: 5, wrap: false },
  manualPrincipal: { xMm: 18, yMm: 50, widthMm: 35, heightMm: 5, wrap: false },
  orderDate: { xMm: 95.99, yMm: 37.07, widthMm: 43.34, heightMm: 4.8, wrap: false },
  name: { xMm: 7.65, yMm: 85.78, widthMm: 100.72, heightMm: 4.8, wrap: false },
  manualReceiverName: { xMm: 7.65, yMm: 85.78, widthMm: 100.72, heightMm: 4.8, wrap: false },
  address: { xMm: 7.65, yMm: 90.58, widthMm: 65, heightMm: 14.4, wrap: true },
  sourceAddress: { xMm: 7.65, yMm: 90.58, widthMm: 65, heightMm: 14.4, wrap: true },
  manualReceiverAddress: { xMm: 7.65, yMm: 90.58, widthMm: 65, heightMm: 14.4, wrap: true },
  phone: { xMm: 78.65, yMm: 90.58, widthMm: 29.72, heightMm: 4.8, wrap: false },
  manualReceiverPhone: { xMm: 78.65, yMm: 90.58, widthMm: 29.72, heightMm: 4.8, wrap: false },
  city: { xMm: 78.65, yMm: 95.38, widthMm: 29.72, heightMm: 4.8, wrap: true },
  province: { xMm: 78.65, yMm: 100.18, widthMm: 30.8, heightMm: 4.8, wrap: false },
  senderName: { xMm: 7.65, yMm: 112.8, widthMm: 100.72, heightMm: 4.8, wrap: false },
  manualSenderName: { xMm: 7.65, yMm: 112.8, widthMm: 100.72, heightMm: 4.8, wrap: false },
  senderAddress: { xMm: 7.65, yMm: 117.6, widthMm: 100.72, heightMm: 4.8, wrap: false },
  manualSenderAddress: { xMm: 7.65, yMm: 117.6, widthMm: 100.72, heightMm: 4.8, wrap: false },
  manualSenderPhone: { xMm: 78.65, yMm: 117.6, widthMm: 29.72, heightMm: 4.8, wrap: false },
});

const intimationProfiles: Partial<Record<MoDataSource, Profile>> = Object.freeze({
  declaredPrincipal: { xMm: 39.22, yMm: 152.44, widthMm: 41.13, heightMm: 4.8, wrap: false },
  manualPrincipal: { xMm: 39.22, yMm: 152.44, widthMm: 41.13, heightMm: 4.8, wrap: false },
  tracking: { xMm: 39.22, yMm: 174.67, widthMm: 89.61, heightMm: 4.8, wrap: false },
  manualArticleNumber: { xMm: 39.22, yMm: 174.67, widthMm: 89.61, heightMm: 4.8, wrap: false },
  orderDate: { xMm: 83.09, yMm: 169.2, widthMm: 43.01, heightMm: 4.8, wrap: false },
  name: { xMm: 39.22, yMm: 180.14, widthMm: 94.94, heightMm: 4.8, wrap: false },
  manualReceiverName: { xMm: 39.22, yMm: 180.14, widthMm: 94.94, heightMm: 4.8, wrap: false },
});

const duplicateGroups: readonly (readonly MoDataSource[])[] = [
  ["tracking", "manualArticleNumber", "articleType"],
  ["declaredPrincipal", "manualPrincipal", "sourceAmount"],
  ["name", "manualReceiverName"],
  ["address", "sourceAddress", "manualReceiverAddress"],
  ["phone", "manualReceiverPhone"],
  ["senderName", "manualSenderName"],
  ["senderAddress", "manualSenderAddress"],
];

function duplicateGroup(source: MoDataSource): readonly MoDataSource[] | undefined {
  return duplicateGroups.find((group) => group.includes(source));
}

function sameGeometry(left: MoLayoutField, right: Geometry): boolean {
  return left.xMm === right.xMm && left.yMm === right.yMm && left.widthMm === right.widthMm && left.heightMm === right.heightMm && left.wrap === right.wrap;
}

/** Build a non-persisted, source-preserving proposal. Ambiguous/intimation fields remain untouched and are reported. */
export function proposeMoLayoutRepair(layout: MoLayout): MoLayoutRepairPlan {
  const legacyPartyPositionsCorrected = hasLegacyMoPartyPositions(layout);
  const originalFields = new Map(layout.fields.map((field) => [field.id, field] as const));
  let base = layout;
  if (legacyPartyPositionsCorrected) base = correctMoPartyPositions(layout);

  const changes: MoLayoutRepairChange[] = [];
  const unresolved: MoLayoutRepairUnresolved[] = [];
  const hasFrontSenderPhone = base.fields.some((field) => field.face === "front" && field.source === "manualSenderPhone" && field.yMm < 145);

  const fields = base.fields.map((field) => {
    if (field.source === "senderCnic") return field;
    if (field.face !== "front") {
      unresolved.push(Object.freeze({ fieldId: field.id, source: field.source, message: "No approved automatic repair profile exists for Section 2; keep this custom position and adjust it directly." }));
      return field;
    }

    const group = duplicateGroup(field.source);
    const inIntimation = field.yMm >= 145;
    const duplicateTargets = group ? base.fields.filter((candidate) => candidate.face === field.face && (candidate.yMm >= 145) === inIntimation && group.includes(candidate.source)) : [];
    if (duplicateTargets.length > 1) {
      unresolved.push(Object.freeze({ fieldId: field.id, source: field.source, message: "Multiple mapped fields target the same printed role; no field was moved automatically. Remove or reposition the duplicate directly." }));
      return field;
    }

    const baseProfile = (inIntimation ? intimationProfiles : frontProfiles)[field.source];
    const profile = !inIntimation && hasFrontSenderPhone && (field.source === "senderAddress" || field.source === "manualSenderAddress") && baseProfile
      ? Object.freeze({ ...baseProfile, widthMm: 70 })
      : baseProfile;
    if (!profile) {
      const message = inIntimation
        ? "No approved Intimation-line mapping exists for this source; its saved position is preserved for direct adjustment."
        : field.source === "sourceAmount"
          ? "Imported amount text can include commission; bind only the validated declared principal or keep this field blank."
          : "No approved printable line is defined for this source; its saved position is preserved for direct adjustment.";
      unresolved.push(Object.freeze({ fieldId: field.id, source: field.source, message }));
      return field;
    }

    const after = Object.freeze({ xMm: profile.xMm, yMm: profile.yMm, widthMm: profile.widthMm, heightMm: profile.heightMm, wrap: profile.wrap });
    const original = originalFields.get(field.id) ?? field;
    if (!sameGeometry(original, after)) changes.push(Object.freeze({ fieldId: field.id, source: field.source, before: Object.freeze({ xMm: original.xMm, yMm: original.yMm, widthMm: original.widthMm, heightMm: original.heightMm, wrap: original.wrap }), after }));
    return Object.freeze({ ...field, ...after });
  });

  const proposed = validateMoLayout({ ...base, version: 2, partyPositionVersion: 2, fields });
  return Object.freeze({ layout: proposed, changes: Object.freeze(changes), unresolved: Object.freeze(unresolved), legacyPartyPositionsCorrected });
}
