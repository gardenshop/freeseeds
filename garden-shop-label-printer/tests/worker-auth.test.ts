import { beforeAll, describe, expect, it, vi } from "vitest";
import worker, { verifyChain } from "../worker/index";

const envBase = {
  ACCESS_TEAM_DOMAIN: "access.example",
  ACCESS_AUDIENCE: "labels-app-aud",
  APP_ORIGIN: "https://labels.example",
  STAFF_EMAILS: "staff@example.test",
  SUPER_ADMIN_EMAILS: "admin@example.test",
  AUDIT_ACTOR_KEY: "synthetic-actor-hmac-key",
  AUDIT_CHAIN_KEY: "synthetic-chain-hmac-key",
};
let privateKey: CryptoKey;
let publicJwk: JsonWebKey;

const encode = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function jwt(email: string) {
  const header = encode(new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: "test-key" })));
  const claims = encode(new TextEncoder().encode(JSON.stringify({ iss: "https://access.example", aud: "labels-app-aud", email, exp: Math.floor(Date.now() / 1000) + 3600 })));
  const input = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(input)));
  return `${input}.${encode(signature)}`;
}

function fakeDb(eventCount = 0, inserted: string[] = []) {
  return {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...args: unknown[]) { bindings = args; return this; },
        async first() { return sql.includes("event_hash FROM audit_events") ? null : sql.includes("COUNT(*) total FROM audit_events WHERE actor_hash") ? { total: eventCount } : { today: 0, week: 0, month: 0, printRequests: 0, printConfirmed: 0, reprints: 0, total: 0 }; },
        async run() { if (sql.startsWith("INSERT INTO audit_events")) inserted.push(String(bindings[3])); return { meta: { changes: 1 } }; },
        async all() { return { results: [] }; },
      };
    },
  } as unknown as D1Database;
}

describe("monitoring Worker authorization", () => {
  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    privateKey = pair.privateKey;
    publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    (publicJwk as JsonWebKey & { kid?: string }).kid = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ keys: [publicJwk] })));
  });

  it("rejects missing authentication and forged identity headers", async () => {
    const env = { ...envBase, LABEL_AUDIT_DB: fakeDb() } as never;
    const missing = await worker.fetch(new Request("https://monitor.example/api/events", { method: "POST", body: "{}" }), env);
    expect(missing.status).toBe(401);
    const forged = await worker.fetch(new Request("https://monitor.example/api/reports/summary", { headers: { "cf-access-authenticated-user-email": "admin@example.test" } }), env);
    expect(forged.status).toBe(401);
    const malformed = await worker.fetch(new Request("https://monitor.example/api/events", { headers: { "cf-access-jwt-assertion": "not.a.valid.jwt" } }), env);
    expect(malformed.status).toBe(401);
  });

  it("rejects signed staff report access and admits staff aggregate events", async () => {
    const env = { ...envBase, LABEL_AUDIT_DB: fakeDb() } as never;
    const staffToken = await jwt("staff@example.test");
    const report = await worker.fetch(new Request("https://monitor.example/api/reports/summary", { headers: { "cf-access-jwt-assertion": staffToken } }), env);
    expect(report.status).toBe(403);
    const event = await worker.fetch(new Request("https://monitor.example/api/events", {
      method: "POST", headers: { "Content-Type": "application/json", "cf-access-jwt-assertion": staffToken, Origin: envBase.APP_ORIGIN },
      body: JSON.stringify({ eventType: "LABELS_GENERATED", batchId: crypto.randomUUID(), templateVersion: "gfs-a4-18-v2", counts: { labels: 19, warnings: 1 } }),
    }), env);
    expect(event.status).toBe(201);
  });

  it("rejects customer data and only grants reports to a verified Super Admin", async () => {
    const env = { ...envBase, LABEL_AUDIT_DB: fakeDb() } as never;
    const adminToken = await jwt("admin@example.test");
    const forgedPayload = await worker.fetch(new Request("https://monitor.example/api/events", {
      method: "POST", headers: { "Content-Type": "application/json", "cf-access-jwt-assertion": adminToken },
      body: JSON.stringify({ eventType: "FILE_PROCESSED", batchId: crypto.randomUUID(), templateVersion: "gfs-a4-18-v2", counts: { rows: 1 }, address: "customer data" }),
    }), env);
    expect(forgedPayload.status).toBe(400);
    const report = await worker.fetch(new Request("https://monitor.example/api/reports/summary", { headers: { "cf-access-jwt-assertion": adminToken } }), env);
    expect(report.status).toBe(200);
    const cors = await worker.fetch(new Request("https://monitor.example/api/events", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } }), env);
    expect(cors.status).toBe(403);
  });

  it("detects a tampered audit-chain event", async () => {
    const db = {
      prepare() { return { async all() { return { results: [{ id: "synthetic-id", actor_hash: "actor", role: "STAFF", event_type: "FILE_PROCESSED", batch_id: "synthetic-batch", template_version: "gfs-a4-18-v1", counts_json: "{}", error_code: null, created_at: "2026-01-01T00:00:00.000Z", previous_hash: "GENESIS", event_hash: "tampered" }] }; } }; },
    } as unknown as D1Database;
    expect(await verifyChain(db, { ...envBase, LABEL_AUDIT_DB: db } as never)).toBe("FAILED");
  });

  it("limits authenticated event submissions per actor", async () => {
    const env = { ...envBase, LABEL_AUDIT_DB: fakeDb(120) } as never;
    const staffToken = await jwt("staff@example.test");
    const response = await worker.fetch(new Request("https://monitor.example/api/events", {
      method: "POST", headers: { "Content-Type": "application/json", "cf-access-jwt-assertion": staffToken },
      body: JSON.stringify({ eventType: "FILE_PROCESSED", batchId: crypto.randomUUID(), templateVersion: "gfs-a4-18-v2", counts: { rows: 1 } }),
    }), env);
    expect(response.status).toBe(429);
  });

  it("appends print request, staff confirmation and reprint as separate events", async () => {
    const inserted: string[] = [];
    const env = { ...envBase, LABEL_AUDIT_DB: fakeDb(0, inserted) } as never;
    const staffToken = await jwt("staff@example.test");
    for (const eventType of ["PRINT_REQUESTED", "PRINT_CONFIRMED", "REPRINT_REQUESTED"]) {
      const response = await worker.fetch(new Request("https://monitor.example/api/events", {
        method: "POST", headers: { "Content-Type": "application/json", "cf-access-jwt-assertion": staffToken },
        body: JSON.stringify({ eventType, batchId: crypto.randomUUID(), templateVersion: "gfs-a4-18-v2", counts: { labels: 1, pages: 1 } }),
      }), env);
      expect(response.status).toBe(201);
    }
    expect(inserted).toEqual(["PRINT_REQUESTED", "PRINT_CONFIRMED", "REPRINT_REQUESTED"]);
  });
});
