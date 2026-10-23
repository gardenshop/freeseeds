export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isInsideWhatsAppServiceWindow(lastInboundAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const timestamp = Date.parse(lastInboundAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age < WHATSAPP_SERVICE_WINDOW_MS;
}
