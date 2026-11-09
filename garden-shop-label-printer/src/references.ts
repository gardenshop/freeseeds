export const LABEL_REFERENCE_NOTICE = "References are collision-checked and saved in this browser profile only. Offline use cannot guarantee cross-device uniqueness; keep this site's data for reprints.";

export type LabelReferenceRecord = {
  reference: string;
  sourceKey: string;
  sourceOrderId: string;
  trackingNumber: string;
  createdAt: string;
};

type ReferenceClaim = (candidate: string) => Promise<string | undefined>;
type Uint32Source = () => number;

const DB_NAME = "gfs-label-references-v1";
const STORE_NAME = "references";
const MAX_COLLISION_ATTEMPTS = 128;
let database: Promise<IDBDatabase> | undefined;

export function labelReferenceSourceKey(orderId: string, tracking: string): string {
  return JSON.stringify([orderId.trim(), tracking.trim().toUpperCase()]);
}

function secureRandomWord(): number {
  if (!globalThis.crypto?.getRandomValues) throw new Error("SECURE_RANDOM_UNAVAILABLE");
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

export function makeLabelReference(date = new Date(), nextRandomWord: Uint32Source = secureRandomWord): string {
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / 100_000) * 100_000;
  let value = nextRandomWord();
  while (!Number.isInteger(value) || value < 0 || value >= range || value >= limit) value = nextRandomWord();
  const yearMonth = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `FS-${yearMonth}-${String(value % 100_000).padStart(5, "0")}`;
}

export async function reserveUniqueReference(
  date: Date,
  nextRandomWord: Uint32Source,
  claim: ReferenceClaim,
  maxAttempts = MAX_COLLISION_ATTEMPTS,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = makeLabelReference(date, nextRandomWord);
    const reservation = await claim(candidate);
    if (reservation) return reservation;
  }
  throw new Error("REFERENCE_COLLISION_LIMIT");
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error("REFERENCE_STORAGE_UNAVAILABLE"));
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "reference" });
        store.createIndex("sourceKey", "sourceKey", { unique: true });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(request.error ?? new Error("REFERENCE_STORAGE_OPEN_FAILED"));
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("REFERENCE_STORAGE_BLOCKED"));
      };
    });
  }
  return database;
}

function readBySourceKey(db: IDBDatabase, sourceKey: string): Promise<LabelReferenceRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).index("sourceKey").get(sourceKey);
    request.onsuccess = () => resolve(request.result as LabelReferenceRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("REFERENCE_LOOKUP_FAILED"));
    tx.onabort = () => reject(tx.error ?? new Error("REFERENCE_LOOKUP_ABORTED"));
  });
}

function addMapping(db: IDBDatabase, record: LabelReferenceRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    let settled = false;
    const request = tx.objectStore(STORE_NAME).add(record);
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("REFERENCE_RESERVATION_FAILED"));
      }
    };
    tx.oncomplete = () => {
      if (!settled) { settled = true; resolve(); }
    };
    tx.onerror = () => {
      if (!settled) { settled = true; reject(tx.error ?? new Error("REFERENCE_RESERVATION_FAILED")); }
    };
    tx.onabort = () => {
      if (!settled) { settled = true; reject(tx.error ?? new Error("REFERENCE_RESERVATION_ABORTED")); }
    };
  });
}

export async function reserveLabelReference(
  orderId: string,
  tracking: string,
  date = new Date(),
  nextRandomWord: Uint32Source = secureRandomWord,
): Promise<string> {
  const sourceOrderId = orderId.trim();
  const trackingNumber = tracking.trim();
  if (!sourceOrderId || !trackingNumber) throw new Error("REFERENCE_SOURCE_REQUIRED");
  const sourceKey = labelReferenceSourceKey(sourceOrderId, trackingNumber);
  const db = await openDatabase();
  const existing = await readBySourceKey(db, sourceKey);
  if (existing) return existing.reference;
  return reserveUniqueReference(date, nextRandomWord, async (candidate) => {
    try {
      await addMapping(db, { reference: candidate, sourceKey, sourceOrderId, trackingNumber, createdAt: date.toISOString() });
      return candidate;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "ConstraintError") throw error;
      return (await readBySourceKey(db, sourceKey))?.reference;
    }
  });
}

export async function updateLabelReferenceSource(reference: string, orderId: string, tracking: string): Promise<void> {
  const sourceOrderId = orderId.trim();
  const trackingNumber = tracking.trim();
  if (!sourceOrderId || !trackingNumber) throw new Error("REFERENCE_SOURCE_REQUIRED");
  const sourceKey = labelReferenceSourceKey(sourceOrderId, trackingNumber);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
      try { tx.abort(); } catch { /* Transaction may already have finished. */ }
    };
    const currentRequest = store.get(reference);
    currentRequest.onerror = () => fail(currentRequest.error ?? new Error("REFERENCE_LOOKUP_FAILED"));
    currentRequest.onsuccess = () => {
      const current = currentRequest.result as LabelReferenceRecord | undefined;
      if (!current) return fail(new Error("REFERENCE_MAPPING_MISSING"));
      const duplicateRequest = store.index("sourceKey").get(sourceKey);
      duplicateRequest.onerror = () => fail(duplicateRequest.error ?? new Error("REFERENCE_LOOKUP_FAILED"));
      duplicateRequest.onsuccess = () => {
        const duplicate = duplicateRequest.result as LabelReferenceRecord | undefined;
        if (duplicate && duplicate.reference !== reference) return fail(new Error("REFERENCE_SOURCE_COLLISION"));
        store.put({ ...current, sourceKey, sourceOrderId, trackingNumber });
      };
    };
    tx.oncomplete = () => {
      if (!settled) { settled = true; resolve(); }
    };
    tx.onerror = () => fail(tx.error ?? new Error("REFERENCE_UPDATE_FAILED"));
    tx.onabort = () => fail(tx.error ?? new Error("REFERENCE_UPDATE_ABORTED"));
  });
}
