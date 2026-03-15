import { readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import {
  CODE_EXTENSIONS,
  ROOT,
  getImports,
  listFiles,
} from "./lib/workspace-packages.mjs";

const LEGACY_SPECIFIER_PATTERN =
  /@bedrock\/(?:platform-[^"'/]+(?:\/|["'])|(?:core|money|reference-data)(?:\/|["'])|(?:application|runtime|modules)(?:\/|["'])|(?:(adapter|integration|extension)-[^"'/]+)|(?:party-types|query-accounting-reporting|observability|persistence|identity|client-api|ui)(?:\/|["'])|(?:customers|counterparties)(?:\/|["'])|users\/validation(?:\/|["'])|organizations\/validation(?:\/|["'])|balances\/validation(?:\/|["'])|parties\/validation(?:\/|["'])|requisites\/(?:validation|providers|providers\/contracts|providers\/validation)(?:\/|["'])|documents\/(?:module-kit|financial-lines|validation|state-machine|form-types)(?:\/|["'])|ledger\/infra\/tigerbeetle(?:\/|["']))/g;

const SOURCE_ROOTS = [
  join(ROOT, "apps"),
  join(ROOT, "packages"),
  join(ROOT, "ops"),
  join(ROOT, "scripts"),
  join(ROOT, "tests"),
].filter((root) => {
  try {
    return listFiles(root, CODE_EXTENSIONS).length >= 0;
  } catch {
    return false;
  }
});

const violations = [];

for (const root of SOURCE_ROOTS) {
  for (const file of listFiles(root, CODE_EXTENSIONS)) {
    const content = readFileSync(file, "utf8");
    const relFile = relative(ROOT, file);
    const extension = extname(file);

    if (extension === ".json") {
      LEGACY_SPECIFIER_PATTERN.lastIndex = 0;
      const match = LEGACY_SPECIFIER_PATTERN.exec(content);

      if (match) {
        violations.push({
          file: relFile,
          specifier: match[0].replace(/["']$/, ""),
        });
      }

      continue;
    }

    for (const specifier of getImports(content)) {
      LEGACY_SPECIFIER_PATTERN.lastIndex = 0;
      const match = LEGACY_SPECIFIER_PATTERN.exec(specifier);
      if (!match) {
        continue;
      }

      violations.push({
        file: relFile,
        specifier: match[0].replace(/["']$/, ""),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Deprecated runtime import specifiers found:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`);
  }
  process.exit(1);
}

console.log("Deprecated runtime import check passed.");
