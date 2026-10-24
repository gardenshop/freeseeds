import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

const origin="https://admin.example.test";
class NoCodSchemaDb{
  prepare(sql:string){
    if(sql.includes("cod_order_details"))throw new Error("legacy database must not query the V2 COD schema");
    return{bind:()=>this.prepareBound(sql),first:async()=>sql.includes("all_count")?{all_count:0,verify_count:0,confirmed_count:0,fulfillment_count:0}:sql.includes("AS total")?{total:0}:null,all:async()=>({results:[]}),run:async()=>({meta:{changes:0}})} as never;
  }
  private prepareBound(sql:string){return{first:async()=>sql.includes("all_count")?{all_count:0,verify_count:0,confirmed_count:0,fulfillment_count:0}:sql.includes("AS total")?{total:0}:null,all:async()=>({results:[]}),run:async()=>({meta:{changes:0}})} as never;}
}
const legacyEnv={DB:new NoCodSchemaDb() as unknown as D1Database,ADMIN_EMAIL:"owner@example.test",DEPLOYMENT_STATE:"PRODUCTION_INTEGRATION_READY"} as never;
const headers={"cf-access-authenticated-user-email":"owner@example.test"};

describe("frozen V1 stays isolated from V2 COD schema and UI",()=>{
  it("renders legacy payment settings and queries Orders without COD tables",async()=>{
    const page=await app.fetch(new Request(`${origin}/payment-settings`,{headers}),legacyEnv);
    expect(page.status).toBe(200);
    expect(await page.text()).not.toContain("Cash on Delivery (COD) — isolated V2");
    const orders=await app.fetch(new Request(`${origin}/api/orders?tab=all`,{headers}),legacyEnv);
    expect(orders.status).toBe(200);
    await expect(orders.json()).resolves.toMatchObject({orders:[],total:0});
  });

  it("does not expose COD settings or workflow endpoints outside isolated V2",async()=>{
    for(const path of ["/api/cod-settings","/api/cod-orders/order-synthetic/transition","/api/cod-orders/order-synthetic/collection","/api/cod-orders/order-synthetic/reconcile"]){
      const response=await app.fetch(new Request(`${origin}${path}`,{headers}),legacyEnv);
      expect(response.status).toBe(404);
    }
  });
});
