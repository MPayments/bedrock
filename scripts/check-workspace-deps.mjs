import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const roots = [join(ROOT, "apps"), join(ROOT, "packages")];
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (
      name === "node_modules" ||
      name === "dist" ||
      name === "coverage" ||
      name === ".next"
    ) {
      continue;
    }

    let stats;
    try {
      stats = lstatSync(full);
    } catch {
      continue;
    }

    if (stats.isSymbolicLink()) {
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
    }

    if (stats.isDirectory()) {
      walk(full);
      continue;
    }
    if (name !== "package.json") continue;

    const rel = relative(ROOT, full);
    const json = JSON.parse(readFileSync(full, "utf8"));
    const sections = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ];

    for (const section of sections) {
      const deps = json[section];
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (name.startsWith("@bedrock/") && version === "*") {
          problems.push({ file: rel, section, name });
        }
      }
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (problems.length > 0) {
  console.error("Found internal dependencies pinned to \"*\" instead of workspace:*:");
  for (const problem of problems) {
    console.error(
      `- ${problem.file} (${problem.section}): ${problem.name} -> "*"`,
    );
  }
  process.exit(1);
}

console.log("Workspace dependency protocol check passed.");
