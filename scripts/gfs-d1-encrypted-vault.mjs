import { spawn, spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { access, open, readFile, rename, statfs, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { createServer } from "node:net";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const MAGIC = Buffer.from("GFSVLT02", "ascii");
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const RECOVERY_SALT_BYTES = 16;
const RECOVERY_ENVELOPE_BYTES = RECOVERY_SALT_BYTES + IV_BYTES + TAG_BYTES + KEY_BYTES;
const MIN_FREE_BYTES = 1024 ** 3;
const EXPECTED_CF_ACCOUNT_ID = "cb5066a6d71ecdee0bd7ed8aacb4d3c2";
const EXPECTED_PRODUCTION_D1_NAME = "getfreeseeds-staging";
const EXPECTED_PRODUCTION_D1_ID = "17b7e9f6-e08b-4bff-a756-10de30b49ab1";
const EXPECTED_RESTORE_D1_NAME = "getfreeseeds-v2-restore-check";
const EXPECTED_RESTORE_D1_ID = "0a9ae021-64c9-4591-ac3c-aadd29ce13b6";
const DPAPI_SCRIPT = `$ErrorActionPreference='Stop';$mode='__MODE__';$text=[Console]::In.ReadToEnd().Trim();$bytes=[Convert]::FromBase64String($text);if($mode -eq 'protect'){$secret=[Convert]::ToBase64String($bytes);$secure=ConvertTo-SecureString -String $secret -AsPlainText -Force;$result=ConvertFrom-SecureString -SecureString $secure}else{$wrapped=[Text.Encoding]::UTF8.GetString($bytes);$secure=ConvertTo-SecureString -String $wrapped;$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{$result=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}};[Console]::Out.Write($result)`;
const ACL_SCRIPT = `$ErrorActionPreference='Stop';$inputText=[Console]::In.ReadToEnd().Trim();$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($inputText));$acl=Get-Acl -LiteralPath $path;$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$allowed=@($userSid,'S-1-5-18','S-1-5-32-544');if(-not $acl.AreAccessRulesProtected){throw 'INHERITANCE'};$owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value;if($owner -ne $userSid){throw 'OWNER'};$rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]);if($rules.Count -ne 3){throw 'RULE_COUNT'};foreach($rule in $rules){if($rule.AccessControlType -ne 'Allow' -or $rule.IdentityReference.Value -notin $allowed -or -not $rule.FileSystemRights.ToString().Contains('FullControl')){throw 'RULE'};if($rule.IsInherited){throw 'INHERITED'}};[Console]::Out.Write('OK')`;
const FILE_ACL_SCRIPT = `$ErrorActionPreference='Stop';$inputText=[Console]::In.ReadToEnd().Trim();$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($inputText));$acl=Get-Acl -LiteralPath $path;$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$allowed=@($userSid,'S-1-5-18','S-1-5-32-544');if($acl.AreAccessRulesProtected){throw 'FILE_INHERITANCE'};$owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value;if($owner -ne $userSid){throw 'FILE_OWNER'};$rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]);if($rules.Count -ne 3){throw 'FILE_RULE_COUNT'};foreach($rule in $rules){if($rule.AccessControlType -ne 'Allow' -or $rule.IdentityReference.Value -notin $allowed -or -not $rule.FileSystemRights.ToString().Contains('FullControl')){throw 'FILE_RULE'}};[Console]::Out.Write('OK')`;

function runPowerShell(script, input) {
  const childEnv = { ...process.env };
  delete childEnv.GFS_D1_VAULT_RECOVERY_PASSPHRASE;
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    input: Buffer.from(input).toString("base64"),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    env: childEnv
  });
  if (result.error || result.status !== 0) throw new Error("WINDOWS_VAULT_CRYPTO_UNAVAILABLE");
  return result.stdout.trim();
}

function protectKey(key) {
  const script = DPAPI_SCRIPT.replace("__MODE__", "protect");
  const wrapped = runPowerShell(script, key);
  if (!wrapped) throw new Error("WINDOWS_DPAPI_PROTECT_FAILED");
  return Buffer.from(wrapped, "utf8");
}

