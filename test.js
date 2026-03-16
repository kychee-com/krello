import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Re-create the pure utility functions from function.js so they can be tested
// in isolation (function.js imports @run402/functions which isn't available
// outside the Run402 runtime).
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertUuid(value, label) {
  if (!UUID_RE.test(String(value || ""))) {
    throw httpError(400, `${label} is invalid`);
  }
  return String(value);
}

function normalizeTheme(value) {
  const themes = new Set(["sunrise", "cobalt", "gallery", "aurora", "ember", "harbor"]);
  return themes.has(value) ? value : "sunrise";
}

function normalizeAccent(value) {
  const accents = new Set(["ember", "gold", "rose", "moss", "cobalt", "sand", "mist"]);
  return accents.has(value) ? value : "ember";
}

function normalizePriority(value) {
  return ["low", "medium", "high", "urgent"].includes(value) ? value : "medium";
}

function normalizeInviteRole(value) {
  if (value === "admin" || value === "member" || value === "viewer") return value;
  return "member";
}

function sanitizeText(value, min, max, message) {
  const text = String(value || "").trim();
  if (text.length < min || text.length > max) throw httpError(400, message);
  return text;
}

function sanitizeOptionalText(value, max) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function sanitizeUrl(value) {
  const url = String(value || "").trim();
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
    return parsed.toString();
  } catch {
    throw httpError(400, "Link URL must be valid");
  }
}

