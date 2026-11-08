import { describe, expect, it } from "vitest";
import {
  injectLabelPrinterCard,
  labelPrinterUrl,
} from "../apps/admin/src/label-printer";
import adminWorker from "../apps/admin/src/index";

const HOME = '<main><section aria-labelledby="operations-title"><div class="section-title"><h2 id="operations-title">Operations</h2><span>Authorized modules</span></div><div class="modules"><a class="module" href="/orders"><strong>Orders</strong></a></div></section></main>';
const LIVE_ADMIN_OPERATIONS = '<main><section aria-labelledby="operations-title"><div class="section-title"><h2 id="operations-title">Operations</h2><span>Authorized modules</span></div><div class="modules"><a class="module" href="/orders"><strong>Orders &amp; Fulfillment</strong></a><a class="module" href="/payment-reminders"><strong>Payment Reminders</strong></a><a class="module" href="/cod-settings"><strong>COD Settings</strong></a><a class="module" href="/meta-activation"><strong>Meta Activation</strong></a></div></section></main>';

describe("Admin Labels & Printing integration", () => {
  it("adds the exact module card only inside Operations when configured", () => {
    const destination = labelPrinterUrl("https://garden-shop-label-printer-staging.pages.dev");
    const html = injectLabelPrinterCard(HOME, destination);
    expect(html).toContain('href="/labels-printing"');
    expect(html).toContain("Labels &amp; Printing");
    expect(html).toContain("Upload Excel, generate shipping labels, print A4 sheets and monitor printing activity.");
    expect(html.indexOf('data-label-printer="true"')).toBeGreaterThan(html.indexOf('aria-labelledby="operations-title"'));
    expect(injectLabelPrinterCard(html, destination)).toBe(html);
  });

  it("keeps the tile hidden until a valid dedicated HTTPS Pages URL is configured", () => {
    expect(labelPrinterUrl(undefined)).toBeNull();
    expect(labelPrinterUrl("http://garden-shop-label-printer-staging.pages.dev")).toBeNull();
    expect(labelPrinterUrl("https://attacker.example")).toBeNull();
    expect(labelPrinterUrl("https://garden-shop-label-printer-staging.pages.dev/?x=1")).toBeNull();
    expect(injectLabelPrinterCard(HOME, null)).toBe(HOME);
  });

  it("adds the module to the observed active Admin Operations markup without replacing existing modules", () => {
    const html = injectLabelPrinterCard(LIVE_ADMIN_OPERATIONS, labelPrinterUrl("https://garden-shop-label-printer-staging.pages.dev"));
    expect(html).toContain('href="/orders"');
    expect(html).toContain('href="/payment-reminders"');
    expect(html).toContain('href="/cod-settings"');
    expect(html).toContain('href="/meta-activation"');
    expect(html).toContain('href="/labels-printing"');
  });

  it("serves the authorized Admin card and a protected no-token redirect route", async () => {
    const env = {
      DEPLOYMENT_STATE: "PRODUCTION_INTEGRATION_READY",
      ADMIN_EMAIL: "super-admin@example.test",
    };
    const context = { waitUntil() {}, passThroughOnException() {}, props: {} };
    const home = await adminWorker.fetch(
      new Request("https://admin.example/", {
        headers: { "cf-access-authenticated-user-email": "super-admin@example.test" },
      }),
      env as never,
      context as never,
    );
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('href="/labels-printing"');

    const denied = await adminWorker.fetch(
      new Request("https://admin.example/labels-printing"),
      env as never,
      context as never,
    );
    expect(denied.status).toBe(403);

    const redirect = await adminWorker.fetch(
      new Request("https://admin.example/labels-printing", {
        headers: { "cf-access-authenticated-user-email": "super-admin@example.test" },
      }),
      env as never,
      context as never,
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://garden-shop-label-printer-staging.pages.dev/");
    expect(redirect.headers.get("location")).not.toContain("?");
  });
});
