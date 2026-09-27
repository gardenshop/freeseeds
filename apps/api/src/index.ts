import { Hono } from "hono";
import { createWhatsAppProvider, parseFlowSubmission, persistFlowSubmission } from "@gfs/core";

type Env = {
  Bindings: {
    DB: D1Database;
    RECEIPTS: R2Bucket;
    EVENTS: Queue;
    DEPLOYMENT_STATE: string;
    WHATSAPP_PROVIDER: string;
    META_PROVIDER_ENABLED: string;
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
  const provider = createWhatsAppProvider("meta");
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

app.all("*", (c) => c.json({ error: "NOT_FOUND" }, 404));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ kind: string; orderId?: string }>, env: Env["Bindings"]): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (!env.DB) { message.ack(); continue; }
        await env.DB.prepare("UPDATE outbox_jobs SET status = 'PROCESSING', attempts = attempts + 1, updated_at = ? WHERE idempotency_key = ? AND status IN ('PENDING','RETRY')").bind(new Date().toISOString(), message.body.orderId ?? "").run();
        message.ack();
      } catch {
        message.retry({ delaySeconds: Math.min(3600, 30 * 2 ** message.attempts) });
      }
    }
  }
};
