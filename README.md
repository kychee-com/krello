# Krello

A Trello-style collaboration app built on [Run402](https://run402.com).

[![Format](https://github.com/kychee-com/krello/actions/workflows/format.yml/badge.svg)](https://github.com/kychee-com/krello/actions/workflows/format.yml)
[![CodeQL](https://github.com/kychee-com/krello/actions/workflows/codeql.yml/badge.svg)](https://github.com/kychee-com/krello/actions/workflows/codeql.yml)
[![Lighthouse](https://github.com/kychee-com/krello/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/kychee-com/krello/actions/workflows/lighthouse.yml)

**Live demo:** [krello.run402.com](https://krello.run402.com)

## Fork it

Get your own Krello in 30 seconds. Pick a subdomain and paste this into your coding agent (Claude Code, Cursor, Windsurf, etc.):

```
Read https://run402.com/llms.txt, then fork the published app at https://krello.run402.com into https://my-krello.run402.com on Run402.
```

Replace `my-krello` with any available subdomain. Costs $0.10 in testnet USDC.

## Features

- Multi-user boards with invite links and roles (owner, admin, member, viewer)
- Drag-and-drop lists and cards
- Rich cards: labels, assignees, checklists, comments, due dates, priorities, estimates, link attachments
- Board templates (blank, sprint, roadmap, studio)
- Board duplication and JSON export
- Email/password auth via Run402
- Responsive, no-build static SPA

## Project structure

```
schema.sql     Postgres schema with RLS policies
function.js    Run402 function (board lifecycle, invites, roles)
deploy.ts      Deployment script for Run402
site/
  index.html   SPA entrypoint
  app.js       Application logic
  styles.css   Styles
  favicon.svg  App icon
```

## License

MIT
