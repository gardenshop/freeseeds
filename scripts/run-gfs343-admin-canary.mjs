import os from "node:os";
import path from "node:path";
import { createCloudflareCanaryAdapter } from "./cloudflare-canary-adapter.mjs";
import { runCanary } from "./canary-deadline-controller.mjs";

const startedAt = new Date().toISOString();
const adapter = createCloudflareCanaryAdapter({
  scope: "admin",
  targetCandidatePercent: 10,
  messagePrefix: "GFS-343",
  workers: {
    api: { name: "getfreeseeds-api-staging", baseline: "b426ba47-1ead-4c4a-85ba-0a0b85d3e415", candidate: "6ef27f02-23ac-46c0-a291-157e246a8dbc" },
    admin: { name: "getfreeseeds-admin-staging", baseline: "494a3dce-5d52-4b66-b3ff-bef64b31b406", candidate: "19188b21-60da-4b03-bd89-72cb49468100" }
  }
});

const result = await runCanary({
  scope: "admin",
  targetCandidatePercent: 10,
  durationMs: 10 * 60 * 1000,
  restoreMarginMs: 2 * 60 * 1000,
  pollIntervalMs: 5_000,
  pollTimeoutMs: 15_000,
  commandTimeoutMs: 20_000,
  lockPath: path.join(os.tmpdir(), "gfs343-admin-canary.lock"),
  execute: adapter.execute,
  readTraffic: adapter.readTraffic,
  audit: (event) => console.log(JSON.stringify(event))
});

console.log(JSON.stringify({ startedAt, endedAt: new Date().toISOString(), result }));
if (!result.ok) process.exitCode = 1;
