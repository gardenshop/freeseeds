import { describe, expect, it } from "vitest";
import app from "../apps/admin/src/index";

type Statement={sql:string;args:unknown[];bind:(...args:unknown[])=>Statement;first:<T>()=>Promise<T|null>;all:<T>()=>Promise<{results:T[]}>;run:()=>Promise<{meta:{changes:number}}>};

class CodOperationsDb {
  orderNumber="FS-SYNTHETIC-COD-1";
  state="COD_PENDING";
  paymentStatus="COD_PENDING";
  reviewState="COD_PENDING";
  codStatus="COD_CONFIRMED";
  total=625;
  collectionAmount:number|null=null;
  collectionHash:string|null=null;
  remittanceHash:string|null=null;
  audits:string[]=[];
  trackingNumber:string|null=null;

  prepare(sql:string):D1PreparedStatement{return this.statement(sql,[]) as unknown as D1PreparedStatement}
  async batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>{return (statements as unknown as Statement[]).map((statement)=>({meta:{changes:this.execute(statement)}})) as unknown as D1Result<T>[]}
  private statement(sql:string,args:unknown[]):Statement{return{sql,args,bind:(...next)=>this.statement(sql,next),first:async<T>()=>this.first(sql) as T|null,all:async<T>()=>({results:[] as T[]}),run:async()=>({meta:{changes:this.execute({sql,args})}})}}

  private first(sql:string):Record<string,unknown>|null{
    if(sql.includes("action='ORDER_TRACKING_ASSIGNED'"))return this.trackingNumber?{metadata_json:JSON.stringify({trackingNumber:this.trackingNumber})}:null;
    if(sql.includes("SELECT cd.id,cd.attempt,cd.status AS cod_status"))return{id:"cod-detail-1",attempt:1,cod_status:this.codStatus,total_payable_pkr:this.total,order_number:this.orderNumber,state:this.state,payment_status:this.paymentStatus,archived_at:null,method:"COD",review_state:this.reviewState};
    if(sql.includes("SELECT cd.id,cd.attempt,cd.status,cd.total_payable_pkr,cd.collection_reference_hash,o.order_number"))return{id:"cod-detail-1",attempt:1,status:this.codStatus,total_payable_pkr:this.total,collection_reference_hash:this.collectionHash,order_number:this.orderNumber,state:this.state,payment_status:this.paymentStatus,method:"COD"};
    if(sql.includes("cd.collection_amount_pkr"))return{id:"cod-detail-1",attempt:1,status:this.codStatus,total_payable_pkr:this.total,collection_amount_pkr:this.collectionAmount,collection_reference_hash:this.collectionHash,remittance_reference_hash:this.remittanceHash,order_number:this.orderNumber,state:this.state,payment_status:this.paymentStatus,payment_id:"payment-1",method:"COD"};
    return null;
  }

  private execute(statement:{sql:string;args:unknown[]}):number{
    const {sql,args}=statement;
    if(sql.startsWith("UPDATE cod_order_details SET status=?")){
      if(this.codStatus!==String(args[3])||this.state!==String(args[5])||this.paymentStatus!=="COD_PENDING")return 0;
      this.codStatus=String(args[0]);return 1;
    }
    if(sql.startsWith("UPDATE orders SET state=?")){
      if(this.state!==String(args[3])||this.paymentStatus!=="COD_PENDING")return 0;
      this.state=String(args[0]);return 1;
    }
    if(sql.startsWith("UPDATE cod_order_details SET status='COLLECTED'")){
      if(this.codStatus!=="COLLECTION_PENDING")return 0;
      this.codStatus="COLLECTED";this.collectionAmount=Number(args[0]);this.collectionHash=String(args[1]);return 1;
    }
    if(sql.startsWith("UPDATE cod_order_details SET status='RECONCILED'")){
      if(this.codStatus!=="COLLECTED"||this.collectionAmount!==this.total)return 0;
      this.codStatus="RECONCILED";this.remittanceHash=String(args[0]);return 1;
    }
    if(sql.startsWith("UPDATE orders SET payment_status='PAID'")){
      if(this.codStatus!=="RECONCILED"||this.state!=="DELIVERED"||this.paymentStatus!=="COD_PENDING")return 0;
      this.paymentStatus="PAID";return 1;
    }
    if(sql.startsWith("UPDATE payments SET review_state='APPROVED'")){
      if(this.paymentStatus!=="PAID"||this.reviewState!=="COD_PENDING")return 0;
      this.reviewState="APPROVED";return 1;
    }
    if(sql.includes("INSERT INTO audit_log")){this.audits.push(String(args[1]));return 1}
    return 0;
  }
}