function unprotectKey(wrapped) {
  const script = DPAPI_SCRIPT.replace("__MODE__", "unprotect");
  const base64 = runPowerShell(script, wrapped);
  const key = Buffer.from(base64, "base64");
  if (key.length !== KEY_BYTES) throw new Error("WINDOWS_DPAPI_UNPROTECT_FAILED");
  return key;
}

function protectRecoveryKey(key, passphrase) {
  if (typeof passphrase !== "string" || Buffer.byteLength(passphrase, "utf8") < 24) throw new Error("VAULT_RECOVERY_SECRET_REQUIRED");
  const salt = randomBytes(RECOVERY_SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const recoveryKey = scryptSync(passphrase, salt, KEY_BYTES, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  try {
    const cipher = createCipheriv("aes-256-gcm", recoveryKey, iv);
    const encryptedKey = Buffer.concat([cipher.update(key), cipher.final()]);
    return Buffer.concat([salt, iv, cipher.getAuthTag(), encryptedKey]);
  } finally { recoveryKey.fill(0); }
}

function unprotectRecoveryKey(envelope, passphrase) {
  if (envelope.length !== RECOVERY_ENVELOPE_BYTES || typeof passphrase !== "string" || Buffer.byteLength(passphrase, "utf8") < 24) throw new Error("VAULT_RECOVERY_SECRET_INVALID");
  const salt = envelope.subarray(0, RECOVERY_SALT_BYTES);
  const iv = envelope.subarray(RECOVERY_SALT_BYTES, RECOVERY_SALT_BYTES + IV_BYTES);
  const tag = envelope.subarray(RECOVERY_SALT_BYTES + IV_BYTES, RECOVERY_SALT_BYTES + IV_BYTES + TAG_BYTES);
  const encryptedKey = envelope.subarray(RECOVERY_SALT_BYTES + IV_BYTES + TAG_BYTES);
  const recoveryKey = scryptSync(passphrase, salt, KEY_BYTES, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  try {
    const decipher = createDecipheriv("aes-256-gcm", recoveryKey, iv);
    decipher.setAuthTag(tag);
    const key = Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
    if (key.length !== KEY_BYTES) throw new Error("VAULT_RECOVERY_SECRET_INVALID");
    return key;
  } finally { recoveryKey.fill(0); }
}

function assertWindows() {
  if (process.platform !== "win32") throw new Error("WINDOWS_DPAPI_REQUIRED");
}

async function assertVault(vaultPath) {
  assertWindows();
  const path = resolve(vaultPath);
  await access(path);
  const aclStatus = runPowerShell(ACL_SCRIPT, path);
  if (aclStatus !== "OK") throw new Error("VAULT_ACL_REJECTED");
  const capacity = await statfs(path);
  const freeBytes = capacity.bavail * capacity.bsize;
  if (!Number.isSafeInteger(freeBytes) || freeBytes < MIN_FREE_BYTES) throw new Error("VAULT_CAPACITY_INSUFFICIENT");
  return { path, freeBytes };
}

async function assertVaultFile(filePath) {
  const result = runPowerShell(FILE_ACL_SCRIPT, resolve(filePath));
  if (result !== "OK") throw new Error("VAULT_FILE_ACL_REJECTED");
}

function targetPath(vaultPath, name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.gfsenc$/.test(name)) throw new Error("VAULT_FILENAME_INVALID");
  const root = resolve(vaultPath);
  const target = resolve(root, name);
  if (!target.startsWith(`${root}${sep}`)) throw new Error("VAULT_PATH_INVALID");
  return target;
}

async function writeAll(handle, buffer, position = null) {
  let offset = 0;
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset, position === null ? null : position + offset);
    if (result.bytesWritten <= 0) throw new Error("VAULT_WRITE_FAILED");
    offset += result.bytesWritten;
  }
}

async function assertTargetAbsent(path) {
  try { await access(path); throw new Error("VAULT_TARGET_EXISTS"); }
  catch (error) {
    if (error instanceof Error && error.message === "VAULT_TARGET_EXISTS") throw error;
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") throw error;
  }
}

async function* sourceChunks(source) {
  if (Buffer.isBuffer(source) || source instanceof Uint8Array) { yield Buffer.from(source); return; }
  for await (const chunk of source) yield Buffer.from(chunk);
}

