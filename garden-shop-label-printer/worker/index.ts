type Env = {
  LABEL_AUDIT_DB: D1Database;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUDIENCE: string;
  APP_ORIGIN: string;
  STAFF_EMAILS: string;
  SUPER_ADMIN_EMAILS: string;
  AUDIT_ACTOR_KEY: string;
  AUDIT_CHAIN_KEY: string;
};

type Claims = { iss?: string; aud?: string | string[]; email?: string; exp?: number; nbf?: number; sub?: string };
type Actor = { hash: string; role: "STAFF" | "SUPER_ADMIN" };
const EVENT_TYPES = new Set(["FILE_PROCESSED", "LABELS_GENERATED", "PDF_GENERATED", "PRINT_REQUESTED", "PRINT_CONFIRMED", "REPRINT_REQUESTED", "APP_ERROR"]);
const COUNT_KEYS = new Set(["rows", "labels", "warnings", "failed", "pages"]);
let certCache: { expiresAt: number; keys: JsonWebKey[] } | undefined;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Frame-Options": "DENY" } });
}

function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
}

async function accessClaims(request: Request, env: Env): Promise<Claims | null> {
  const token = request.headers.get("cf-access-jwt-assertion") ?? "";
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUDIENCE || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1]))) as Claims;
    const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid || claims.iss !== `https://${team}` || !claims.email || !Number.isFinite(claims.exp) || Number(claims.exp) <= now || (Number.isFinite(claims.nbf) && Number(claims.nbf) > now) || !audiences.includes(env.ACCESS_AUDIENCE)) return null;
    if (!certCache || certCache.expiresAt <= Date.now()) {
      const response = await fetch(`https://${team}/cdn-cgi/access/certs`, { cache: "no-store" });
      if (!response.ok) return null;
      const body = await response.json() as { keys?: JsonWebKey[] };
      if (!Array.isArray(body.keys)) return null;
      certCache = { expiresAt: Date.now() + 5 * 60_000, keys: body.keys };
    }
    const key = certCache.keys.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid && candidate.kty === "RSA");
    if (!key) return null;
    const publicKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signature = decode(parts[2]).slice().buffer as ArrayBuffer;
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`)) ? claims : null;
  } catch { return null; }
}

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function actorFor(request: Request, env: Env): Promise<Actor | null> {
  const claims = await accessClaims(request, env);
  if (!claims?.email || !env.AUDIT_ACTOR_KEY) return null;
  const email = claims.email.toLowerCase();
  const admins = env.SUPER_ADMIN_EMAILS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const staff = env.STAFF_EMAILS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const role = admins.includes(email) ? "SUPER_ADMIN" : staff.includes(email) ? "STAFF" : null;
  return role ? { hash: await hmac(env.AUDIT_ACTOR_KEY, email), role } : null;
}

function canonical(payload: Record<string, unknown>): string {
  return JSON.stringify({ id: payload.id, actorHash: payload.actorHash, role: payload.role, eventType: payload.eventType, batchId: payload.batchId, templateVersion: payload.templateVersion, counts: payload.counts, errorCode: payload.errorCode ?? null, createdAt: payload.createdAt, previousHash: payload.previousHash });
}

async function appendEvent(db: D1Database, env: Env, actor: Actor, event: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const tail = await db.prepare("SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1").first<{ event_hash: string }>();
    const data: Record<string, unknown> = { id: crypto.randomUUID(), actorHash: actor.hash, role: actor.role, ...event, createdAt: new Date().toISOString(), previousHash: tail?.event_hash ?? "GENESIS" };
    const eventHash = await hmac(env.AUDIT_CHAIN_KEY, canonical(data));
    const result = await db.prepare("INSERT INTO audit_events(id,actor_hash,role,event_type,batch_id,template_version,counts_json,error_code,created_at,previous_hash,event_hash) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1),'GENESIS')=?")
      .bind(data.id, data.actorHash, data.role, data.eventType, data.batchId, data.templateVersion, JSON.stringify(data.counts), data.errorCode ?? null, data.createdAt, data.previousHash, eventHash, data.previousHash).run();
    if (result.meta.changes === 1) return;
  }
  throw new Error("AUDIT_CHAIN_CONTENTION");
}

export async function verifyChain(db: D1Database, env: Env): Promise<string> {
  const result = await db.prepare("SELECT id,actor_hash,role,event_type,batch_id,template_version,counts_json,error_code,created_at,previous_hash,event_hash FROM audit_events ORDER BY sequence LIMIT 10001").all<Record<string, string>>();
  if ((result.results ?? []).length > 10000) return "CHECK_REQUIRED_OVER_10000_EVENTS";
  let previousHash = "GENESIS";
  for (const row of result.results ?? []) {
    if (row.previous_hash !== previousHash) return "FAILED";
    const canonicalPayload = {
      id: row.id, actorHash: row.actor_hash, role: row.role, eventType: row.event_type, batchId: row.batch_id,
      templateVersion: row.template_version, counts: JSON.parse(row.counts_json), errorCode: row.error_code, createdAt: row.created_at, previousHash: row.previous_hash,
    };
    const expected = await hmac(env.AUDIT_CHAIN_KEY, canonical(canonicalPayload));
    if (expected !== row.event_hash) return "FAILED";
    previousHash = row.event_hash;
  }
  return "VERIFIED";
}

async function reports(db: D1Database, env: Env) {
  const now = new Date();
  const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7))).toISOString();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const totals = await db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN created_at>=? AND event_type='LABELS_GENERATED' THEN json_extract(counts_json,'$.labels') ELSE 0 END),0) today,
    COALESCE(SUM(CASE WHEN created_at>=? AND event_type='LABELS_GENERATED' THEN json_extract(counts_json,'$.labels') ELSE 0 END),0) week,
    COALESCE(SUM(CASE WHEN created_at>=? AND event_type='LABELS_GENERATED' THEN json_extract(counts_json,'$.labels') ELSE 0 END),0) month,
    SUM(CASE WHEN event_type='PRINT_REQUESTED' THEN 1 ELSE 0 END) printRequests,
    SUM(CASE WHEN event_type='PRINT_CONFIRMED' THEN 1 ELSE 0 END) printConfirmed,
    SUM(CASE WHEN event_type='REPRINT_REQUESTED' THEN 1 ELSE 0 END) reprints
    FROM audit_events WHERE created_at>=?`).bind(startDay, monday, startMonth, startMonth).first<Record<string, number>>();
  const recent = await db.prepare("SELECT actor_hash actor,event_type eventType,batch_id batchId,template_version templateVersion,counts_json counts,created_at createdAt,error_code errorCode FROM audit_events ORDER BY sequence DESC LIMIT 100").all<Record<string, string>>();
  const staff = await db.prepare(`SELECT actor_hash actor,COALESCE(SUM(CASE WHEN event_type='LABELS_GENERATED' THEN json_extract(counts_json,'$.labels') ELSE 0 END),0) labels,
    COUNT(DISTINCT CASE WHEN event_type='FILE_PROCESSED' THEN batch_id END) batches,
    SUM(CASE WHEN event_type='PRINT_REQUESTED' THEN 1 ELSE 0 END) printRequests
    FROM audit_events WHERE created_at>=? GROUP BY actor_hash ORDER BY labels DESC LIMIT 100`).bind(startMonth).all<Record<string, number | string>>();
  const errors = await db.prepare("SELECT COUNT(*) total FROM audit_events WHERE created_at>=? AND (event_type='APP_ERROR' OR COALESCE(json_extract(counts_json,'$.failed'),0)>0)").bind(startMonth).first<{ total: number }>();
  return { today: totals?.today ?? 0, week: totals?.week ?? 0, month: totals?.month ?? 0, printRequests: totals?.printRequests ?? 0, printConfirmed: totals?.printConfirmed ?? 0, reprints: totals?.reprints ?? 0, errors: errors?.total ?? 0, auditIntegrity: await verifyChain(db, env), recent: (recent.results ?? []).map((row) => ({ ...row, counts: JSON.parse(row.counts) })), staff: staff.results ?? [] };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const send = async (): Promise<Response> => {
      if (!env.LABEL_AUDIT_DB || !env.AUDIT_CHAIN_KEY || !env.ACCESS_AUDIENCE || !env.APP_ORIGIN) return json({ error: "MONITORING_NOT_CONFIGURED" }, 503);
      if (origin && origin !== env.APP_ORIGIN) return json({ error: "ORIGIN_INVALID" }, 403);
      if (request.method === "OPTIONS") {
        if (origin !== env.APP_ORIGIN) return json({ error: "ORIGIN_INVALID" }, 403);
        return new Response(null, { status: 204 });
      }
      if (request.method === "GET" && url.pathname === "/api/health") return json({ status: "ready" });
      const actor = await actorFor(request, env);
      if (!actor) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
      if (request.method === "POST" && url.pathname === "/api/events") {
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > 2048) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 2048) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
      let body: Record<string, unknown>;
      try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { return json({ error: "JSON_INVALID" }, 400); }
      const allowed = new Set(["eventType", "batchId", "templateVersion", "counts", "errorCode"]);
      if (Object.keys(body).some((key) => !allowed.has(key)) || typeof body.eventType !== "string" || !EVENT_TYPES.has(body.eventType) || typeof body.batchId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.batchId) || body.templateVersion !== "gfs-a4-18-v2" || !body.counts || typeof body.counts !== "object" || Array.isArray(body.counts)) return json({ error: "EVENT_SCHEMA_INVALID" }, 400);
      const counts = body.counts as Record<string, unknown>;
      if (Object.keys(counts).some((key) => !COUNT_KEYS.has(key)) || Object.values(counts).some((n) => !Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 100000)) return json({ error: "EVENT_COUNTS_INVALID" }, 400);
      if (body.errorCode !== undefined && (typeof body.errorCode !== "string" || !/^[A-Z0-9_]{1,64}$/.test(body.errorCode))) return json({ error: "ERROR_CODE_INVALID" }, 400);
      const recentEvents = await env.LABEL_AUDIT_DB.prepare("SELECT COUNT(*) total FROM audit_events WHERE actor_hash=? AND created_at>=?").bind(actor.hash, new Date(Date.now() - 60_000).toISOString()).first<{ total: number }>();
      if (Number(recentEvents?.total ?? 0) >= 120) return json({ error: "EVENT_RATE_LIMITED" }, 429);
      try { await appendEvent(env.LABEL_AUDIT_DB, env, actor, { eventType: body.eventType, batchId: body.batchId, templateVersion: body.templateVersion, counts, errorCode: body.errorCode }); return json({ ok: true }, 201); }
      catch { return json({ error: "AUDIT_WRITE_FAILED" }, 503); }
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/reports/")) {
        if (actor.role !== "SUPER_ADMIN") return json({ error: "SUPER_ADMIN_REQUIRED" }, 403);
        if (url.pathname === "/api/reports/summary") {
          try { return json(await reports(env.LABEL_AUDIT_DB, env)); } catch { return json({ error: "REPORT_UNAVAILABLE" }, 503); }
        }
        if (url.pathname === "/api/reports/audit.csv") {
        const rows = await env.LABEL_AUDIT_DB.prepare("SELECT created_at,event_type,actor_hash,role,batch_id,template_version,counts_json,error_code,previous_hash,event_hash FROM audit_events ORDER BY sequence").all<Record<string, string>>();
        const csv = ["created_at,event_type,actor,role,batch_id,template_version,counts,error_code,previous_hash,event_hash", ...(rows.results ?? []).map((row) => [row.created_at, row.event_type, row.actor_hash, row.role, row.batch_id, row.template_version, row.counts_json, row.error_code, row.previous_hash, row.event_hash].map((field) => `"${String(field ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
        return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=label-printer-audit.csv", "Cache-Control": "no-store" } });
        }
      }
      return json({ error: "NOT_FOUND" }, 404);
    };
    const response = await send();
    const responseHeaders = new Headers(response.headers);
    if (origin === env.APP_ORIGIN) {
      responseHeaders.set("Access-Control-Allow-Origin", env.APP_ORIGIN);
      responseHeaders.set("Access-Control-Allow-Credentials", "true");
      responseHeaders.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");
      responseHeaders.append("Vary", "Origin");
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  },
};
