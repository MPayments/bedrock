import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_ROOTS = [
  join(ROOT, "packages", "core", "src", "documents"),
  join(ROOT, "packages", "core", "src", "ledger"),
  join(ROOT, "packages", "core", "src", "balances"),
  join(ROOT, "packages", "core", "src", "reconciliation"),
  join(ROOT, "packages", "application", "src", "accounting-reporting"),
  join(ROOT, "packages", "application", "src", "fees"),
  join(ROOT, "apps", "api", "src"),
  join(ROOT, "apps", "workers", "src"),
];
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".next",
  "tests",
]);

const FORBIDDEN_IMPORT_PATTERN =
  /(?:import|export)\s+[^"'`]*\b(?:ACCOUNT_NO|POSTING_CODE|CLEARING_KIND|OPERATION_CODE|POSTING_TEMPLATE_KEY)\b[^"'`]*from\s+["']@bedrock\/core\/accounting["']/g;
const FORBIDDEN_ACCOUNT_LITERAL_PATTERN =
  /\b(?:accountNo|debitAccountNo|creditAccountNo)\s*:\s*["']\d{4}["']/g;
const FORBIDDEN_POSTING_CODE_LITERAL_PATTERN =
  /\bpostingCode\s*:\s*["'][A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+["']/g;
const FORBIDDEN_OPERATION_CODE_LITERAL_PATTERN =
  /\boperationCode\s*:\s*["'][A-Z][A-Z0-9_]+["']/g;
const FORBIDDEN_TEMPLATE_KEY_LITERAL_PATTERN =
  /\btemplateKey\s*:\s*["'][a-z0-9_.]+["']/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name)) {
      continue;
    }

    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }

    if (!/\.(?:ts|tsx|mts|cts)$/.test(name)) {
      continue;
    }

    yield fullPath;
  }
}

function collectMatches(pattern, content) {
  const matches = [];
  pattern.lastIndex = 0;

  let match = pattern.exec(content);
  while (match) {
    matches.push(match[0]);
    match = pattern.exec(content);
  }

  return matches;
}

const problems = [];

for (const root of SOURCE_ROOTS) {
  if (!statSync(root, { throwIfNoEntry: false })) {
    continue;
  }

  for (const filePath of walk(root)) {
    const relPath = relative(ROOT, filePath);
    const content = readFileSync(filePath, "utf8");
    const forbiddenImports = collectMatches(FORBIDDEN_IMPORT_PATTERN, content);
    const forbiddenAccountLiterals = collectMatches(
      FORBIDDEN_ACCOUNT_LITERAL_PATTERN,
      content,
    );
    const forbiddenPostingCodeLiterals = collectMatches(
      FORBIDDEN_POSTING_CODE_LITERAL_PATTERN,
      content,
    );
    const forbiddenOperationCodeLiterals = collectMatches(
      FORBIDDEN_OPERATION_CODE_LITERAL_PATTERN,
      content,
    );
    const forbiddenTemplateKeyLiterals = collectMatches(
      FORBIDDEN_TEMPLATE_KEY_LITERAL_PATTERN,
      content,
    );

    if (forbiddenImports.length > 0) {
      problems.push({
        file: relPath,
        reason: `forbidden accounting constant import (${forbiddenImports[0]})`,
      });
    }

    if (forbiddenAccountLiterals.length > 0) {
      problems.push({
        file: relPath,
        reason: `hard-coded account number literal (${forbiddenAccountLiterals[0]})`,
      });
    }

    if (forbiddenPostingCodeLiterals.length > 0) {
      problems.push({
        file: relPath,
        reason: `hard-coded posting code literal (${forbiddenPostingCodeLiterals[0]})`,
      });
    }

    if (forbiddenOperationCodeLiterals.length > 0) {
      problems.push({
        file: relPath,
        reason: `hard-coded operation code literal (${forbiddenOperationCodeLiterals[0]})`,
      });
    }

    if (forbiddenTemplateKeyLiterals.length > 0) {
      problems.push({
        file: relPath,
        reason: `hard-coded template key literal (${forbiddenTemplateKeyLiterals[0]})`,
      });
    }
  }
}

if (problems.length > 0) {
  console.error("Accounting literal boundary check failed:");
  for (const problem of problems) {
    console.error(`- ${problem.file}: ${problem.reason}`);
  }
  process.exit(1);
}

console.log("Accounting literal boundary check passed.");