async function encryptToVault(vaultPath, name, source, { recoveryPassphrase } = {}) {
  const { path: root, freeBytes } = await assertVault(vaultPath);
  const target = targetPath(root, name);
  await assertTargetAbsent(target);
  const partial = `${target}.${process.pid}.${randomBytes(6).toString("hex")}.partial`;
  const key = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrappedKey = protectKey(key);
  const recoveryEnvelope = protectRecoveryKey(key, recoveryPassphrase);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ivPosition = MAGIC.length + 8 + wrappedKey.length + recoveryEnvelope.length;
  const tagPosition = ivPosition + IV_BYTES;
  const header = Buffer.alloc(tagPosition + TAG_BYTES);
  MAGIC.copy(header, 0);
  header.writeUInt32BE(wrappedKey.length, MAGIC.length);
  header.writeUInt32BE(recoveryEnvelope.length, MAGIC.length + 4);
  wrappedKey.copy(header, MAGIC.length + 8);
  recoveryEnvelope.copy(header, MAGIC.length + 8 + wrappedKey.length);
  iv.copy(header, ivPosition);
  const handle = await open(partial, "wx", 0o600);
  try {
    await writeAll(handle, header);
    for await (const chunk of sourceChunks(source)) {
      const encrypted = cipher.update(chunk);
      chunk.fill(0);
      if (encrypted.length) await writeAll(handle, encrypted);
      encrypted.fill(0);
      if (freeBytes < MIN_FREE_BYTES) throw new Error("VAULT_CAPACITY_INSUFFICIENT");
    }
    const final = cipher.final();
    if (final.length) await writeAll(handle, final);
    final.fill(0);
    await writeAll(handle, cipher.getAuthTag(), tagPosition);
    await handle.sync();
  } catch (error) {
    key.fill(0);
    wrappedKey.fill(0);
    recoveryEnvelope.fill(0);
    await handle.close().catch(() => undefined);
    await unlink(partial).catch(() => undefined);
    throw error;
  }
  key.fill(0);
  wrappedKey.fill(0);
  recoveryEnvelope.fill(0);
  await handle.close();
  await rename(partial, target);
  try { await assertVaultFile(target); } catch (error) { await unlink(target).catch(() => undefined); throw error; }
  return { target, sha256: await hashFile(target), freeBytes };
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function parseContainer(container) {
  if (container.length < MAGIC.length + 8 + IV_BYTES + TAG_BYTES || !container.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("VAULT_CONTAINER_INVALID");
  const wrappedKeyLength = container.readUInt32BE(MAGIC.length);
  const recoveryEnvelopeLength = container.readUInt32BE(MAGIC.length + 4);
  if (recoveryEnvelopeLength !== RECOVERY_ENVELOPE_BYTES) throw new Error("VAULT_CONTAINER_INVALID");
  const wrappedKeyOffset = MAGIC.length + 8;
  const recoveryEnvelopeOffset = wrappedKeyOffset + wrappedKeyLength;
  const ivOffset = recoveryEnvelopeOffset + recoveryEnvelopeLength;
  const tagOffset = ivOffset + IV_BYTES;
  if (!wrappedKeyLength || tagOffset + TAG_BYTES >= container.length) throw new Error("VAULT_CONTAINER_INVALID");
  return {
    wrappedKey: container.subarray(wrappedKeyOffset, recoveryEnvelopeOffset),
    recoveryEnvelope: container.subarray(recoveryEnvelopeOffset, ivOffset),
    iv: container.subarray(ivOffset, tagOffset),
    tag: container.subarray(tagOffset, tagOffset + TAG_BYTES),
    ciphertext: container.subarray(tagOffset + TAG_BYTES)
  };
}

function decryptBuffer(container, { recoveryPassphrase, preferRecovery = false } = {}) {
  const parsed = parseContainer(container);
  let key;
  if (preferRecovery) key = unprotectRecoveryKey(parsed.recoveryEnvelope, recoveryPassphrase);
  else {
    try { key = unprotectKey(parsed.wrappedKey); }
    catch { key = unprotectRecoveryKey(parsed.recoveryEnvelope, recoveryPassphrase ?? process.env.GFS_D1_VAULT_RECOVERY_PASSPHRASE); }
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, parsed.iv);
    decipher.setAuthTag(parsed.tag);
    return Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);
  } finally { key.fill(0); }
}

