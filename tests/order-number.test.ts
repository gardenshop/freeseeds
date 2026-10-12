import { describe, expect, it } from "vitest";
import { ORDER_NUMBER_ALLOCATION_SQL, OrderCooldownError, allocateOrderNumber, karachiOrderDate, nextOrderNumber, persistFlowSubmission, persistInstantFormSubmission } from "@gfs/core";

function sequenceDatabase() {
  const sequences = new Map<string, number>();
  const queries: string[] = [];
  const db = {
    prepare: (query: string) => {
      queries.push(query);
      const statement = {
        bind: (...args: unknown[]) => {
          const bound = {
            first: async () => {
              const orderDate = String(args[0]);
              const next = sequences.get(orderDate) ?? 1;
              if (next > 999999) return undefined;
              sequences.set(orderDate, next + 1);
              return { sequence: next };
            }
          };
          return bound;
        }
      };
      return statement;
    }
  } as unknown as D1Database;
  return { db, queries };
}

function replayDatabase() {
  const requests = new Map<string, { customerId: string; leadId: string; orderId: string; orderNumber: string }>();
  const locks = new Map<string, { orderId: string; orderNumber: string | null; lastOrderAt: string }>();
  let sequence = 1;
  let allocationCount = 0;
  let batchCount = 0;
  const db = {
    prepare: (sql: string) => {
      const first = async (args: unknown[]) => {
        if (sql.includes("FROM order_requests")) {
          const existing = requests.get(String(args[0]));
          return existing ? { lead_id: existing.leadId, order_id: existing.orderId, customer_id: existing.customerId, order_number: existing.orderNumber } : undefined;
        }
        if (sql.includes("FROM lead_sources")) return undefined;
        if (sql.includes("payment_configuration")) return { advance_amount_pkr: null };
        if (sql.startsWith("INSERT INTO order_eligibility_locks")) {
          const key = String(args[0]), now = String(args[2]), threshold = String(args[3]);
          const current = locks.get(key);
          if (current && current.lastOrderAt > threshold) return undefined;
          locks.set(key, { orderId: String(args[1]), orderNumber: null, lastOrderAt: now });
          return { order_id: String(args[1]) };
        }
        if (sql.includes("FROM order_eligibility_locks")) {
          const current = locks.get(String(args[0]));
          return current ? { order_number: current.orderNumber, last_order_at: current.lastOrderAt } : undefined;
        }
        if (sql.includes("order_number_sequences")) {
          allocationCount += 1;
          return { sequence: sequence++ };
        }
        return undefined;
      };
      const statement = {
        first: () => first([]),
        bind: (...args: unknown[]) => {
          const bound = {
            sql,
            args,
            first: () => first(args)
          };
          return bound;
        }
      };
      return statement;
    },
    batch: async (statements: Array<{ sql: string; args: unknown[] }>) => {
      batchCount += 1;
      const request = statements.find((statement) => statement.sql.includes("INSERT INTO order_requests"));
      const order = statements.find((statement) => statement.sql.includes("INSERT INTO orders"));
      const customer = statements.find((statement) => statement.sql.includes("INSERT INTO customers"));
      const lead = statements.find((statement) => statement.sql.includes("INSERT INTO leads"));
      const lockUpdate = statements.find((statement) => statement.sql.startsWith("UPDATE order_eligibility_locks SET order_number"));
      if (lockUpdate) {
        const current = locks.get(String(lockUpdate.args[1]));
        if (current) locks.set(String(lockUpdate.args[1]), { ...current, orderNumber: String(lockUpdate.args[0]) });
      }
      if (request && order && customer && lead) {
        requests.set(String(request.args[0]), {
          customerId: String(customer.args[0]),
          leadId: String(lead.args[0]),
          orderId: String(order.args[0]),
          orderNumber: String(order.args[1])
        });
      }
      return [];
    }
  } as unknown as D1Database;
  return { db, allocationCount: () => allocationCount, batchCount: () => batchCount };
}

