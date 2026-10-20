import type { InboundEvent } from "@gfs/core";

// Admission is atomic for the whole callback. Replays consume no additional quota.
export async function admitWhatsAppSenders(db: D1Database, events: InboundEvent[], now = Date.now()): Promise<boolean> {
  if (!events.length) return true;
  const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const seconds = Math.floor(now / 1000);
  const entries = await Promise.all(events.map(async (event) => ({ sender: await digest(event.from), event: await digest(`${event.from}:${event.id}`) })));
  try {
    await db.batch([
      db.prepare("DELETE FROM whatsapp_sender_admissions WHERE admitted_at<?").bind(seconds - 86400),
      ...entries.map((entry) => db.prepare("INSERT OR IGNORE INTO whatsapp_sender_admissions(event_hash,sender_hash,admitted_at) VALUES(?,?,?)").bind(entry.event, entry.sender, seconds))
    ]);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("WHATSAPP_SENDER_RATE_LIMITED")) return false;
    throw error;
  }
}
