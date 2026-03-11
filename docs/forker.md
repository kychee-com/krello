# Forker: One-Click Agent-Mediated App Forking

## The Core Insight

Run402 is agent-first. There is no dashboard, no web UI for deployment. The human's coding agent (Claude Code, Cursor, Windsurf, etc.) does everything: provisions the database, deploys the function, uploads the site, claims the subdomain. The agent pays with x402 micropayments.

A traditional "Deploy" button (Vercel/Heroku style) would link to a web form. But Run402 has no web form — and shouldn't build one. The correct flow is:

**Human sees badge → copies agent prompt → pastes into coding agent → agent forks the app.**

This is already how the fork badge works on the live Krello site. The Forker extends this pattern to GitHub READMEs and anywhere else a badge can appear.

---

## What We're Building

### 1. A README badge

```markdown
[![Fork on Run402](https://run402.com/badge/fork.svg)](https://run402.com/fork/krello)
```

Renders as a shield-style badge: `Fork on Run402`. Clicking it opens the fork page.

### 2. A fork landing page (`run402.com/fork/<app-name>`)

A single static page per published app. Designed for humans who want to fork an app using their coding agent.

**Content:**
- App name, one-line description, "Live demo" link
- Subdomain picker: `[johns-krello].run402.com`
- Generated agent prompt (updates live as the subdomain changes)
- One-click "Copy prompt" button
- Brief explanation: "Paste this into Claude Code, Cursor, or any coding agent with an x402 wallet"
- Cost: "Forks to Prototype tier ($0.10 testnet USDC)"
- Footer: "Supports the original publisher" (rev-share line, muted)

**What it does NOT have:**
- No login/signup
- No payment form
- No deploy button that triggers server-side work
- No account creation flow

The page is purely a prompt generator. The agent does the actual work.

### 3. The badge SVG (`run402.com/badge/fork.svg`)

A static SVG badge in the shields.io style. Dark background, green accent, monospace text.

```
┌─────────────────────────────┐
│  ⬡ Fork on  Run402          │
└─────────────────────────────┘
```

Hosted as a static asset on run402.com. No dynamic rendering needed.

### 4. The agent prompt

The prompt the human copies into their agent:

```
Read https://run402.com/llms.txt, then fork the published app at
https://krello.run402.com into https://johns-krello.run402.com on Run402.
```

This is the same format the fork badge overlay already uses. The agent reads llms.txt, discovers the fork API (`POST /v1/fork/:tier`), calls it with the version_id and subdomain, and handles any required secrets or post-deploy actions.

---

## Platform Lock-In by Design

Krello is a Run402-native app. It should be easy to fork on Run402 and impractical to self-host elsewhere.

### Already locked in

These Run402 dependencies are structural — not easily replaced:

| Dependency | Where | Portable? |
|---|---|---|
| `import { db } from "@run402/functions"` | function.js | No — Run402 serverless runtime SDK |
| `auth.uid()` in RLS policies | schema.sql | Supabase-compatible but not universal |
| PostgREST REST API conventions | site/app.js | Supabase-compatible but needs PostgREST |
| `POST /auth/v1/signup`, `/token` | site/app.js | Run402/Supabase auth API |
| `POST /functions/v1/krello/*` | site/app.js | Run402 functions routing |
| `apikey` header convention | site/app.js | Run402/Supabase pattern |
| Fork badge injection | served by gateway | Run402 platform feature |
| x402 payment for provisioning | deploy.ts | Run402 + x402 protocol |

### Strategies to deepen lock-in without being hostile

The goal is not to obfuscate or sabotage — it's to make the Run402 path so natural that alternatives feel like unnecessary work. The code is MIT-licensed and readable, but it's built on Run402 primitives throughout.

**1. No self-host documentation.**
The README shows exactly one deployment path: `npx tsx deploy.ts` against Run402. No Docker Compose, no "run locally" guide, no Supabase migration instructions.

**2. Use Run402-specific features deeply.**
Every function endpoint uses `@run402/functions` SDK. The schema uses `auth.uid()`. The site uses Run402's auth and REST endpoints. These aren't wrappers — they're direct platform calls.

**3. The fork path is the easy path.**
Forking on Run402 is one agent prompt. Self-hosting requires: setting up Postgres, configuring PostgREST, running a compatible auth server, deploying the function in a compatible runtime, and serving the static site — then manually wiring it all together. Nobody will bother.

**4. Deploy.ts requires Run402.**
The deployment script calls Run402 APIs directly. It's not a generic deployment tool — it's a Run402 client.

