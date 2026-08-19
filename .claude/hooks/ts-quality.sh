#!/usr/bin/env bash
# PostToolUse quality gate for the web/ Next.js project.
#
#   Phase 1  autofix silently   (eslint --fix)
#   Phase 2  collect what's left (eslint json + tsc --noEmit)
#   Phase 3  report to the agent (exit 2 -> stderr is fed back to Claude)
#
# Exit 0 = clean, agent sees nothing. Exit 2 = violations remain.
# Escape hatches: HOOK_SKIP_QUALITY=1 (whole gate), HOOK_SKIP_TSC=1 (typecheck only).

set -uo pipefail

[ "${HOOK_SKIP_QUALITY:-}" = "1" ] && exit 0

# Resolved before the cd below, so the reporter is found however the hook was invoked.
hook_dir=$(dirname "$0")

meta=$(node -e '
  let s = "";
  process.stdin.on("data", (d) => { s += d; });
  process.stdin.on("end", () => {
    let j = {};
    try { j = JSON.parse(s); } catch { /* malformed payload -> no-op below */ }
    const input = j.tool_input || {};
    process.stdout.write((j.tool_name || "") + "\n" + (input.file_path || "") + "\n");
  });
' 2>/dev/null)

tool_name=$(printf '%s\n' "$meta" | sed -n 1p)
file_path=$(printf '%s\n' "$meta" | sed -n 2p)

case "$tool_name" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac
[ -n "$file_path" ] || exit 0

# Claude Code hands us a Windows path; the linters run under Git Bash.
if command -v cygpath >/dev/null 2>&1; then
  unix_path=$(cygpath -u "$file_path" 2>/dev/null) || unix_path="$file_path"
else
  unix_path="$file_path"
fi
[ -f "$unix_path" ] || exit 0

# Exclusions first, so a generated file never matches on extension alone.
case "$unix_path" in
  */node_modules/*|*/.next/*|*/out/*|*/build/*|*/.git/*) exit 0 ;;
  *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

# Walk up to the owning package so the gate follows the file, not the session cwd.
root=$(cd "$(dirname "$unix_path")" 2>/dev/null && for _ in $(seq 1 20); do
  if [ -f package.json ] && [ -f tsconfig.json ]; then printf '%s' "$PWD"; break; fi
  [ "$PWD" = "/" ] && break
  cd .. || break
done)
[ -n "$root" ] || exit 0
[ -d "$root/node_modules" ] || exit 0

rel=$(realpath --relative-to="$root" "$unix_path" 2>/dev/null) || exit 0

cd "$root" || exit 0
cache="$root/node_modules/.cache/claude-hook"
mkdir -p "$cache" || exit 0
eslint_out="$cache/eslint.$$.json"
tsc_out="$cache/tsc.$$.txt"
trap 'rm -f "$eslint_out" "$tsc_out"' EXIT

# --fix writes fixes to disk and reports only what it could not fix, so phases 1
# and 2 collapse into a single eslint startup.
npx --no-install eslint --fix --no-warn-ignored -f json "$rel" > "$eslint_out" 2>/dev/null &
eslint_pid=$!

# Project-wide, but incremental against a cache outside the tracked tree. The lock
# keeps parallel edits from writing the same tsbuildinfo.
run_tsc() {
  [ "${HOOK_SKIP_TSC:-}" = "1" ] && return 0
  local lock="$cache/tsc.lock"
  local waited=0

  if [ -d "$lock" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
    rmdir "$lock" 2>/dev/null   # orphaned by a killed run
  fi
  until mkdir "$lock" 2>/dev/null; do
    waited=$((waited + 1))
    [ "$waited" -gt 25 ] && return 0   # another run owns the typecheck; let it report
    sleep 1
  done

  npx --no-install tsc --noEmit --pretty false --incremental \
    --tsBuildInfoFile "$cache/tsc.tsbuildinfo" > "$tsc_out" 2>&1
  rmdir "$lock" 2>/dev/null
}
run_tsc &
tsc_pid=$!

wait "$eslint_pid" 2>/dev/null
wait "$tsc_pid" 2>/dev/null

node "$hook_dir/report.mjs" "$eslint_out" "$tsc_out" "$rel" >&2
