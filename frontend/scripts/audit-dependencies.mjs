import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(frontendDirectory, "target/dependency-audit");
const auditArguments = [
  "audit", "--package-lock-only", "--include=dev", "--include=optional",
  "--include=peer", "--audit-level=info", "--json",
];
const severities = ["info", "low", "moderate", "high", "critical"];
const startedAt = new Date();
const metadata = {
  schemaVersion: 1,
  status: "failed",
  classification: "scan-error",
  startedAt: startedAt.toISOString(),
  nodeVersion: process.version,
  command: ["npm", ...auditArguments],
  scope: "package-lock.json: production, development, optional and peer dependencies",
  policy: "report-only; valid findings do not fail CI; scan errors fail CI",
};

function execute(command, arguments_) {
  return spawnSync(command, arguments_, {
    cwd: frontendDirectory,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function readCommand(command, arguments_) {
  const result = execute(command, arguments_);
  if (result.error || result.signal || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`Unable to read ${command} ${arguments_.join(" ")}`);
  }
  return result.stdout.trim();
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function fail(kind, message) {
  throw Object.assign(new Error(message), { kind });
}

function validateReport(report) {
  if (isObject(report) && report.error) fail("registry-error", "npm registry returned an audit error");
  if (!isObject(report) || report.auditReportVersion !== 2
      || !isObject(report.vulnerabilities) || !isObject(report.metadata)
      || !isObject(report.metadata.vulnerabilities) || !isObject(report.metadata.dependencies)) {
    fail("invalid-report", "Invalid npm audit report structure");
  }
  const counts = report.metadata.vulnerabilities;
  const dependencies = report.metadata.dependencies;
  if (![...severities, "total"].every((key) => validCount(counts[key]))
      || !["prod", "dev", "optional", "peer", "peerOptional", "total"]
        .every((key) => validCount(dependencies[key]))
      || dependencies.total === 0) {
    fail("invalid-report", "Invalid audit counts or no dependencies scanned");
  }
  const actualCounts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!isObject(vulnerability) || vulnerability.name !== name
        || !severities.includes(vulnerability.severity)
        || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0
        || !vulnerability.via.every((via) => (typeof via === "string" && via.length > 0)
          || (isObject(via) && typeof via.name === "string" && typeof via.title === "string"
            && typeof via.url === "string" && severities.includes(via.severity)))
        || !Array.isArray(vulnerability.nodes) || vulnerability.nodes.length === 0
        || !vulnerability.nodes.every((node) => typeof node === "string" && node.length > 0)) {
      fail("invalid-report", "Invalid vulnerability entry in npm audit report");
    }
    actualCounts[vulnerability.severity] += 1;
  }
  if (!severities.every((severity) => counts[severity] === actualCounts[severity])
      || counts.total !== Object.keys(report.vulnerabilities).length) {
    fail("invalid-report", "Audit vulnerability counts do not match report entries");
  }
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
let failure;
try {
  metadata.checkedOutCommit = readCommand("git", ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40,64}$/.test(metadata.checkedOutCommit)) throw new Error("Invalid checkout commit");
  if (process.env.PR_HEAD_SHA) {
    if (!/^[a-f0-9]{40,64}$/.test(process.env.PR_HEAD_SHA)) throw new Error("Invalid PR head commit");
    metadata.prHeadCommit = process.env.PR_HEAD_SHA;
  }
  metadata.npmVersion = readCommand("npm", ["--version"]);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(metadata.npmVersion)) {
    throw new Error("Invalid npm version");
  }
  const registry = new URL(readCommand("npm", ["config", "get", "registry"]));
  if (!["https:", "http:"].includes(registry.protocol)) throw new Error("Invalid npm registry URL");
  metadata.registryOrigin = registry.origin;
  const lockfilePath = resolve(frontendDirectory, "package-lock.json");
  const lockfile = readFileSync(lockfilePath);
  const parsedLockfile = JSON.parse(lockfile);
  if (!isObject(parsedLockfile.packages) || Object.keys(parsedLockfile.packages).length <= 1) {
    throw new Error("Lockfile has no dependency package entries");
  }
  metadata.lockfileSha256 = createHash("sha256").update(lockfile).digest("hex");
  metadata.lockfilePackageEntries = Object.keys(parsedLockfile.packages).length - 1;
  const result = execute("npm", auditArguments);
  metadata.auditExitCode = result.status;
  metadata.auditSignal = result.signal;
  writeFileSync(resolve(outputDirectory, "audit.json"), result.stdout ?? "");
  writeFileSync(resolve(outputDirectory, "npm-stderr.txt"), result.stderr ?? "");
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    fail("execution-error", "npm audit execution failed (network, registry, timeout or process error)");
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail("invalid-json", "npm audit did not return valid JSON");
  }
  validateReport(report);
  const expectedExitCode = report.metadata.vulnerabilities.total === 0 ? 0 : 1;
  if (result.status !== expectedExitCode) fail("inconsistent-exit-status", "npm audit exit status contradicts its report");
  if (createHash("sha256").update(readFileSync(lockfilePath)).digest("hex") !== metadata.lockfileSha256) {
    throw new Error("package-lock.json changed during audit");
  }
  metadata.status = "completed";
  metadata.classification = expectedExitCode === 0 ? "no-known-vulnerabilities" : "vulnerabilities-found";
  metadata.vulnerabilities = report.metadata.vulnerabilities;
  metadata.dependencies = report.metadata.dependencies;
} catch (error) {
  failure = error instanceof Error ? error.message : "Unexpected dependency audit error";
  metadata.errorKind = error?.kind ?? "preflight-or-output-error";
  metadata.error = failure;
}
metadata.finishedAt = new Date().toISOString();
metadata.durationSeconds = (Date.now() - startedAt.getTime()) / 1000;
writeFileSync(resolve(outputDirectory, "scan-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

const summary = [
  "### Frontend dependency audit",
  "",
  `Status: **${metadata.status} / ${metadata.classification}**`,
  `Checkout commit: \`${metadata.checkedOutCommit ?? "unavailable"}\``,
  ...(metadata.prHeadCommit ? [`PR head: \`${metadata.prHeadCommit}\``] : []),
  `Started: ${metadata.startedAt}; finished: ${metadata.finishedAt}`,
  `Node: ${metadata.nodeVersion}; npm: ${metadata.npmVersion ?? "unavailable"}`,
  `Lockfile SHA-256: \`${metadata.lockfileSha256 ?? "unavailable"}\``,
  `Scope: ${metadata.scope}.`,
  "",
  ...(metadata.status === "completed" ? [
    `Known vulnerable packages: **${metadata.vulnerabilities.total}**`,
    ...severities.map((severity) => `- ${severity}: ${metadata.vulnerabilities[severity]}`),
    `Dependency counts: ${JSON.stringify(metadata.dependencies)} (categories can overlap).`,
    "",
    "Findings are reported without a severity gate. Zero findings only describes this registry query; it is not a complete security assessment.",
  ] : [
    "**Scanning failed. No successful vulnerability baseline was produced.**",
    "Inspect scan-metadata.json, audit.json and npm-stderr.txt in the diagnostic artifact.",
  ]),
  "",
].join("\n");
writeFileSync(resolve(outputDirectory, "summary.md"), summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (failure) {
  console.error(`Dependency audit failed: ${failure}`);
  process.exitCode = 2;
}
