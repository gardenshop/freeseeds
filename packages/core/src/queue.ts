export type QueueJob = { kind: string; idempotencyKey: string; entityId: string; schemaVersion: 1 };

export function retryDelaySeconds(attempts: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts));
}

export function shouldDeadLetter(attempts: number, maxRetries = 5): boolean {
  return attempts >= maxRetries;
}

export function isTerminalOutboxStatus(status: string): boolean {
  return status === "SENT" || status === "SUCCEEDED" || status === "PERMANENT_FAILURE";
}
