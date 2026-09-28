import { Hono } from "hono";
import { createWhatsAppProvider, isTerminalOutboxStatus, parseFlowSubmission, PaymentMethod, persistFlowSubmission, retryDelaySeconds, selectPaymentMethod, storeReceipt } from "@gfs/core";

type Env = {
  Bindings: {
    DB: D1Database;
    RECEIPTS: R2Bucket;
    EVENTS: Queue;
    DEPLOYMENT_STATE: string;
    WHATSAPP_PROVIDER: string;
    META_PROVIDER_ENABLED: string;
    META_GRAPH_VERSION?: string;
    META_ACCESS_TOKEN?: string;
    WEBHOOK_VERIFY_TOKEN?: string;
    META_APP_SECRET?: string;
  };
};

const app = new Hono<Env>();

app.get("/health", (c) => c.json({ ok: true, service: "getfreeseeds-api", state: c.env.DEPLOYMENT_STATE, whatsapp: "disabled-until-new-number" }));

app.get("/webhooks/whatsapp", (c) => {
  const provider = createWhatsAppProvider(c.env.WHATSAPP_PROVIDER);
  const challenge = provider.verifyWebhook(c.req.query("hub.challenge") ?? "", c.req.query("hub.verify_token") ?? "", c.env.WEBHOOK_VERIFY_TOKEN);
  return challenge === null ? c.text("Forbidden", 403) : c.text(challenge);
});

app.post("/webhooks/whatsapp", async (c) => {
  if (c.env.META_PROVIDER_ENABLED !== "true") return c.json({ error: "WHATSAPP_NUMBER_PENDING", state: c.env.DEPLOYMENT_STATE }, 503);
  const raw = await c.req.arrayBuffer();
  const signature = c.req.header("x-hub-signature-256") ?? null;
  const provider = createWhatsAppProvider("meta", { enabled: true, graphVersion: c.env.META_GRAPH_VERSION ?? "v26.0", accessToken: c.env.META_ACCESS_TOKEN, appSecret: c.env.META_APP_SECRET });
  if (!(await provider.validateSignature(raw, signature, c.env.META_APP_SECRET))) return c.text("Forbidden", 403);
  return c.json({ accepted: true });
});

app.post("/flows/get-free-seeds", async (c) => {
  const body = await c.req.json<{ data?: unknown; action?: string; screen?: string }>();
  try {
    const submission = parseFlowSubmission(body.data ?? body);
    if (!c.env.DB) return c.json({ screen: "SUBMIT", data: { accepted: true, mode: "mock" } });
    const result = await persistFlowSubmission(c.env.DB, submission);
    return c.json({ screen: "SUBMIT", data: { accepted: true, orderNumber: result.orderNumber } });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "INVALID_FLOW_SUBMISSION" }, 400);
  }
});

app.post("/payments/:orderId/select", async (c) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  try {
    const body = await c.req.json<{ method: string }>();
    const result = await selectPaymentMethod(c.env.DB, c.req.param("orderId"), PaymentMethod.parse(body.method.toUpperCase()));
    return c.json({ ok: true, orderNumber: result.orderNumber, amount: result.amount, method: result.config.method, message: result.message, qrAvailable: Boolean(result.config.qrR2Key) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "PAYMENT_METHOD_SELECTION_FAILED" }, 400);
  }
});

app.post("/payments/:orderId/i-have-paid", async (c) => {
  if (!c.env.DB) return c.json({ error: "PAYMENT_CONFIGURATION_UNAVAILABLE" }, 503);
  const payment = await c.env.DB.prepare("SELECT id, review_state FROM payments WHERE order_id=? AND method IS NOT NULL").bind(c.req.param("orderId")).first<{ id: string; review_state: string }>();
  if (!payment) return c.json({ error: "PAYMENT_METHOD_NOT_SELECTED" }, 409);
  if (payment.review_state !== "PENDING") return c.json({ error: "PAYMENT_NOT_AWAITING_RECEIPT" }, 409);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO outbox_jobs (id,idempotency_key,kind,entity_id,payload_json,status,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), `receipt_request_${c.req.param("orderId")}`, "WHATSAPP_RECEIPT_REQUEST", c.req.param("orderId"), JSON.stringify({ orderId: c.req.param("orderId"), paymentId: payment.id }), "PENDING", now, now, now),
    c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "PAYMENT_RECEIPT_REQUESTED", "CUSTOMER", "PAYMENT", payment.id, crypto.randomUUID(), JSON.stringify({ orderId: c.req.param("orderId") }), now)
  ]);
  return c.json({ ok: true, message: "Please share your payment receipt or screenshot here. Payment will be reviewed manually." });
});