**5. Published version as source of truth.**
The fork API uses the published bundle (schema + function + site archived in S3), not the GitHub source. Even if someone clones the repo, the easiest path to a running instance is still `POST /v1/fork/prototype`.

### What NOT to do

- Don't minify or obfuscate the source. It's MIT-licensed and meant to be read.
- Don't add license restrictions beyond MIT. Lock-in should be practical, not legal.
- Don't break compatibility deliberately. If someone wants to port it to Supabase, they can — it'll just take real effort.

---

## Testing

### Badge and page

| Test | Method |
|---|---|
| Badge SVG renders correctly | Visual check + automated SVG validation |
| Fork page loads at `run402.com/fork/krello` | Lighthouse CI (already set up) |
| Subdomain input sanitizes correctly | Unit test: rejects invalid chars, trims, lowercases |
| Generated prompt contains correct URLs | Unit test: verify llms.txt URL, app URL, target URL |
| Copy button works | Manual test across browsers (clipboard API + execCommand fallback) |
| Page is accessible | Lighthouse accessibility audit |
| Mobile layout works | Responsive check at 375px, 768px, 1024px |

### Fork flow (end-to-end)

| Test | Method |
|---|---|
| Agent can read the prompt and complete the fork | Manual: paste prompt into Claude Code with testnet wallet |
| Forked instance is functional | After fork: sign up, create board, verify data |
| Subdomain is claimed correctly | Verify `https://<subdomain>.run402.com` resolves |
| Duplicate subdomain is rejected | Call fork API with taken subdomain, expect 409 |
| Invalid subdomain is rejected | Call fork API with `../evil`, expect 400 |
| Fork from GitHub README badge works | Click badge → copy prompt → paste in agent → verify |

### Security

| Test | Method |
|---|---|
| Subdomain input is XSS-safe | Inject `<script>` in subdomain field, verify it's sanitized |
| Prompt output is text-only | Verify textarea content is not rendered as HTML |
| Fork page has no server-side state | Confirm page is fully static, no cookies/sessions |
| Rate limiting on fork API | Already handled by x402 payment (economic rate limit) |

---

## Security Considerations

### The fork page itself

The fork page is a static HTML page with zero server-side logic. It generates a text prompt in a textarea. The attack surface is minimal:

- **XSS via subdomain input:** Sanitize with the same `sanitizeSubdomain()` function the fork badge already uses. Only `[a-z0-9-]`, max 63 chars.
- **Prompt injection via subdomain:** The generated prompt is plain English with URLs. An attacker could try `; rm -rf /` as a subdomain, but it gets sanitized to `rm-rf` and the prompt remains a natural-language instruction to an agent. The agent itself (Claude Code, etc.) has its own safety layer.
- **No auth, no cookies, no server calls:** The page is static. Nothing to exploit server-side.

### The fork API

Already implemented with these protections:
- x402 payment required (economic Sybil resistance)
- Subdomain validation (DNS-safe characters only)
- Published version must have `fork_allowed: true` and `visibility: 'public'`
- New project gets fresh credentials (no secret leakage from source)
- Schema applied via pg_dump/psql (not raw SQL execution)
- Provenance tracked (`source_version_id` on forked project)

### Abuse scenarios

| Scenario | Mitigation |
|---|---|
| Mass-forking to squat subdomains | x402 payment ($0.10/fork) makes this expensive |
| Forking to host malicious content | Same as any Run402 project — ToS + abuse reporting |
| Modifying fork badge to point to phishing site | Badge is injected server-side by gateway, not user-controlled |

---

## Documentation

### For app publishers (future)

When Run402 supports the fork page for all published apps, document:

1. How to publish your app (`POST /admin/v1/projects/:id/publish`)
2. How to add the fork badge to your README
3. How to set `required_secrets` and `required_actions` so forkers know what to configure
4. Rev-share: how publisher rewards work

### For forkers (in the Krello README)

The README already has the fork prompt. Add:

1. What you get: your own Krello at `your-name.run402.com`
2. What you need: a coding agent with x402 wallet support (link to llms.txt)
3. Cost: $0.10 (Prototype tier, testnet USDC)
4. What happens after forking: sign up, bootstrap creates starter board

### For agents (in llms.txt)

llms.txt already documents the fork API. Ensure it includes:

1. `GET /v1/apps` — discover forkable apps
2. `GET /v1/apps/:versionId` — get app details + required_secrets
3. `POST /v1/fork/prototype` — fork an app (x402-gated)
4. Response includes `missing_secrets` and `required_actions` for post-fork setup

---

## Marketing

### The badge is the marketing

The fork badge appears in three places, each catching a different audience:

