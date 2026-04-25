import {
  buildWorkspaceTsConfig,
  collectWorkspacePackages,
  resolveExportSubpathTargets,
  resolveRootDir,
} from "../lib/workspace-metadata.mjs";
import {
  ALLOWED_PACKAGE_KIND_DEPENDENCIES,
  ARCHITECTURE_CRUISE_TARGETS,
  DB_IMPORT_ALLOW_PATTERNS,
  SCHEMA_IMPORT_ALLOW_PATTERNS,
} from "./policy.mjs";

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function sourceRootPattern(relDir) {
  return `^${escapeRegex(relDir)}/`;
}

function runtimeSourcePattern(relDir) {
  return `^${escapeRegex(relDir)}/src/`;
}

function pathAlternation(paths) {
  if (paths.length === 0) {
    return "^$";
  }

  if (paths.length === 1) {
    return paths[0];
  }

  return `(?:${paths.join("|")})`;
}

function exactPathPattern(relPath) {
  return `^${escapeRegex(relPath)}$`;
}

function dirPathPattern(relDir) {
  return `^${escapeRegex(relDir)}/`;
}

function byName(workspacePackages) {
  return new Map(workspacePackages.map((pkg) => [pkg.name, pkg]));
}

function buildCircularRule() {
  return {
    name: "no-circular-workspace-dependencies",
    comment: "Workspace source files must not participate in circular imports.",
    severity: "error",
    from: {
      path: "^(apps|packages)/",
    },
    to: {
      circular: true,
      path: "^(apps|packages)/",
    },
  };
}

function buildKindRules(workspacePackages) {
  return workspacePackages.flatMap((pkg) => {
    const allowedKinds = ALLOWED_PACKAGE_KIND_DEPENDENCIES[pkg.kind];
    if (!allowedKinds) {
      return [];
    }

    const disallowedTargets = workspacePackages.filter(
      (candidate) =>
        candidate.name !== pkg.name && !allowedKinds.has(candidate.kind),
    );

    if (disallowedTargets.length === 0) {
      return [];
    }

    return [
      {
        name: `kind-dependency-${pkg.name.replaceAll("@", "").replaceAll("/", "-")}`,
        comment: `Package kind ${pkg.kind} must not depend on disallowed workspace kinds.`,
        severity: "error",
        from: {
          path: runtimeSourcePattern(pkg.relDir),
        },
        to: {
          path: pathAlternation(
            disallowedTargets.map((candidate) =>
              dirPathPattern(candidate.relDir),
            ),
          ),
        },
      },
    ];
  });
}

function buildWorkspacePathRule() {
  return {
    name: "workspace-path-imports",
    comment:
      "Imports must not use repo-root paths such as packages/* or apps/*.",
    severity: "error",
    from: {
      path: "^(apps|packages|scripts|tests)/",
    },
    to: {
      couldNotResolve: true,
      path: "^(?:apps|infra|packages)/|^/",
    },
  };
}

function buildSchemaRules(workspacePackages) {
  const packageNames = new Map(workspacePackages.map((pkg) => [pkg.name, pkg]));

  return Object.entries(SCHEMA_IMPORT_ALLOW_PATTERNS).flatMap(
    ([packageName, allowPatterns]) => {
      const pkg = packageNames.get(packageName);
      if (!pkg) {
        return [];
      }

      const targets = resolveExportSubpathTargets(pkg, "./schema");
      if (targets.length === 0) {
        return [];
      }

      return [
        {
          name: `schema-zones-${packageName.replaceAll("@", "").replaceAll("/", "-")}`,
          comment:
            "Cross-package schema imports stay confined to approved aggregation zones.",
          severity: "error",
          from: {
            path: "^(apps|packages|scripts|tests)/",
            pathNot: [...allowPatterns, sourceRootPattern(pkg.relDir)],
          },
          to: {
            path: pathAlternation(
              targets.map((target) => exactPathPattern(target)),
            ),
          },
        },
      ];
    },
  );
}

function buildDbImportRules(workspacePackages) {
  const packagesByName = byName(workspacePackages);
  const platformPkg = packagesByName.get("@bedrock/platform");
  if (!platformPkg) {
    return [];
  }

  const targets = resolveExportSubpathTargets(
    platformPkg,
    "./persistence/postgres",
  );
  if (targets.length === 0) {
    return [];
  }

  return [
    {
      name: "db-import-outside-approved-zones",
      comment:
        "Only apps, integration tests, and approved scripts may construct the shared postgres client.",
      severity: "error",
      from: {
        path: "^(apps|packages|scripts|tests)/",
        pathNot: DB_IMPORT_ALLOW_PATTERNS,
      },
      to: {
        path: pathAlternation(
          targets.map((target) => exactPathPattern(target)),
        ),
      },
    },
  ];
}

function buildDependencyCruiserRuleSet(rootDir = resolveRootDir()) {
  const workspacePackages = collectWorkspacePackages(rootDir);

  return {
    forbidden: [
      buildCircularRule(),
      ...buildKindRules(workspacePackages),
      buildWorkspacePathRule(),
      ...buildSchemaRules(workspacePackages),
      ...buildDbImportRules(workspacePackages),
    ],
  };
}

export function buildDependencyCruiserOptions(rootDir = resolveRootDir()) {
  return {
    baseDir: rootDir,
    combinedDependencies: true,
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: [
        "npm",
        "npm-bundled",
        "npm-dev",
        "npm-no-pkg",
        "npm-optional",
        "npm-peer",
      ],
    },
    enhancedResolveOptions: {
      conditionNames: ["import", "node", "default"],
      exportsFields: ["exports"],
    },
    exclude:
      "(^|/)(coverage|dist|node_modules)(/|$)|(^|/)(\\.next|\\.turbo)(/|$)|\\.d\\.(ts|tsx|mts|cts)$",
    ruleSet: buildDependencyCruiserRuleSet(rootDir),
    validate: true,
  };
}

export function buildDependencyCruiserTsConfig(rootDir = resolveRootDir()) {
  return buildWorkspaceTsConfig(rootDir, collectWorkspacePackages(rootDir));
}

export { ARCHITECTURE_CRUISE_TARGETS };