app.post("/receipts/ingest", async (c) => {
  const body = await c.req.json<{ orderId: string; paymentId: string; mediaId: string }>();
  if (!c.env.DB || !c.env.RECEIPTS) return c.json({ error: "RECEIPT_STORAGE_UNAVAILABLE" }, 503);
  const record = await c.env.DB.prepare("SELECT o.order_number, o.state, p.id AS payment_id FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=? AND p.id=?").bind(body.orderId, body.paymentId).first<{ order_number: string; state: string; payment_id: string }>();
  if (!record) return c.json({ error: "ORDER_NOT_FOUND" }, 404);
  if (!["PAYMENT_PENDING", "RECEIPT_SUBMITTED", "PAYMENT_REVIEW"].includes(record.state)) return c.json({ error: "ORDER_NOT_ACCEPTING_RECEIPT" }, 409);
  try {
    const media = await createWhatsAppProvider(c.env.WHATSAPP_PROVIDER).downloadMedia(body.mediaId);
    const stored = await storeReceipt(c.env.RECEIPTS, record.order_number, media);
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO payment_receipts (id,payment_id,order_id,provider_media_id,r2_object_key,sha256,mime_type,size_bytes,submitted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), body.paymentId, body.orderId, media.mediaId, stored.objectKey, stored.sha256, media.mimeType, media.size, now, now),
      c.env.DB.prepare("UPDATE payments SET review_state='REVIEW', submitted_at=?, updated_at=? WHERE id=? AND review_state IN ('PENDING','REJECTED')").bind(now, now, body.paymentId),
      c.env.DB.prepare("UPDATE orders SET state='PAYMENT_REVIEW', updated_at=? WHERE id=? AND state IN ('PAYMENT_PENDING','RECEIPT_SUBMITTED')").bind(now, body.orderId),
      c.env.DB.prepare("INSERT INTO audit_log (id,action,actor_type,entity_type,entity_id,correlation_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "RECEIPT_ASSOCIATED", "CUSTOMER", "PAYMENT", body.paymentId, crypto.randomUUID(), JSON.stringify({ orderId: body.orderId, objectKey: stored.objectKey, sha256: stored.sha256 }), now)
    ]);
    return c.json({ ok: true, reviewState: "REVIEW", receiptKey: stored.objectKey });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "RECEIPT_INGEST_FAILED" }, 400);
  }
});

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ kind: string; idempotencyKey: string; entityId: string; schemaVersion: 1 }>, env: Env["Bindings"]): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (!env.DB) { message.ack(); continue; }
        const job = await env.DB.prepare("SELECT status, attempts FROM outbox_jobs WHERE idempotency_key=?").bind(message.body.idempotencyKey).first<{ status: string; attempts: number }>();
        if (!job || isTerminalOutboxStatus(job.status)) { message.ack(); continue; }
        if (env.DEPLOYMENT_STATE === "WHATSAPP_NUMBER_PENDING") {
          await env.DB.prepare("UPDATE outbox_jobs SET status='DEFERRED', last_error=?, updated_at=? WHERE idempotency_key=?").bind("WHATSAPP_NUMBER_PENDING", new Date().toISOString(), message.body.idempotencyKey).run();
          message.ack();
          continue;
        }
        const nextAttempt = Number(job.attempts ?? 0) + 1;
        if (nextAttempt > 5) {
          await env.DB.prepare("UPDATE outbox_jobs SET status='DEAD_LETTER', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, "MAX_RETRIES_EXCEEDED", new Date().toISOString(), message.body.idempotencyKey).run();
          message.ack();
          continue;
        }
        await env.DB.prepare("UPDATE outbox_jobs SET status='RETRY', attempts=?, last_error=?, updated_at=? WHERE idempotency_key=?").bind(nextAttempt, "PROVIDER_NOT_CONFIGURED", new Date().toISOString(), message.body.idempotencyKey).run();
        message.retry({ delaySeconds: retryDelaySeconds(nextAttempt) });
      } catch {
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      }
    }
  }
};
