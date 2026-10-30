import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const WRANGLER_ENTRY = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const DEFAULT_WORKERS = Object.freeze({
  api: Object.freeze({
    name: "getfreeseeds-api-staging",
    baseline: "b426ba47-1ead-4c4a-85ba-0a0b85d3e415",
    candidate: "6ef27f02-23ac-46c0-a291-157e246a8dbc"
  }),
  admin: Object.freeze({
    name: "getfreeseeds-admin-staging",
    baseline: "494a3dce-5d52-4b66-b3ff-bef64b31b406",
    candidate: "c2321eab-6c24-4327-a8d9-6fee9ac550e0"
  })
});

async function runWrangler(args, { signal, timeoutMs = 120_000 } = {}) {
  const result = await execFileAsync(process.execPath, [WRANGLER_ENTRY, ...args], {
    shell: false,
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    signal
  });
  return result.stdout;
}

function statusFromJson(raw, worker) {
  const state = JSON.parse(raw);
  const versions = new Map((state.versions ?? []).map((version) => [version.version_id, Number(version.percentage)]));
  if (!versions.has(worker.baseline) || !versions.has(worker.candidate)) throw new Error("unexpected_version");
  return { baseline: versions.get(worker.baseline), candidate: versions.get(worker.candidate) };
}

function validateHealth(worker, health, metrics) {
  if (!health || !Number.isInteger(health.httpStatus) || !Number.isFinite(health.latencyMs) || health.latencyMs < 0) throw new Error(`health_unavailable:${worker.name}`);
  if (!metrics || metrics.source !== "cloudflare_graphql" || !Number.isInteger(metrics.requests) || metrics.requests < 0 || !Number.isInteger(metrics.errors) || metrics.errors < 0) throw new Error(`metrics_unavailable:${worker.name}`);
  return { httpStatus: health.httpStatus, latencyMs: health.latencyMs, requests: metrics.requests, errors: metrics.errors };
}

export function createCloudflareCanaryAdapter({ workers = DEFAULT_WORKERS, runCommand = runWrangler, readHealth, readMetrics, messagePrefix = "GFS-334", scope = "all", targetCandidatePercent = 1 } = {}) {
  if (scope !== "all" && scope !== "api" && scope !== "admin") throw new TypeError("invalid canary scope");
  if (!Number.isInteger(targetCandidatePercent) || targetCandidatePercent <= 0 || targetCandidatePercent >= 100) throw new TypeError("invalid candidate percentage");
  const targetWorkers = scope === "api" ? [workers.api] : scope === "admin" ? [workers.admin] : [workers.api, workers.admin];
  const deploy = async (worker, specs, message, signal) => {
    await runCommand([
      "versions", "deploy", ...specs, "--name", worker.name,
      "--message", message, "--yes"
    ], { signal });
  };

  const readWorker = async (worker, signal) => {
    const raw = await runCommand(["deployments", "status", "--name", worker.name, "--json"], { signal });
    return statusFromJson(raw, worker);
  };
  const readWorkerHealth = async (worker, signal) => {
    if (typeof readHealth !== "function" || typeof readMetrics !== "function") return null;
    const [health, metrics] = await Promise.all([readHealth(worker, { signal }), readMetrics(worker, { signal })]);
    return validateHealth(worker, health, metrics);
  };

  return {
    async execute(action, { signal } = {}) {
      const exposing = action === "expose_candidate";
      const restoring = action === "restore_baseline";
      if (!exposing && !restoring) throw new Error("unknown_action");
      const baselinePercent = 100 - targetCandidatePercent;
      const specs = (worker) => exposing
        ? [`${worker.baseline}@${baselinePercent}`, `${worker.candidate}@${targetCandidatePercent}`]
        : [`${worker.baseline}@100`, `${worker.candidate}@0`];
      const suffix = exposing ? `${targetCandidatePercent} percent canary` : "restore baseline";
      for (const worker of targetWorkers) {
        await deploy(worker, specs(worker), `${messagePrefix} ${worker.name} ${suffix}`, signal);
      }
    },
    async readTraffic({ signal } = {}) {
      const [api, admin, apiHealth, adminHealth] = await Promise.all([
        readWorker(workers.api, signal),
        readWorker(workers.admin, signal),
        readWorkerHealth(workers.api, signal),
        readWorkerHealth(workers.admin, signal)
      ]);
      return {
        apiBaselinePercent: api.baseline,
        apiCandidatePercent: api.candidate,
        adminBaselinePercent: admin.baseline,
        adminCandidatePercent: admin.candidate,
        health: apiHealth && adminHealth ? {
          source: "cloudflare_graphql_http",
          api: apiHealth,
          admin: adminHealth
        } : undefined
      };
    }
  };
}

export { DEFAULT_WORKERS, WRANGLER_ENTRY };
