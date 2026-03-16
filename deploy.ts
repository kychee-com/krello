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

function main() {
  console.log("=== Krello Deploy ===\n");

  let projectId = EXISTING_PROJECT;
  let anonKey = EXISTING_ANON_KEY;

  if (projectId && anonKey) {
    console.log(`1) Reusing project: ${projectId}\n`);

    console.log("2) Applying schema...");
    cli("projects", "sql", projectId, readFileSync(join(rootDir, "schema.sql"), "utf-8"));
    console.log("   Schema ready");

    console.log("\n3) Setting secrets...");
    cli("secrets", "set", projectId, "KRELLO_APP_URL", APP_URL);
    console.log("   KRELLO_APP_URL set");

    console.log("\n4) Deploying function...");
    cli("functions", "deploy", projectId, "krello",
      "--code", join(rootDir, "function.js"),
      "--timeout", "30", "--memory", "256");
    console.log("   Function deployed");

    console.log("\n5) Deploying site...");
    const siteManifest = JSON.stringify({ files: loadSiteFiles(anonKey) });
    withTempFile(".deploy-site.json", siteManifest, (path) => {
      cli("sites", "deploy", "--name", "krello", "--manifest", path, "--project", projectId);
    });
    console.log("   Site deployed");
  } else {
    console.log("1) Deploying full stack...");
    const manifest = {
      name: "krello",
      migrations: readFileSync(join(rootDir, "schema.sql"), "utf-8"),
      functions: [{
        name: "krello",
        code: readFileSync(join(rootDir, "function.js"), "utf-8"),
        config: { timeout: 30, memory: 256 },
      }],
      secrets: [{ key: "KRELLO_APP_URL", value: APP_URL }],
      subdomain: "krello",
    };

    const result = withTempFile(".deploy-manifest.json", JSON.stringify(manifest), (path) => {
      return cliJson("deploy", "--manifest", path);
    });

    projectId = result.project_id;
    anonKey = result.anon_key;
    console.log(`   Project: ${projectId}`);

    console.log("\n2) Deploying site with credentials...");
    const siteManifest = JSON.stringify({ files: loadSiteFiles(anonKey) });
    withTempFile(".deploy-site.json", siteManifest, (path) => {
      cli("sites", "deploy", "--name", "krello", "--manifest", path, "--project", projectId);
    });
    console.log("   Site deployed");
  }

  console.log("\n6) Publishing forkable version...");
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
