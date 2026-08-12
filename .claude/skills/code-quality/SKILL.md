---
name: code-quality
description: Use on any code change. Enforces code-quality principles — DRY, single responsibility, early returns, lookup objects over if-chains, strict TypeScript (no any), Zod at every runtime boundary, minimal comments.
---

# Code Quality Principles

Applies to every code change in this codebase.

## DRY, but not prematurely

- Don't copy a 20-line block twice. Extract a helper.
- Don't extract a helper for three similar but-not-identical lines — you'll end up with parameters that paper over the differences. Inline repetition beats a premature abstraction.
- Shared utilities live in your shared package directory when they're used across apps; otherwise keep them local to the feature.

## Single responsibility

- One function should do one thing. If you're writing `fetchAndScoreAndNotifyUser`, split it.
- One component should render one conceptual surface. Break wrappers apart when a child needs props its parent doesn't.

## Early returns

```ts
// Good
function getStatus(u: User) {
  if (!u.isVerified) return 'unverified';
  if (!u.hasOnboarded) return 'draft';
  return 'active';
}

// Bad — nested
function getStatus(u: User) {
  if (u.isVerified) {
    if (u.hasOnboarded) {
      return 'active';
    } else {
      return 'draft';
    }
  } else {
    return 'unverified';
  }
}
```

## Lookup objects over if-chains

```ts
// Good
const statusLabel: Record<Status, string> = {
  active: 'Active',
  draft: 'Draft',
  unverified: 'Unverified',
};
return statusLabel[status];

// Bad
if (status === 'active') return 'Active';
if (status === 'draft') return 'Draft';
if (status === 'unverified') return 'Unverified';
```

Exhaustiveness check with `never`:

```ts
function assertNever(x: never): never { throw new Error(`unhandled: ${x}`); }
// switch-based lookup with assertNever in default is acceptable; if-chains aren't.
```

## Strict TypeScript

- No `any`. Use `unknown` + narrowing.
- Prefer discriminated unions over optional booleans for state.
- Type component state explicitly when inference is ambiguous.

## Runtime validation

- Zod at every runtime boundary: tRPC input, API response parsing, form submissions, reading from local storage, reading from URL params.
- Inside a trusted boundary, rely on TS types — don't parse again.

## Comments

- Self-documenting names first. A good name beats a comment.
- Comments allowed only when the why is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, behaviour that would surprise a reader.
- No comments that restate the code. No TODOs without a linked ticket.

## What "done" looks like

- No `any`.
- No nested-if pyramids when early returns or lookup objects would do.
- No extracted helpers with five parameters papering over three different call sites.
- No drive-by comments that restate the code.
- `pnpm build && pnpm test && pnpm lint && pnpm format` pass.
