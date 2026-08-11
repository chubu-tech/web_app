# web — the Bhutan Salons web monorepo

Two independent Next.js applications in one repository. They share a database and
a brand; they share no code, no build and no `node_modules`.

| Directory | What it is | Deployed as |
| --- | --- | --- |
| [`landing_page/`](landing_page) | The public marketing site — one route, statically prerendered, no auth. Serves **bhutansalons.com**. | Root directory `landing_page` |
| [`tho_web/`](tho_web) | The Tho product in a browser — customers book and queue, owners run the salon, staff see their day. | Not yet deployed |

The platform is **Bhutan Salons**. The app you download is **Tho**.

## Run either app

Each app is self-contained: its own `package.json`, its own `package-lock.json`,
its own `node_modules`, its own `.env.local`. Nothing at the root is required to
build or run either one.

```bash
cd landing_page && npm install && npm run dev   # http://localhost:3000
cd tho_web      && npm install && npm run dev   # http://localhost:3000
```

Both default to port 3000, so to run them at the same time give one a different
port: `npm run dev -- -p 3001`.

The root `package.json` is a convenience only — it has no dependencies and
declares no workspaces. Each script is a `cd` into an app:

```bash
npm run install:all     # install both
npm run dev:landing     # or dev:app
npm run build:landing   # or build:app
npm run test:app        # tho_web's vitest suite
```

## Why there is no npm workspace

Deliberate, and the reason is deployment. The marketing site builds with its
**root directory set to `landing_page`**, which means the platform runs
`npm install` and `npm run build` inside that directory and never sees the
repository root. A hoisted root `node_modules` and a single root lockfile would
make the build depend on files outside the directory it is told to build from —
the one thing a per-app root directory setting is meant to rule out.

So each app keeps the lockfile it already had, and the two cannot conflict
because they never meet. The cost is that a shared dependency is installed twice
and the two can drift apart in version; both are on Next 16.2.12 and React
19.2.4 today. Workspaces can be adopted later if that cost starts to bite — it is
a change to make on purpose, with the deployment settings changed in the same
breath, not a default to inherit.

`landing_page/netlify.toml` lives inside the app rather than at the root for the
same reason: its `publish = ".next"` is resolved relative to the configured base
directory.

## History

This repository **is** the former `chubu-tech/landing_dashboard`, renamed. Its
twelve commits are untouched and their SHAs are unchanged — `0597abd`, the
initial landing page commit, still resolves. The landing page's files moved into
`landing_page/` in one commit that changed no content: 64 files, 0 insertions, 0
deletions, every blob hash identical.

`tho_web` was imported from `chubu-tech/tho_web` with its nineteen commits
rewritten to sit under `tho_web/`, so both of these work:

```bash
git log -- tho_web/lib/hours.ts        # its real history, not just the import
git blame tho_web/lib/hours.ts         # real authors, real dates
```

The two halves are asymmetric on purpose. `tho_web`'s commits were rewritten and
so have new SHAs; the landing page's were **not**, because rewriting them would
change every SHA in a repository that is already pushed and already deployed, and
would need a force-push. The landing page's own history is reached with
`--follow`, which traverses the move:

```bash
git log --follow -- landing_page/app/page.tsx
```

`chubu-tech/tho_web` is deliberately left in place and unmodified. Nothing here
depends on deleting it.

### One quirk worth knowing

`tho_web/`'s files were re-checked-out during the import, so on Windows with
`core.autocrlf=true` they now have CRLF line endings while `landing_page/`'s have
LF. Committed content is identical either way — git stores LF — and `git status`
is clean. It is the state a fresh clone produces on such a machine. There is
deliberately no root `.gitattributes` pinning this: adding one would renormalise
one half of the tree and produce a large diff that says nothing.