describe("GFS-104 order number allocation", () => {
  it("formats new order IDs with a Karachi date and six-digit sequence", () => {
    const date = new Date("2026-10-12T12:00:00.000Z");
    expect(nextOrderNumber(date, 1)).toBe("FS-261012-000001");
    expect(nextOrderNumber(date, 999999)).toBe("FS-261012-999999");
    expect(() => nextOrderNumber(date, 0)).toThrow("ORDER_SEQUENCE_EXHAUSTED");
    expect(() => nextOrderNumber(date, 1000000)).toThrow("ORDER_SEQUENCE_EXHAUSTED");
  });

  it("uses the Asia/Karachi calendar at the UTC date boundary", () => {
    expect(karachiOrderDate(new Date("2026-10-12T18:59:59.999Z"))).toBe("20261012");
    expect(karachiOrderDate(new Date("2026-10-12T19:00:00.000Z"))).toBe("20261013");
  });

  it("allocates unique same-day sequences through one atomic D1 upsert", async () => {
    const { db, queries } = sequenceDatabase();
    const now = new Date("2026-10-12T12:00:00.000Z");
    const orderNumbers = await Promise.all(Array.from({ length: 20 }, () => allocateOrderNumber(db, now)));
    expect(new Set(orderNumbers).size).toBe(20);
    expect(orderNumbers).toEqual(Array.from({ length: 20 }, (_, index) => `FS-261012-${String(index + 1).padStart(6, "0")}`));
    expect(queries).toHaveLength(20);
    expect(ORDER_NUMBER_ALLOCATION_SQL).toContain("ON CONFLICT(order_date) DO UPDATE");
    expect(ORDER_NUMBER_ALLOCATION_SQL).toContain("RETURNING next_sequence - 1 AS sequence");
  });

  it("starts each Karachi date at sequence one", async () => {
    const { db } = sequenceDatabase();
    await expect(allocateOrderNumber(db, new Date("2026-10-12T18:59:59.999Z"))).resolves.toBe("FS-261012-000001");
    await expect(allocateOrderNumber(db, new Date("2026-10-12T19:00:00.000Z"))).resolves.toBe("FS-261013-000001");
  });

  it("returns the original order for Instant Form, Meta Flow, and WhatsApp replays", async () => {
    const { db, allocationCount, batchCount } = replayDatabase();
    const instantSubmission = {
      leadId: "synthetic-lead-104",
      formId: "synthetic-form-104",
      pageId: "synthetic-page-104",
      createdTime: "2026-10-12T12:00:00.000Z",
      fullName: "Synthetic Customer",
      deliveryAddress: "1 Test Street",
      nearbyPlace: "Test Park",
      city: "Sahiwal",
      contactNumber: "+923001234567"
    };
    const flowSubmission = { fullName: "Synthetic Customer", deliveryAddress: "2 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "+923001234567" };
    const whatsappSubmission = { ...flowSubmission, deliveryAddress: "3 Test Street" };
    const instant = await persistInstantFormSubmission(db, instantSubmission);
    const flow = await persistFlowSubmission(db, flowSubmission, undefined, "META_FLOW:synthetic-flow-104");
    const whatsapp = await persistFlowSubmission(db, whatsappSubmission, undefined, "WHATSAPP:synthetic-message-104");
    const instantReplay = await persistInstantFormSubmission(db, instantSubmission);
    const flowReplay = await persistFlowSubmission(db, flowSubmission, undefined, "META_FLOW:synthetic-flow-104");
    const whatsappReplay = await persistFlowSubmission(db, whatsappSubmission, undefined, "WHATSAPP:synthetic-message-104");
    for (const [first, replay] of [[instant, instantReplay], [flow, flowReplay], [whatsapp, whatsappReplay]]) {
      expect(first.duplicate).toBe(false);
      expect(replay).toMatchObject({ duplicate: true, orderId: first.orderId, orderNumber: first.orderNumber });
    }
    expect(allocationCount()).toBe(3);
    expect(batchCount()).toBe(3);
  });

  it("blocks a second cross-channel household order during the cooldown", async () => {
    const { db } = replayDatabase();
    const submission = { fullName: "Synthetic Customer", deliveryAddress: "9 Cooldown Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "+923001234567" };
    await persistFlowSubmission(db, submission, undefined, "WHATSAPP:first");
    await expect(persistFlowSubmission(db, submission, undefined, "META_FLOW:second")).rejects.toBeInstanceOf(OrderCooldownError);
  });

  it("exempts only the verified E2E wa_id while preserving replay idempotency", async () => {
    const { db } = replayDatabase();
    const submission = { fullName: "Synthetic Customer", deliveryAddress: "10 Test Street", nearbyPlace: "Test Park", city: "Sahiwal", contactNumber: "+923001234567" };
    const first = await persistFlowSubmission(db, submission, undefined, "WHATSAPP:test-one", "923034901810");
    const second = await persistFlowSubmission(db, submission, undefined, "WHATSAPP:test-two", "923034901810");
    const replay = await persistFlowSubmission(db, submission, undefined, "WHATSAPP:test-two", "923034901810");
    expect(second.orderId).not.toBe(first.orderId);
    expect(replay).toMatchObject({ duplicate: true, orderId: second.orderId });
  });
});
