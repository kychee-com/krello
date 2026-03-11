# Krello

A Trello-style collaboration app built on [Run402](https://run402.com).

**Live demo:** [krello.run402.com](https://krello.run402.com)

## Features

- Multi-user boards with invite links and roles (owner, admin, member, viewer)
- Drag-and-drop lists and cards
- Rich cards: labels, assignees, checklists, comments, due dates, priorities, estimates, link attachments
- Board templates (blank, sprint, roadmap, studio)
- Board duplication and JSON export
- Email/password auth via Run402
- Responsive, no-build static SPA

## Fork it

The fastest way to get your own Krello is to fork it on Run402. Paste this into your coding agent:

```
Read https://run402.com/llms.txt, then fork the published app at https://krello.run402.com into https://my-krello.run402.com on Run402.
```

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

## Deploy manually

Requires a Run402 project. Set these environment variables:

```
BUYER_PRIVATE_KEY=0x...
ADMIN_KEY=...
BASE_URL=https://api.run402.com  # optional, this is the default
```

Then:

```bash
npx tsx deploy.ts
```

The script provisions a project, applies the schema, deploys the function and site, claims a subdomain, publishes a forkable version, and pins the project.

## License

MIT