const identity={"cf-access-authenticated-user-email":"owner@example.test"};
const policyKey="synthetic-cod-policy-key-with-sufficient-entropy";
const env=(db:CodOperationsDb)=>({DB:db as unknown as D1Database,ADMIN_EMAIL:"owner@example.test",DEPLOYMENT_STATE:"LOCAL",COD_ADMIN_UI_ENABLED:"true",COD_V2_ENABLED:"false",COD_POLICY_HMAC_KEY:policyKey}) as never;
async function session(db:CodOperationsDb){const response=await app.fetch(new Request("https://admin.example.test/api/csrf",{headers:identity}),env(db));const body=await response.json() as {csrfToken:string};return{token:body.csrfToken,cookie:response.headers.get("set-cookie")!.split(";",1)[0]}}
function headers(value:{token:string;cookie:string}){return{...identity,origin:"https://admin.example.test",cookie:value.cookie,"x-csrf-token":value.token,"content-type":"application/json"}}
async function post(db:CodOperationsDb,csrf:{token:string;cookie:string},path:string,body:unknown){return app.fetch(new Request(`https://admin.example.test${path}`,{method:"POST",headers:headers(csrf),body:JSON.stringify(body)}),env(db))}

describe("V2 COD Admin fulfillment and reconciliation",()=>{
  it("enforces order transitions, collection then remittance before PAID, and idempotent retries",async()=>{
    const db=new CodOperationsDb(),csrf=await session(db);
    const pack={from:"COD_PENDING",to:"PACKING",confirmation:db.orderNumber};
    let response=await post(db,csrf,"/api/cod-orders/order-1/transition",pack);
    expect(response.status).toBe(200);expect(db.state).toBe("PACKING");expect(db.codStatus).toBe("PACKING");
    response=await post(db,csrf,"/api/cod-orders/order-1/transition",pack);
    expect(response.status).toBe(200);expect((await response.json() as {alreadyTransitioned:boolean}).alreadyTransitioned).toBe(true);
    response=await post(db,csrf,"/api/cod-orders/order-1/transition",{from:"PACKING",to:"DELIVERED",confirmation:db.orderNumber});
    expect(response.status).toBe(409);expect(db.state).toBe("PACKING");
    db.trackingNumber="SYNTHETIC-TRACKING-1";
    response=await post(db,csrf,"/api/cod-orders/order-1/transition",{from:"PACKING",to:"DISPATCHED",confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect(db.state).toBe("DISPATCHED");
    response=await post(db,csrf,"/api/cod-orders/order-1/transition",{from:"DISPATCHED",to:"DELIVERED",confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect(db.state).toBe("DELIVERED");expect(db.codStatus).toBe("COLLECTION_PENDING");
    response=await post(db,csrf,"/api/cod-orders/order-1/collection",{collectionAmountPkr:625,collectionReference:"SYNTHETIC-COURIER-REF-1",collectionConfirmed:true,confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect(db.codStatus).toBe("COLLECTED");expect(db.paymentStatus).toBe("COD_PENDING");
    response=await post(db,csrf,"/api/cod-orders/order-1/collection",{collectionAmountPkr:625,collectionReference:"SYNTHETIC-COURIER-REF-1",collectionConfirmed:true,confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect((await response.json() as {alreadyRecorded:boolean}).alreadyRecorded).toBe(true);
    response=await post(db,csrf,"/api/cod-orders/order-1/reconcile",{remittanceAmountPkr:624,remittanceReference:"SYNTHETIC-REMITTANCE-1",remittanceConfirmed:true,confirmation:db.orderNumber});
    expect(response.status).toBe(409);expect(db.paymentStatus).toBe("COD_PENDING");
    response=await post(db,csrf,"/api/cod-orders/order-1/reconcile",{remittanceAmountPkr:625,remittanceReference:"SYNTHETIC-REMITTANCE-1",remittanceConfirmed:true,confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect(db.codStatus).toBe("RECONCILED");expect(db.paymentStatus).toBe("PAID");expect(db.reviewState).toBe("APPROVED");
    response=await post(db,csrf,"/api/cod-orders/order-1/reconcile",{remittanceAmountPkr:625,remittanceReference:"SYNTHETIC-REMITTANCE-1",remittanceConfirmed:true,confirmation:db.orderNumber});
    expect(response.status).toBe(200);expect((await response.json() as {alreadyReconciled:boolean}).alreadyReconciled).toBe(true);
    expect(db.audits).toEqual(["COD_ORDER_STATE_TRANSITIONED","COD_ORDER_STATE_TRANSITIONED","COD_ORDER_STATE_TRANSITIONED","COD_CASH_COLLECTED","COD_REMITTANCE_RECONCILED"]);
  });
});