function verifySyntheticSql(sql) {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(sql);
    const counts = database.prepare("SELECT COUNT(*) AS rows, SUM(total_pkr) AS total FROM synthetic_orders").get();
    if (counts.rows !== 2 || counts.total !== 375) throw new Error("SYNTHETIC_RESTORE_MISMATCH");
    let constraintEnforced = false;
    try { database.prepare("INSERT INTO synthetic_orders VALUES(?,?,?)").run("invalid", -1, "COD_PENDING"); } catch { constraintEnforced = true; }
    if (!constraintEnforced) throw new Error("SYNTHETIC_RESTORE_CONSTRAINT_MISSING");
    return { rows: counts.rows, totalPkr: counts.total, constraintEnforced };
  } finally { database.close(); }
}

async function selfTest(vaultPath) {
  const { path: root, freeBytes } = await assertVault(vaultPath);
  const name = `vault-self-test-${randomBytes(8).toString("hex")}.gfsenc`;
  const target = targetPath(root, name);
  const sql = Buffer.from("CREATE TABLE synthetic_orders(id TEXT PRIMARY KEY,total_pkr INTEGER NOT NULL CHECK(total_pkr>=0),state TEXT NOT NULL CHECK(state IN ('PENDING','COD_PENDING')));INSERT INTO synthetic_orders VALUES('synthetic-advance',250,'PENDING'),('synthetic-cod',125,'COD_PENDING');", "utf8");
  const recoveryPassphrase = randomBytes(32).toString("base64url");
  let encrypted;
  try {
    encrypted = await encryptToVault(root, name, Readable.from([Buffer.from(sql)]), { recoveryPassphrase });
    const container = await readFile(target);
    const restored = decryptBuffer(container);
    if (!restored.equals(sql)) throw new Error("VAULT_ROUNDTRIP_MISMATCH");
    const restore = verifySyntheticSql(restored.toString("utf8"));
    const recoveryRestored = decryptBuffer(container, { recoveryPassphrase, preferRecovery: true });
    if (!recoveryRestored.equals(sql)) throw new Error("VAULT_RECOVERY_ROUNDTRIP_MISMATCH");
    recoveryRestored.fill(0);
    const tampered = Buffer.from(container);
    tampered[tampered.length - 1] ^= 1;
    let tamperRejected = false;
    try { decryptBuffer(tampered); } catch { tamperRejected = true; }
    tampered.fill(0);
    if (!tamperRejected) throw new Error("VAULT_TAMPER_NOT_DETECTED");
    restored.fill(0);
    container.fill(0);
    return { sha256: encrypted.sha256, encryptedBytes: (await (await import("node:fs/promises")).stat(target)).size, freeBytes, ...restore, tamperRejected };
  } finally {
    sql.fill(0);
    await unlink(target).catch(() => undefined);
  }
}

