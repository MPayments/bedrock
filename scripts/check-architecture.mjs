import { ESLint } from "eslint";
import { cruise, format } from "dependency-cruiser";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHITECTURE_CRUISE_TARGETS,
  buildDependencyCruiserOptions,
  buildDependencyCruiserTsConfig,
} from "./guardrails/depcruise.config.mjs";
import { ARCHITECTURE_LINT_GLOBS } from "./guardrails/policy.mjs";
import { resolveRootDir } from "./lib/workspace-metadata.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHITECTURE_ESLINT_CONFIG = resolve(
  __dirname,
  "./guardrails/eslint.architecture.config.mjs",
);

export async function runDependencyCruiserCheck(rootDir = resolveRootDir()) {
  try {
    const result = await cruise(
      ARCHITECTURE_CRUISE_TARGETS,
      buildDependencyCruiserOptions(rootDir),
      undefined,
      { tsConfig: buildDependencyCruiserTsConfig(rootDir) },
    );

    const formatted = await format(result.output, { outputType: "err" });
    if (typeof formatted.output === "string" && formatted.output.trim()) {
      console.error(formatted.output.trimEnd());
    }

    if (formatted.exitCode === 0) {
      console.log("Dependency cruiser architecture check passed.");
    }

    return formatted.exitCode === 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function runArchitectureLint(rootDir = resolveRootDir()) {
  try {
    const eslint = new ESLint({
      cwd: rootDir,
      errorOnUnmatchedPattern: false,
      overrideConfigFile: ARCHITECTURE_ESLINT_CONFIG,
    });

    const results = await eslint.lintFiles(ARCHITECTURE_LINT_GLOBS);
    const formatter = await eslint.loadFormatter("stylish");
    const output = await formatter.format(results);
    const errorCount = results.reduce(
      (count, result) => count + result.errorCount,
      0,
    );
    const warningCount = results.reduce(
      (count, result) => count + result.warningCount,
      0,
    );

    if (output.trim()) {
      console.error(output.trimEnd());
    }

    if (errorCount === 0 && warningCount === 0) {
      console.log("Architecture ESLint check passed.");
    }

    return errorCount === 0 && warningCount === 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function runArchitectureCheck(rootDir = resolveRootDir()) {
  const [depcruiseOk, eslintOk] = await Promise.all([
    runDependencyCruiserCheck(rootDir),
    runArchitectureLint(rootDir),
  ]);

  return depcruiseOk && eslintOk;
}

const ok = await runArchitectureCheck();
if (!ok) {
  process.exit(1);
}
