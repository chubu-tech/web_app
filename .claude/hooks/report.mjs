// Formats the quality gate's findings for the main agent.
// stdout: the report — ts-quality.sh pipes it to stderr, which is where Claude reads it.
// exit 2: errors remain, the edit needs another pass.  exit 0: clean, or warnings only.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ELSEWHERE_SHOWN = 5;
const TSC_LINE = /^(.+?)\((\d+),(\d+)\): (?:error|warning) (TS\d+): (.*)$/;

const readOrEmpty = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function collectEslint(jsonPath, rel) {
  const errors = [];
  const warnings = [];

  let results;
  try {
    results = JSON.parse(readOrEmpty(jsonPath) || "[]");
  } catch {
    results = null;
  }
  // An eslint crash must not block the edit — report nothing rather than everything.
  if (!Array.isArray(results)) return { errors, warnings };

  for (const { messages = [] } of results) {
    for (const m of messages) {
      const rule = m.ruleId ? `  (${m.ruleId})` : "";
      const entry = `  ${rel}:${m.line ?? 0}:${m.column ?? 0}  ${m.message}${rule}`;
      (m.severity === 2 ? errors : warnings).push(entry);
    }
  }
  return { errors, warnings };
}

function collectTsc(outPath, rel) {
  // tsc runs project-wide, so split its errors by whether they land on the edited file.
  // resolve() rather than string compare: it settles ./ prefixes and separator style.
  const target = resolve(rel);
  const here = [];
  const elsewhere = [];

  for (const line of readOrEmpty(outPath).split(/\r?\n/)) {
    const m = TSC_LINE.exec(line);
    if (!m) continue;
    const [, file, lineNo, column, code, message] = m;
    const entry = `  ${file}:${lineNo}:${column}  ${code}: ${message}`;
    (resolve(file) === target ? here : elsewhere).push(entry);
  }
  return { here, elsewhere };
}

function formatReport(rel, eslint, tsc) {
  const errorCount = eslint.errors.length + tsc.here.length + tsc.elsewhere.length;
  const warningCount = eslint.warnings.length;
  if (!errorCount && !warningCount) return null;

  const counts = [];
  if (errorCount) counts.push(plural(errorCount, "error"));
  if (warningCount) counts.push(plural(warningCount, "warning"));

  const tag = errorCount ? "[hook]" : "[hook:advisory]";
  const call = errorCount ? " — fix before continuing" : "";
  const lines = [`${tag} ${rel} — ${counts.join(", ")}${call}`];

  if (eslint.errors.length) lines.push("", "eslint:", ...eslint.errors);
  if (eslint.warnings.length) lines.push("", "eslint (warnings):", ...eslint.warnings);
  if (tsc.here.length) lines.push("", "tsc:", ...tsc.here);
  if (tsc.elsewhere.length) {
    const heading = `tsc — ${plural(tsc.elsewhere.length, "error")} this edit surfaced elsewhere:`;
    lines.push("", heading, ...tsc.elsewhere.slice(0, ELSEWHERE_SHOWN));
    const hidden = tsc.elsewhere.length - ELSEWHERE_SHOWN;
    if (hidden > 0) lines.push(`  …and ${hidden} more (run: npx tsc --noEmit)`);
  }

  return { text: lines.join("\n"), errorCount };
}

const [eslintPath, tscPath, rel] = process.argv.slice(2);
const report = formatReport(rel, collectEslint(eslintPath, rel), collectTsc(tscPath, rel));

if (!report) process.exit(0);
console.log(report.text);
process.exit(report.errorCount > 0 ? 2 : 0);