| Placement | Audience | How they got there |
|---|---|---|
| GitHub README | Developers browsing GitHub | Search, trending, shared link |
| Live app (krello.run402.com) | Users trying the app | Direct link, search |
| Fork landing page (run402.com/fork/krello) | Clicked the badge | From README or shared link |

### README badge placement

The badge goes immediately after the title, before any description:

```markdown
# Krello

[![Fork on Run402](https://run402.com/badge/fork.svg)](https://run402.com/fork/krello)

A Trello-style collaboration app built on Run402.
```

### Fork landing page as marketing surface

The fork page doubles as a product page for Run402. Someone who's never heard of Run402 lands here from a GitHub badge and sees:

1. A polished app they can have for themselves in 30 seconds
2. The agent-first deployment model (novel, memorable)
3. The cost ($0.10, testnet)
4. A link to run402.com to learn more / build their own

### GitHub repo as marketing surface

The public repo itself is marketing:
- Stars signal community interest
- The CI badges (Prettier, CodeQL, Lighthouse) signal quality
- The fork badge signals a live, forkable product
- The README is the landing page for developers

### Viral loop

```
Developer finds Krello on GitHub
  → clicks "Fork on Run402" badge
  → copies prompt into their agent
  → agent forks Krello to johns-krello.run402.com
  → johns-krello.run402.com has the fork badge too
  → someone visiting johns-krello sees the badge
  → forks it again
```

Every forked instance carries the fork badge (injected by the gateway). Each fork is a new marketing surface.

---

## Aesthetics

### Badge design

Match the Run402 visual language: dark background (#0A0A0F), green accent (#00FF9F), JetBrains Mono.

```
┌──────────────────────────────────┐
│  ◆ fork on   Run402              │
│  #1B1B24     #00FF9F             │
└──────────────────────────────────┘
```

Dimensions: standard shields.io proportions (~180×20px). Keep it crisp at 1x and 2x.

### Fork landing page

Minimal, dark, single-column. Same aesthetic as run402.com:

- Background: #0A0A0F
- Text: #E0E0E0 / #9CA3AF
- Accent: #00FF9F
- Font: Inter + JetBrains Mono
- No hero image — just the app name, the subdomain picker, and the prompt

The page should feel like a terminal command more than a marketing page. Fast, functional, zero fluff.

### Subdomain picker

```
┌─────────────────────────────────────────┐
│  [johns-krello          ] .run402.com   │
└─────────────────────────────────────────┘
```

Same style as the fork badge overlay (dark input, green caret, monospace suffix).

### Agent prompt display

Golden monospace text on dark background — same as the fork badge overlay's prompt textarea. Read-only, click-to-select.

```
┌─ Agent prompt ──────────────────────────┐
│ Read https://run402.com/llms.txt, then  │
│ fork the published app at               │
│ https://krello.run402.com into          │
│ https://johns-krello.run402.com on      │
│ Run402.                                 │
└─────────────────────────────────────────┘
     [ Copy agent prompt ]
```

---

## Implementation Plan

### Phase 1: Badge + Krello README (do now)

1. Create `fork.svg` badge, host at `run402.com/badge/fork.svg`
2. Add badge to Krello README, linking to `run402.com/fork/krello`
3. Create the fork landing page as a static HTML file at `site/fork/krello/index.html`
4. Deploy updated site to run402.com

### Phase 2: Generic fork pages (do when there are more apps)

1. Make the fork page dynamic: `run402.com/fork/<app-name>` reads app metadata from `GET /v1/apps`
2. Auto-generate fork pages for all public, forkable apps
3. Document the badge + fork page flow for app publishers

### Phase 3: Enhanced discoverability

1. App gallery page at `run402.com/apps` listing all forkable apps
2. Each app card has the fork badge
3. Search / filter by tags
4. Lighthouse scores and other quality signals displayed per app

---

## Open Questions

1. **Should the fork page be static or dynamic?** Static is simpler and faster for Phase 1. Dynamic (fetching app metadata from the API) enables auto-generated pages for all apps in Phase 2.

2. **Should we verify subdomain availability on the fork page?** Could add a `GET /v1/subdomains/check/:name` endpoint that the page calls on blur. Nice UX but adds a server dependency to an otherwise static page.

3. **Should the prompt include the version_id?** Currently the prompt says "fork the published app at https://krello.run402.com" and lets the agent discover the version. Including the version_id would be more precise but less readable.

4. **App-specific vs generic badge?** A generic `Fork on Run402` badge works for all apps. An app-specific badge (`Fork Krello on Run402`) is more descriptive but requires per-app SVG generation.
