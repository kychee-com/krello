import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const rootDir = dirname(fileURLToPath(import.meta.url));
const siteDir = join(rootDir, "site");
const APP_URL = "https://krello.run402.com";

const EXISTING_PROJECT = process.env.KRELLO_PROJECT_ID || "";
const EXISTING_ANON_KEY = process.env.KRELLO_ANON_KEY || "";

function cli(...args: string[]): string {
  return execFileSync("run402", args, { encoding: "utf-8" }).trim();
}

function cliJson(...args: string[]) {
  return JSON.parse(cli(...args));
}

function withTempFile<T>(name: string, data: string, fn: (path: string) => T): T {
  const path = join(rootDir, name);
  writeFileSync(path, data);
  try {
    return fn(path);
  } finally {
    try { unlinkSync(path); } catch {}
  }
}

function buildManifest(anonKey: string, subdomain?: string) {
  const manifest: Record<string, unknown> = {
    name: "krello",
    migrations: readFileSync(join(rootDir, "schema.sql"), "utf-8"),
    functions: [{
      name: "krello",
      code: readFileSync(join(rootDir, "function.js"), "utf-8"),
      config: { timeout: 30, memory: 256 },
    }],
    secrets: [{ key: "KRELLO_APP_URL", value: APP_URL }],
    site: loadSiteFiles(anonKey),
  };
  if (subdomain) manifest.subdomain = subdomain;
  return manifest;
}

function main() {
  console.log("=== Krello Deploy ===\n");

  let projectId = EXISTING_PROJECT;
  let anonKey = EXISTING_ANON_KEY;

  if (projectId && anonKey) {
    console.log(`1) Redeploying project: ${projectId}\n`);
    const manifest = buildManifest(anonKey);
    const result = withTempFile(".deploy-manifest.json", JSON.stringify(manifest), (path) => {
      return cliJson("deploy", "--manifest", path);
    });
    console.log(`   Site: ${result.site_url || result.subdomain_url || APP_URL}`);
  } else {
    console.log("1) Provisioning project...");
    const bootstrapManifest = {
      name: "krello",
      migrations: readFileSync(join(rootDir, "schema.sql"), "utf-8"),
      functions: [{
        name: "krello",
        code: readFileSync(join(rootDir, "function.js"), "utf-8"),
        config: { timeout: 30, memory: 256 },
      }],
      secrets: [{ key: "KRELLO_APP_URL", value: APP_URL }],
    };

    const result = withTempFile(".deploy-manifest.json", JSON.stringify(bootstrapManifest), (path) => {
      return cliJson("deploy", "--manifest", path);
    });

    projectId = result.project_id;
    anonKey = result.anon_key;
    console.log(`   Project: ${projectId}`);

    console.log("\n2) Redeploying with site and subdomain...");
    const fullManifest = buildManifest(anonKey, "krello");
    withTempFile(".deploy-full.json", JSON.stringify(fullManifest), (path) => {
      const redeployResult = cliJson("deploy", "--manifest", path);
      console.log(`   Site: ${redeployResult.site_url || redeployResult.subdomain_url || APP_URL}`);
    });
  }

  console.log("\n3) Publishing forkable version...");
  cli("apps", "publish", projectId,
    "--description", "Beautiful Trello-style collaboration app for run402 with multi-user boards, invite links, rich cards, and export/duplicate flows.",
    "--tags", "kanban,boards,collaboration,auth,starter,trello,run402",
    "--visibility", "public",
    "--fork-allowed");
  console.log("   Published");

  console.log("\n=== Krello Live ===");
  console.log(`Site: ${APP_URL}`);
  console.log(`Project: ${projectId}`);
  console.log(`Anon Key: ${anonKey}`);
}

function loadSiteFiles(anonKey: string) {
  const files: Array<{ file: string; data: string }> = [];

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir)) {
      const absolute = join(currentDir, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        walk(absolute);
        continue;
      }

      let data = readFileSync(absolute, "utf-8");
      if (entry === "index.html") {
        data = data.replace('apikey: "",', `apikey: "${anonKey}",`);
      }

      files.push({
        file: relative(siteDir, absolute).replace(/\\/g, "/"),
        data,
      });
    }
  }

  walk(siteDir);
  return files;
}

main();
