import { eventId } from "./domain";

export type CapiEvent = { eventId: string; eventName: "Lead" | "Purchase"; orderNumber: string; value?: number; currency?: "PKR"; ctwaClid?: string };

export function createLeadEvent(orderNumber: string, attribution?: { ctwaClid?: string }): CapiEvent {
  return { eventId: eventId("lead", orderNumber), eventName: "Lead", orderNumber, ...(attribution?.ctwaClid ? { ctwaClid: attribution.ctwaClid } : {}) };
}

export function createPurchaseEvent(orderNumber: string, approvedAmount: number, attribution?: { ctwaClid?: string }): CapiEvent {
  return { eventId: eventId("purchase", orderNumber), eventName: "Purchase", orderNumber, value: approvedAmount, currency: "PKR", ...(attribution?.ctwaClid ? { ctwaClid: attribution.ctwaClid } : {}) };
}