async function pipeSelfTest(vaultPath) {
  const { path: root, freeBytes } = await assertVault(vaultPath);
  const pipeName = `\\\\.\\pipe\\gfs-orderflow-vault-${randomBytes(10).toString("hex")}`;
  const name = `vault-pipe-self-test-${randomBytes(8).toString("hex")}.gfsenc`;
  const target = targetPath(root, name);
  const sql = Buffer.from("CREATE TABLE synthetic_restore(id TEXT PRIMARY KEY, amount INTEGER CHECK(amount>=0));INSERT INTO synthetic_restore VALUES('synthetic-a',125),('synthetic-b',250);", "utf8");
  const recoveryPassphrase = randomBytes(32).toString("base64url");
  let server;
  try {
    let encryptPromise;
    server = createServer((socket) => socket.once("data", (firstChunk) => {
      if (encryptPromise) { socket.destroy(); return; }
      const source = new PassThrough();
      source.write(firstChunk);
      socket.pipe(source);
      encryptPromise = encryptToVault(root, name, source, { recoveryPassphrase });
    }));
    await new Promise((resolveListen, rejectListen) => { server.once("error", rejectListen); server.listen(pipeName, resolveListen); });
    requirePipePathSupported(pipeName);
    await writeFile(pipeName, Buffer.from(sql));
    if (!encryptPromise) throw new Error("PIPE_EXPORT_DATA_MISSING");
    const encrypted = await encryptPromise;
    const container = await readFile(target);
    const restored = decryptBuffer(container);
    const recoveryRestored = decryptBuffer(container, { recoveryPassphrase, preferRecovery: true });
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(restored.toString("utf8"));
      const row = database.prepare("SELECT COUNT(*) AS rows, SUM(amount) AS amount FROM synthetic_restore").get();
      if (row.rows !== 2 || row.amount !== 375) throw new Error("PIPE_SQL_RESTORE_MISMATCH");
      if (!recoveryRestored.equals(restored)) throw new Error("PIPE_RECOVERY_ROUNDTRIP_MISMATCH");
    } finally { database.close(); }
    const readPipe = `\\\\.\\pipe\\gfs-orderflow-read-${randomBytes(10).toString("hex")}`;
    const serverScript = `const net=require("node:net");const p=process.argv.at(-2);const b=Buffer.from(process.argv.at(-1),"base64");let n=0;const s=net.createServer(c=>{c.end(b);n++;if(n>=2)s.close()});s.listen(p,()=>process.stdout.write("READY\\n"));`;
    const readerScript = `const fs=require("node:fs");const crypto=require("node:crypto");const p=process.argv.at(-1);const fd=fs.openSync(p,"r");const head=Buffer.alloc(15);let read=0;while(read<15){const n=fs.readSync(fd,head,read,15-read,null);if(!n)break;read+=n;}fs.closeSync(fd);const b=fs.readFileSync(p);process.stdout.write(read+":"+b.length+":"+crypto.createHash("sha256").update(b).digest("hex"));`;
    const pipeServer = spawn(process.execPath, ["-e", serverScript, readPipe, sql.toString("base64")], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    let readyOutput = "";
    const pipeReady = new Promise((resolveReady, rejectReady) => {
      pipeServer.stdout.setEncoding("utf8");
      pipeServer.stdout.on("data", (chunk) => { readyOutput += chunk; if (readyOutput.includes("READY")) resolveReady(); });
      pipeServer.once("error", rejectReady);
      pipeServer.once("exit", (code) => { if (!readyOutput.includes("READY")) rejectReady(new Error(`PIPE_SERVER_EXIT_${code}`)); });
    });
    const pipeExit = new Promise((resolveExit) => pipeServer.once("exit", resolveExit));
    await pipeReady;
    const pipeRead = spawnSync(process.execPath, ["-e", readerScript, readPipe], { encoding: "utf8", windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    await pipeExit;
    const expectedPipeRead = `15:${sql.length}:${createHash("sha256").update(sql).digest("hex")}`;
    if (pipeRead.error || pipeRead.status !== 0 || pipeRead.stdout !== expectedPipeRead) throw new Error("WRANGLER_RESTORE_PIPE_UNSUPPORTED");
    const sha256 = encrypted.sha256;
    container.fill(0);
    restored.fill(0);
    recoveryRestored.fill(0);
    return { sha256, freeBytes };
  } finally {
    sql.fill(0);
    if (server?.listening) await new Promise((done) => server.close(done));
    await unlink(target).catch(() => undefined);
  }
}

function requirePipePathSupported(pipeName) {
  statSync(pipeName, { throwIfNoEntry: false });
}

function containsString(value, expected) {
  if (typeof value === "string") return value === expected;
  if (Array.isArray(value)) return value.some((item) => containsString(item, expected));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsString(item, expected));
  return false;
}

function runWranglerJson(wranglerPath, root, args) {
  const childEnv = { ...process.env };
  delete childEnv.GFS_D1_VAULT_RECOVERY_PASSPHRASE;
  const result = spawnSync(process.execPath, [wranglerPath, ...args], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], env: childEnv });
  if (result.error || result.status !== 0) throw new Error("CLOUDFLARE_READBACK_FAILED");
  try { return JSON.parse(result.stdout); } catch { throw new Error("CLOUDFLARE_READBACK_INVALID"); }
}

function verifyCanonicalExportConfig(root) {
  const configPath = resolve(root, "apps/api/wrangler.jsonc");
  const text = statSync(configPath) && readFileSync(configPath, "utf8");
  const account = text.match(/"account_id"\s*:\s*"([^"]+)"/)?.[1];
  const database = text.match(/"database_name"\s*:\s*"([^"]+)"/)?.[1];
  const databaseId = text.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
  if (account !== EXPECTED_CF_ACCOUNT_ID || database !== EXPECTED_PRODUCTION_D1_NAME || databaseId !== EXPECTED_PRODUCTION_D1_ID) throw new Error("CANONICAL_D1_CONFIG_MISMATCH");
  return configPath;
}