function inferDisplayName(email) {
  const local = String(email || "").split("@")[0] || "Builder";
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return (
    spaced
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ") || "Builder"
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Syntax checks
// ---------------------------------------------------------------------------

describe("syntax", () => {
  it("function.js parses as valid JavaScript", async () => {
    // node --check validates syntax including ESM imports
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    await promisify(execFile)("node", ["--check", "function.js"]);
  });

  it("site/app.js parses as valid JavaScript", () => {
    const src = readFileSync("site/app.js", "utf-8");
    new Function(src);
  });
});

// ---------------------------------------------------------------------------
// Schema structure
// ---------------------------------------------------------------------------

describe("schema", () => {
  const schema = readFileSync("schema.sql", "utf-8");

  it("creates all expected tables", () => {
    const expected = [
      "profiles", "boards", "board_members", "board_invites",
      "labels", "lists", "cards", "card_labels", "card_members",
      "checklist_items", "comments", "card_links", "board_activity",
    ];
    for (const table of expected) {
      assert.ok(schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `missing table: ${table}`);
    }
  });

  it("enables RLS on all tables", () => {
    const tables = [
      "profiles", "boards", "board_members", "board_invites",
      "labels", "lists", "cards", "card_labels", "card_members",
      "checklist_items", "comments", "card_links", "board_activity",
    ];
    for (const table of tables) {
      assert.ok(schema.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`), `RLS not enabled: ${table}`);
    }
  });

  it("forces RLS on all tables", () => {
    const tables = [
      "profiles", "boards", "board_members", "board_invites",
      "labels", "lists", "cards", "card_labels", "card_members",
      "checklist_items", "comments", "card_links", "board_activity",
    ];
    for (const table of tables) {
      assert.ok(schema.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`), `RLS not forced: ${table}`);
    }
  });
});

// ---------------------------------------------------------------------------
// UUID validation
// ---------------------------------------------------------------------------

describe("assertUuid", () => {
  it("accepts a valid v4 UUID", () => {
    assert.equal(assertUuid("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "Test"), "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
  });

  it("rejects empty string", () => {
    assert.throws(() => assertUuid("", "Test"), { statusCode: 400 });
  });

  it("rejects null", () => {
    assert.throws(() => assertUuid(null, "Test"), { statusCode: 400 });
  });

  it("rejects malformed UUID", () => {
    assert.throws(() => assertUuid("not-a-uuid", "Test"), { statusCode: 400 });
  });

  it("rejects UUID with wrong version nibble", () => {
    assert.throws(() => assertUuid("a1b2c3d4-e5f6-0a7b-8c9d-0e1f2a3b4c5d", "Test"), { statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

describe("normalizeTheme", () => {
  it("returns valid theme unchanged", () => {
    assert.equal(normalizeTheme("cobalt"), "cobalt");
    assert.equal(normalizeTheme("aurora"), "aurora");
  });

  it("falls back to sunrise for invalid theme", () => {
    assert.equal(normalizeTheme("neon"), "sunrise");
    assert.equal(normalizeTheme(""), "sunrise");
    assert.equal(normalizeTheme(undefined), "sunrise");
  });
});

describe("normalizeAccent", () => {
  it("returns valid accent unchanged", () => {
    assert.equal(normalizeAccent("rose"), "rose");
    assert.equal(normalizeAccent("moss"), "moss");
  });

  it("falls back to ember for invalid accent", () => {
    assert.equal(normalizeAccent("purple"), "ember");
    assert.equal(normalizeAccent(null), "ember");
  });
});

describe("normalizePriority", () => {
  it("returns valid priority unchanged", () => {
    assert.equal(normalizePriority("urgent"), "urgent");
    assert.equal(normalizePriority("low"), "low");
  });

  it("falls back to medium for invalid priority", () => {
    assert.equal(normalizePriority("critical"), "medium");
    assert.equal(normalizePriority(""), "medium");
  });
});

describe("normalizeInviteRole", () => {
  it("returns valid roles unchanged", () => {
    assert.equal(normalizeInviteRole("admin"), "admin");
    assert.equal(normalizeInviteRole("viewer"), "viewer");
  });

  it("falls back to member for invalid role", () => {
    assert.equal(normalizeInviteRole("owner"), "member");
    assert.equal(normalizeInviteRole("superadmin"), "member");
    assert.equal(normalizeInviteRole(""), "member");
  });
});

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

describe("sanitizeText", () => {
  it("trims and returns valid text", () => {
    assert.equal(sanitizeText("  hello  ", 2, 80, "err"), "hello");
  });

  it("rejects text below minimum length", () => {
    assert.throws(() => sanitizeText("a", 2, 80, "too short"), { statusCode: 400 });
  });

  it("rejects text above maximum length", () => {
    assert.throws(() => sanitizeText("a".repeat(81), 2, 80, "too long"), { statusCode: 400 });
  });

  it("rejects empty/null input", () => {
    assert.throws(() => sanitizeText(null, 2, 80, "required"), { statusCode: 400 });
    assert.throws(() => sanitizeText("", 2, 80, "required"), { statusCode: 400 });
  });
});

describe("sanitizeOptionalText", () => {
  it("returns text within limit", () => {
    assert.equal(sanitizeOptionalText("hello", 10), "hello");
  });

  it("truncates text exceeding limit", () => {
    assert.equal(sanitizeOptionalText("hello world", 5), "hello");
  });

  it("handles null/undefined", () => {
    assert.equal(sanitizeOptionalText(null, 10), "");
    assert.equal(sanitizeOptionalText(undefined, 10), "");
  });
});

describe("sanitizeUrl", () => {
  it("accepts https URLs", () => {
    assert.equal(sanitizeUrl("https://example.com"), "https://example.com/");
  });

  it("accepts http URLs", () => {
    assert.equal(sanitizeUrl("http://example.com/path"), "http://example.com/path");
  });

  it("rejects ftp URLs", () => {
    assert.throws(() => sanitizeUrl("ftp://example.com"), { statusCode: 400 });
  });

  it("rejects javascript: URLs", () => {
    assert.throws(() => sanitizeUrl("javascript:alert(1)"), { statusCode: 400 });
  });

  it("rejects empty input", () => {
    assert.throws(() => sanitizeUrl(""), { statusCode: 400 });
  });

  it("rejects garbage input", () => {
    assert.throws(() => sanitizeUrl("not a url"), { statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// Display name inference
// ---------------------------------------------------------------------------

describe("inferDisplayName", () => {
  it("capitalizes email local part", () => {
    assert.equal(inferDisplayName("alice@example.com"), "Alice");
  });

  it("splits on dots, dashes, underscores", () => {
    assert.equal(inferDisplayName("john.doe@example.com"), "John Doe");
    assert.equal(inferDisplayName("jane-smith@example.com"), "Jane Smith");
    assert.equal(inferDisplayName("bob_jones@example.com"), "Bob Jones");
  });

  it("limits to 3 words", () => {
    assert.equal(inferDisplayName("a.b.c.d@example.com"), "A B C");
  });

  it("returns Builder for empty input", () => {
    assert.equal(inferDisplayName(""), "Builder");
    assert.equal(inferDisplayName(null), "Builder");
  });
});

// ---------------------------------------------------------------------------
// Utility: unique
// ---------------------------------------------------------------------------

describe("unique", () => {
  it("deduplicates values", () => {
    assert.deepEqual(unique(["a", "b", "a", "c"]), ["a", "b", "c"]);
  });

  it("filters out falsy values", () => {
    assert.deepEqual(unique(["a", null, undefined, "", "b"]), ["a", "b"]);
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(unique([]), []);
  });
});

// ---------------------------------------------------------------------------
// Google OAuth / social login integration
// ---------------------------------------------------------------------------

describe("social login", () => {
  const appSrc = readFileSync("site/app.js", "utf-8");

  it("includes PKCE verifier generation", () => {
    assert.ok(appSrc.includes("generateCodeVerifier"), "missing generateCodeVerifier");
  });

  it("includes PKCE challenge generation", () => {
    assert.ok(appSrc.includes("generateCodeChallenge"), "missing generateCodeChallenge");
  });

  it("stores PKCE verifier in sessionStorage", () => {
    assert.ok(appSrc.includes("sessionStorage.setItem(PKCE_KEY"), "PKCE verifier not stored in sessionStorage");
  });

  it("cleans up PKCE verifier after use", () => {
    assert.ok(appSrc.includes("sessionStorage.removeItem(PKCE_KEY"), "PKCE verifier not cleaned up");
  });

  it("calls the correct OAuth start endpoint", () => {
    assert.ok(appSrc.includes("/auth/v1/oauth/google/start"), "missing OAuth start endpoint");
  });

  it("exchanges code with authorization_code grant type", () => {
    assert.ok(appSrc.includes("grant_type=authorization_code"), "missing authorization_code grant");
  });

  it("sends code_challenge_method S256", () => {
    assert.ok(appSrc.includes('code_challenge_method: "S256"'), "missing S256 challenge method");
  });

  it("extracts OAuth callback code from hash fragment", () => {
    assert.ok(appSrc.includes("extractOAuthCallback"), "missing extractOAuthCallback");
    assert.ok(appSrc.includes("[#&]code=([^&]+)"), "missing hash code extraction regex");
  });

  it("renders a Google sign-in button", () => {
    assert.ok(appSrc.includes('data-action="google-login"'), "missing Google login button");
    assert.ok(appSrc.includes("Continue with Google"), "missing button label");
  });

  it("handles google-login click action", () => {
    assert.ok(appSrc.includes('"google-login"'), "missing google-login action handler");
    assert.ok(appSrc.includes("loginWithGoogle"), "missing loginWithGoogle call");
  });

  it("clears hash after extracting OAuth code", () => {
    assert.ok(appSrc.includes("history.replaceState"), "OAuth callback does not clean up hash");
  });
});

// ---------------------------------------------------------------------------
// Deploy script (CLI-based)
// ---------------------------------------------------------------------------

describe("deploy", () => {
  const deploySrc = readFileSync("deploy.ts", "utf-8");

  it("deploy.ts exists and is non-empty", () => {
    assert.ok(deploySrc.length > 100, "deploy.ts is too short");
  });

  it("uses run402 CLI instead of raw API calls", () => {
    assert.ok(deploySrc.includes('execFileSync("run402"'), "should call run402 CLI");
    assert.ok(!deploySrc.includes("x402Client"), "should not use x402Client");
    assert.ok(!deploySrc.includes("wrapFetchWithPayment"), "should not use wrapFetchWithPayment");
    assert.ok(!deploySrc.includes("privateKeyToAccount"), "should not use viem");
    assert.ok(!deploySrc.includes('from "dotenv"'), "should not use dotenv");
  });

  it("uses CLI for project provisioning", () => {
    assert.ok(deploySrc.includes('"deploy", "--manifest"'), "should use run402 deploy --manifest");
  });

  it("uses CLI for schema migration", () => {
    assert.ok(deploySrc.includes('"projects", "sql"'), "should use run402 projects sql");
  });

  it("uses CLI for function deployment", () => {
    assert.ok(deploySrc.includes('"functions", "deploy"'), "should use run402 functions deploy");
  });

  it("uses CLI for secrets", () => {
    assert.ok(deploySrc.includes('"secrets", "set"'), "should use run402 secrets set");
  });

  it("uses CLI for site deployment", () => {
    assert.ok(deploySrc.includes('"sites", "deploy"'), "should use run402 sites deploy");
  });

  it("uses CLI for publishing", () => {
    assert.ok(deploySrc.includes('"apps", "publish"'), "should use run402 apps publish");
  });

  it("injects apikey into index.html", () => {
    assert.ok(deploySrc.includes('apikey: "",'), "should replace apikey placeholder");
  });

  it("cleans up temp manifest files", () => {
    assert.ok(deploySrc.includes("unlinkSync"), "should clean up temp files");
  });

  it("supports existing project reuse via env vars", () => {
    assert.ok(deploySrc.includes("KRELLO_PROJECT_ID"), "should support KRELLO_PROJECT_ID");
    assert.ok(deploySrc.includes("KRELLO_ANON_KEY"), "should support KRELLO_ANON_KEY");
  });
});

// ---------------------------------------------------------------------------
// OAuth profile support in function.js
// ---------------------------------------------------------------------------

describe("OAuth profile support", () => {
  const fnSrc = readFileSync("function.js", "utf-8");

  it("uses OAuth display_name from user object", () => {
    assert.ok(fnSrc.includes("user.display_name"), "ensureProfile should check user.display_name");
  });

  it("falls back to email inference when no display_name", () => {
    assert.ok(fnSrc.includes("inferDisplayName(user.email)"), "should fall back to inferDisplayName");
  });
});

// ---------------------------------------------------------------------------
// CSS styles for social login
// ---------------------------------------------------------------------------

describe("social login styles", () => {
  const css = readFileSync("site/styles.css", "utf-8");

  it("has Google button styles", () => {
    assert.ok(css.includes(".google-btn"), "missing .google-btn class");
  });

  it("has or-divider styles", () => {
    assert.ok(css.includes(".or-divider"), "missing .or-divider class");
  });
});

// ---------------------------------------------------------------------------
// Documentation accuracy
// ---------------------------------------------------------------------------

describe("documentation", () => {
  const readme = readFileSync("README.md", "utf-8");
  const forker = readFileSync("docs/forker.md", "utf-8");

  it("README mentions Google OAuth", () => {
    assert.ok(readme.includes("Google OAuth"), "README should mention Google OAuth");
  });

  it("README references CLI-based deployment", () => {
    assert.ok(readme.includes("CLI-based deployment"), "README should reference CLI deployment");
  });

  it("forker doc references run402 CLI", () => {
    assert.ok(forker.includes("run402 deploy"), "forker should reference run402 deploy");
    assert.ok(forker.includes("run402 apps fork"), "forker should reference run402 apps fork");
  });

  it("forker doc uses current fork API path", () => {
    assert.ok(forker.includes("POST /fork/v1"), "forker should use /fork/v1 path");
  });

  it("forker doc references Google OAuth endpoint", () => {
    assert.ok(forker.includes("/oauth/google/start"), "forker should reference OAuth endpoint");
  });
});
