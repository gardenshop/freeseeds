import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaCapiProvider, createPurchaseEvent } from "@gfs/core";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local Meta CAPI Purchase provider contract", () => {
  it("sends one synthetic Purchase payload with stable identity and WhatsApp attribution", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ events_received: 1, fbtrace_id: "synthetic-trace" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MetaCapiProvider({ enabled: true, graphVersion: "v26.0", datasetId: "synthetic-dataset", accessToken: "synthetic-token" });
    const event = createPurchaseEvent("SIM-GFS431-DO-NOT-SHIP", 325, { ctwaClid: "synthetic-ctwa" });

    await expect(provider.send(event)).resolves.toEqual({ responseId: "synthetic-trace" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/synthetic-dataset/events");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer synthetic-token");
    const payload = JSON.parse(String(init.body)) as { data: Array<Record<string, unknown>> };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      event_name: "Purchase",
      event_id: "purchase_SIM-GFS431-DO-NOT-SHIP",
      action_source: "business_messaging",
      messaging_channel: "whatsapp",
      custom_data: { currency: "PKR", value: 325 },
      user_data: { ctwa_clid: "synthetic-ctwa" }
    });
    expect(payload.data[0].event_time).toEqual(expect.any(Number));
    expect(Number(payload.data[0].event_time)).toBeGreaterThan(0);
  });

  it("fails closed when Meta does not accept the event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ events_received: 0 }), { status: 200 })));
    const provider = new MetaCapiProvider({ enabled: true, graphVersion: "v26.0", datasetId: "synthetic-dataset", accessToken: "synthetic-token" });

    await expect(provider.send(createPurchaseEvent("SIM-GFS431-REJECTED", 325))).rejects.toThrow("META_CAPI_EVENT_NOT_ACCEPTED");
  });
});