async function exportProductionD1ToVault(vaultPath, outputName) {
  const recoveryPassphrase = process.env.GFS_D1_VAULT_RECOVERY_PASSPHRASE;
  const referenceCreatedAt = Date.parse(process.env.GFS_D1_TIME_TRAVEL_REFERENCE_CREATED_AT ?? "");
  const approvedVaultPath = process.env.GFS_D1_APPROVED_VAULT_PATH ? resolve(process.env.GFS_D1_APPROVED_VAULT_PATH) : "";
  if (process.env.GFS_D1_PRODUCTION_EXPORT_AUTHORIZED !== "YES" || process.env.GFS_D1_DESTINATION_APPROVED !== "YES" || process.env.GFS_D1_RESTORE_TARGET_APPROVED !== "YES" || process.env.GFS_D1_RESTORE_ISOLATION_VERIFIED !== "YES" || process.env.GFS_D1_RESTORE_TARGET_ID !== EXPECTED_RESTORE_D1_ID || !process.env.GFS_D1_TIME_TRAVEL_REFERENCE || !Number.isFinite(referenceCreatedAt) || referenceCreatedAt > Date.now() || Date.now() - referenceCreatedAt > 30 * 60 * 1000 || (recoveryPassphrase?.length ?? 0) < 24) throw new Error("SEPARATE_OWNER_EXPORT_APPROVAL_REQUIRED");
  const { path: root } = await assertVault(vaultPath);
  if (approvedVaultPath !== root) throw new Error("APPROVED_VAULT_PATH_MISMATCH");
  const target = targetPath(root, outputName);
  await assertTargetAbsent(target);
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const configPath = verifyCanonicalExportConfig(repoRoot);
  const wranglerPath = resolve(repoRoot, "node_modules/wrangler/bin/wrangler.js");
  const identity = runWranglerJson(wranglerPath, repoRoot, ["whoami", "--json", "--account", EXPECTED_CF_ACCOUNT_ID]);
  if (!containsString(identity, EXPECTED_CF_ACCOUNT_ID)) throw new Error("CLOUDFLARE_ACCOUNT_IDENTITY_MISMATCH");
  const d1Info = runWranglerJson(wranglerPath, repoRoot, ["d1", "info", EXPECTED_PRODUCTION_D1_NAME, "--json", "--config", configPath]);
  if (!containsString(d1Info, EXPECTED_PRODUCTION_D1_ID)) throw new Error("CANONICAL_D1_IDENTITY_MISMATCH");
  const restoreInfo = runWranglerJson(wranglerPath, repoRoot, ["d1", "info", EXPECTED_RESTORE_D1_NAME, "--json", "--config", configPath]);
  if (!containsString(restoreInfo, EXPECTED_RESTORE_D1_ID)) throw new Error("RESTORE_TARGET_IDENTITY_MISMATCH");
  const pipeName = `\\\\.\\pipe\\gfs-orderflow-export-${randomBytes(12).toString("hex")}`;
  const server = createServer();
  let connectionCount = 0;
  let encryptPromise;
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(pipeName, resolveListen);
  });
  server.on("connection", (socket) => socket.once("data", (firstChunk) => {
    connectionCount += 1;
    if (connectionCount !== 1) { socket.destroy(); return; }
    const source = new PassThrough();
    source.write(firstChunk);
    socket.pipe(source);
    encryptPromise = encryptToVault(root, outputName, source, { recoveryPassphrase });
  }));
  const wranglerEnv = { ...process.env };
  delete wranglerEnv.GFS_D1_VAULT_RECOVERY_PASSPHRASE;
  const child = spawn(process.execPath, [wranglerPath, "d1", "export", EXPECTED_PRODUCTION_D1_NAME, "--remote", "--skip-confirmation", "--config", configPath, "--output", pipeName], { cwd: repoRoot, stdio: "ignore", windowsHide: true, env: wranglerEnv });
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code) => resolveExit(code));
  }).catch(async () => { server.close(); throw new Error("WRANGLER_EXPORT_FAILED"); });
  if (exitCode !== 0 || connectionCount !== 1 || !encryptPromise) {
    server.close();
    await unlink(target).catch(() => undefined);
    throw new Error("WRANGLER_EXPORT_FAILED");
  }
  let encrypted;
  try { encrypted = await encryptPromise; } catch { server.close(); await unlink(target).catch(() => undefined); throw new Error("WRANGLER_EXPORT_ENCRYPTION_FAILED"); }
  server.close();
  const container = await readFile(encrypted.target);
  let plaintext;
  try {
    plaintext = decryptBuffer(container);
    if (!plaintext.length) throw new Error("D1_EXPORT_EMPTY");
  } catch {
    await unlink(encrypted.target).catch(() => undefined);
    throw new Error("D1_EXPORT_INTEGRITY_FAILED");
  } finally {
    plaintext?.fill(0);
    container.fill(0);
  }
  const stat = await import("node:fs/promises").then((fs) => fs.stat(encrypted.target));
  return { sha256: encrypted.sha256, encryptedBytes: stat.size, freeBytes: encrypted.freeBytes };
}

