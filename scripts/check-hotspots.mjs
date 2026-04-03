import { existsSync, readFileSync } from "node:fs";

import { HOTSPOT_EXEMPTIONS } from "./hotspot-exemptions.mjs";

const DEFAULT_THRESHOLD = 700;
const SOURCE_FILE_PATTERN =
  /^(apps|packages|scripts|tests)\/.+\.(?:ts|tsx|js|mjs|cjs)$/;
const IGNORED_SEGMENTS = [
  "/.next/",
  "/.turbo/",
  "/coverage/",
  "/dist/",
  "/node_modules/",
];
const TEST_FILE_PATTERN = /(?:^|\/)tests\/|\.test\.(?:ts|tsx|js|mjs|cjs)$/;

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isRelevantFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!SOURCE_FILE_PATTERN.test(normalized)) {
    return false;
  }
  if (TEST_FILE_PATTERN.test(normalized)) {
    return false;
  }

  return !IGNORED_SEGMENTS.some((segment) => normalized.includes(segment));
}

function countLines(content) {
  return content.split("\n").length;
}

const threshold = Number(process.env.BEDROCK_HOTSPOT_THRESHOLD ?? DEFAULT_THRESHOLD);
const inputFiles = process.argv
  .slice(2)
  .map((filePath) => normalizePath(filePath))
  .filter((filePath, index, files) => files.indexOf(filePath) === index)
  .filter(isRelevantFile)
  .filter((filePath) => existsSync(filePath));

if (inputFiles.length === 0) {
  console.log("Hotspot check skipped: no changed runtime source files.");
  process.exit(0);
}

const oversizedFiles = inputFiles
  .map((filePath) => ({
    exemptionReason: HOTSPOT_EXEMPTIONS[filePath] ?? null,
    filePath,
    lineCount: countLines(readFileSync(filePath, "utf8")),
  }))
  .filter((entry) => entry.lineCount > threshold)
  .sort((left, right) => right.lineCount - left.lineCount);

const exemptedFiles = oversizedFiles.filter((entry) => entry.exemptionReason);
const violations = oversizedFiles.filter((entry) => !entry.exemptionReason);

if (exemptedFiles.length > 0) {
  console.log(
    `Hotspot check: ${exemptedFiles.length} oversized runtime file(s) explicitly exempted:`,
  );
  for (const exemptedFile of exemptedFiles) {
    console.log(
      `- ${exemptedFile.filePath}: ${exemptedFile.lineCount} lines (${exemptedFile.exemptionReason})`,
    );
  }
}

if (violations.length === 0) {
  console.log(
    `Hotspot check passed. No changed runtime source files exceed ${threshold} lines without an explicit exemption.`,
  );
  process.exit(0);
}

console.error(
  `Hotspot check failed. Changed runtime source files must stay at or below ${threshold} lines unless explicitly exempted:`,
);
for (const violation of violations) {
  console.error(`- ${violation.filePath}: ${violation.lineCount} lines`);
}

process.exit(1);
