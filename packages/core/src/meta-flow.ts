export type MetaFlowEnvelope = {
  health_check?: unknown;
  encrypted_flow_data?: unknown;
  encrypted_aes_key?: unknown;
  initial_vector?: unknown;
};

export type MetaFlowPayload = Record<string, unknown>;

export type DecryptedMetaFlowRequest = {
  payload: MetaFlowPayload;
  aesKey: CryptoKey;
  initialVector: Uint8Array;
};

function decodeBase64(value: string, field: string): Uint8Array {
  if (!value || value.length > 1_000_000) throw new Error(`FLOW_${field}_INVALID`);
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new Error(`FLOW_${field}_INVALID`);
  }
}

function encodeBase64(bytes: ArrayBuffer | Uint8Array): string {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary);
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  if (!body || body.length > 20_000) throw new Error("FLOW_PRIVATE_KEY_INVALID");
  return decodeBase64(body, "PRIVATE_KEY").slice().buffer as ArrayBuffer;
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", pemToDer(privateKeyPem), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

function objectPayload(value: unknown): MetaFlowPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("FLOW_DATA_INVALID");
  return value as MetaFlowPayload;
}

export async function decryptMetaFlowRequest(envelope: MetaFlowEnvelope, privateKeyPem: string): Promise<DecryptedMetaFlowRequest> {
  if (!privateKeyPem) throw new Error("FLOW_PRIVATE_KEY_NOT_CONFIGURED");
  if (typeof envelope.encrypted_flow_data !== "string" || typeof envelope.encrypted_aes_key !== "string" || typeof envelope.initial_vector !== "string") throw new Error("FLOW_ENVELOPE_INVALID");
  const initialVector = decodeBase64(envelope.initial_vector, "INITIAL_VECTOR");
  if (initialVector.byteLength !== 12) throw new Error("FLOW_INITIAL_VECTOR_INVALID");
  const privateKey = await importPrivateKey(privateKeyPem);
  const aesBytes = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, decodeBase64(envelope.encrypted_aes_key, "AES_KEY")));
  if (aesBytes.byteLength !== 16) throw new Error("FLOW_AES_KEY_INVALID");
  const aesKey = await crypto.subtle.importKey("raw", aesBytes, { name: "AES-GCM" }, false, ["decrypt", "encrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: initialVector, tagLength: 128 }, aesKey, decodeBase64(envelope.encrypted_flow_data, "FLOW_DATA"));
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("FLOW_DATA_INVALID");
  }
  return { payload: objectPayload(payload), aesKey, initialVector };
}

export async function encryptMetaFlowResponse(payload: MetaFlowPayload, aesKey: CryptoKey, initialVector: Uint8Array): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: initialVector, tagLength: 128 }, aesKey, plaintext);
  return encodeBase64(encrypted);
}