async function encryptCommand(vaultPath, name) {
  if (!isAbsolute(vaultPath)) throw new Error("VAULT_PATH_MUST_BE_ABSOLUTE");
  const recoveryPassphrase = process.env.GFS_D1_VAULT_RECOVERY_PASSPHRASE;
  if ((recoveryPassphrase?.length ?? 0) < 24) throw new Error("VAULT_RECOVERY_SECRET_REQUIRED");
  const result = await encryptToVault(vaultPath, name, process.stdin, { recoveryPassphrase });
  process.stdout.write(`encrypted=true; sha256=${result.sha256}; free_bytes=${result.freeBytes}\n`);
}

const [command, vaultPath, name] = process.argv.slice(2);
try {
  if (command === "self-test" && vaultPath) {
    const result = await selfTest(vaultPath);
    process.stdout.write(`vault_self_test=PASS; AES-256-GCM=PASS; DPAPI=CurrentUser; recovery_wrap=scrypt-AES-GCM; directory_acl=PASS; ciphertext_acl=PASS; SQL_memory_restore=PASS; restored_rows=${result.rows}; restored_total_PKR=${result.totalPkr}; constraint=PASS; tamper_detection=PASS; ciphertext_sha256=${result.sha256}; encrypted_bytes=${result.encryptedBytes}; free_bytes=${result.freeBytes}; plaintext_files=0\n`);
  } else if (command === "encrypt" && vaultPath && name) {
    await encryptCommand(vaultPath, name);
  } else if (command === "pipe-self-test" && vaultPath) {
    const result = await pipeSelfTest(vaultPath);
    process.stdout.write(`named_pipe_encryption_test=PASS; AES-256-GCM=PASS; recovery_wrap=scrypt-AES-GCM; SQL_memory_restore=PASS; restore_pipe_read=PASS; ciphertext_sha256=${result.sha256}; free_bytes=${result.freeBytes}; plaintext_files=0\n`);
  } else if (command === "export-wrangler" && vaultPath && name) {
    const result = await exportProductionD1ToVault(vaultPath, name);
    process.stdout.write(`encrypted_export=PASS; sha256=${result.sha256}; encrypted_bytes=${result.encryptedBytes}; free_bytes=${result.freeBytes}; plaintext_files=0\n`);
  } else if (command === "verify" && vaultPath && name) {
    const { path: root, freeBytes } = await assertVault(vaultPath);
    const encryptedPath = targetPath(root, name);
    const container = await readFile(encryptedPath);
    const plaintext = decryptBuffer(container);
    const hash = await hashFile(encryptedPath);
    const bytes = plaintext.length;
    plaintext.fill(0);
    container.fill(0);
    process.stdout.write(`decrypt_verify=PASS; sha256=${hash}; plaintext_bytes=${bytes}; plaintext_files=0; free_bytes=${freeBytes}\n`);
  } else {
    throw new Error("USAGE: self-test <absolute-vault-dir> | pipe-self-test <absolute-vault-dir> | export-wrangler <absolute-vault-dir> <name.gfsenc> | encrypt <absolute-vault-dir> <name.gfsenc> < SQL-on-stdin | verify <absolute-vault-dir> <name.gfsenc>");
  }
} catch {
  process.stderr.write("ENCRYPTED_VAULT_OPERATION_FAILED\n");
  process.exitCode = 1;
}
