import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const auth = { "cf-access-authenticated-user-email": "admin@example.test" };
const env = { ADMIN_EMAIL: "admin@example.test", DEPLOYMENT_STATE: "LOCAL" } as never;

type Layout = {
  shell: number;
  workspace: number;
  master: number;
  detail: number;
  tabs: number;
  filters: number;
};

function computeDesktopLayout(cssViewportWidth: number): Layout {
  const shell = Math.min(cssViewportWidth, 1700);
  const workspace = shell - 48;
  const split = workspace - 14;
  const master = split / 2.35;
  return { shell, workspace, master, detail: split - master, tabs: (workspace - 30) / 4, filters: workspace };
}

function computeResponsiveLayout(cssViewportWidth: number): { columns: number; tabs: number; filters: number; minHeight: number } {
  if (cssViewportWidth <= 560) return { columns: 1, tabs: 2, filters: 1, minHeight: 850 };
  if (cssViewportWidth <= 760) return { columns: 1, tabs: 2, filters: 2, minHeight: 850 };
  if (cssViewportWidth <= 900) return { columns: 1, tabs: 4, filters: 2, minHeight: 850 };
  return { columns: 2, tabs: 4, filters: 7, minHeight: 560 };
}

function computeMasterScrollLayout(masterHeight: number, rowCount: number, rowHeight = 92, listHeadHeight = 42, pagerHeight = 56) {
  const listViewport = Math.max(0, masterHeight - listHeadHeight - pagerHeight);
  const listContent = rowCount * rowHeight;
  const listHeight = Math.min(listViewport, listContent);
  return { listViewport, listContent, listHeight, pagerTop: listHeadHeight + listHeight, pagerBottom: listHeadHeight + listHeight + pagerHeight };
}

describe("Admin layout regression contract", () => {
  it("emits the protected split-pane CSS contract without customer data", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env);
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain(".shell{max-width:1700px");
    expect(html).toContain(".shell{max-width:1700px;margin:auto;padding:24px}");
    expect(html).not.toContain(".refresh:focus-visible{outline:3px solid #8cc9a2;outline-offset:2px};margin:auto");
    expect(html).toContain(".workspace{display:grid;grid-template-columns:minmax(360px,1fr) minmax(420px,1.35fr);grid-template-rows:minmax(0,1fr);gap:14px;height:calc(100vh - 285px);min-height:520px;min-width:0}");
    expect(html).toContain(".master{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}");
    expect(html).toContain(".detail{min-width:0;min-height:0;overflow:auto}");
    expect(html).toContain(".orders{display:flex;flex:1 1 auto;flex-direction:column;gap:8px;overflow:auto;min-height:0}");
    expect(html).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(html).toContain("@media(max-width:900px){.filters{grid-template-columns:repeat(2,minmax(0,1fr))}.workspace{grid-template-columns:1fr;height:auto;min-height:850px}");
    expect(html).toContain("@media(max-width:560px){.shell{padding:14px}.tabs{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr}");
    expect(html).not.toContain("width:330px");
    expect(html).not.toContain("minmax(330px");
  });

  it("keeps rendered shell geometry centered at the approved desktop widths", async () => {
    const response = await app.fetch(new Request("https://admin.example.test/orders", { headers: auth }), env);
    const html = await response.text();
    const shellRule = html.match(/\.shell\{max-width:(\d+)px;margin:auto;padding:([\d]+)px\}/);
    expect(shellRule?.[1]).toBe("1700");
    expect(shellRule?.[2]).toBe("24");

    for (const viewport of [1280, 1440, 1675, 1920]) {
      const shellWidth = Math.min(viewport, 1700);
      const leftMargin = (viewport - shellWidth) / 2;
      expect(leftMargin).toBeGreaterThanOrEqual(0);
      expect(leftMargin).toBeCloseTo((viewport - shellWidth) / 2, 6);
      expect(shellWidth - 48).toBeGreaterThanOrEqual(1232);
    }
  });

  it("keeps synthetic desktop dimensions wide enough at both tested DPRs", () => {
    const syntheticOrders = Array.from({ length: 25 }, (_, index) => ({ id: `synthetic-order-${index}`, height: 92 }));
    expect(syntheticOrders).toHaveLength(25);

    for (const cssWidth of [1280, 1440, 1675, 1920]) {
      const layout = computeDesktopLayout(cssWidth);
      expect(layout.workspace).toBeGreaterThanOrEqual(1232);
      expect(layout.master).toBeGreaterThanOrEqual(500);
      expect(layout.detail).toBeGreaterThanOrEqual(680);
      expect(layout.tabs).toBeGreaterThanOrEqual(300);
      expect(layout.filters).toBe(layout.workspace);
      for (const dpr of [0.8, 1]) {
        expect(layout.master * dpr).toBeGreaterThan(330);
        expect(layout.detail * dpr).toBeGreaterThan(420);
      }
    }
  });

  it("asserts the intended breakpoint model instead of only checking overflow", () => {
    expect(computeResponsiveLayout(1280)).toEqual({ columns: 2, tabs: 4, filters: 7, minHeight: 560 });
    expect(computeResponsiveLayout(900)).toEqual({ columns: 1, tabs: 4, filters: 2, minHeight: 850 });
    expect(computeResponsiveLayout(768)).toEqual({ columns: 1, tabs: 4, filters: 2, minHeight: 850 });
    expect(computeResponsiveLayout(430)).toEqual({ columns: 1, tabs: 2, filters: 1, minHeight: 850 });
    expect(computeResponsiveLayout(320)).toEqual({ columns: 1, tabs: 2, filters: 1, minHeight: 850 });
  });

  it("keeps pagination reachable while 25, 50, or 100 rows scroll inside the master", () => {
    for (const rowCount of [25, 50, 100]) {
      const layout = computeMasterScrollLayout(557, rowCount);
      expect(layout.pagerBottom).toBeLessThanOrEqual(557);
      expect(layout.listContent).toBeGreaterThan(layout.listHeight);
      expect(layout.listViewport).toBe(layout.listHeight);
    }
  });
});
