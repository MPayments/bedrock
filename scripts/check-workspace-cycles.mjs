import { collectWorkspacePackages } from "./lib/workspace-packages.mjs";

const sections = ["dependencies", "peerDependencies", "optionalDependencies"];

const workspacePackages = collectWorkspacePackages();
const names = new Map(workspacePackages.map((pkg) => [pkg.name, pkg]));
const graph = new Map(
  workspacePackages.map((pkg) => {
    const deps = new Set();
    for (const section of sections) {
      for (const dependencyName of Object.keys(pkg.packageJson[section] ?? {})) {
        if (names.has(dependencyName) && dependencyName !== pkg.name) {
          deps.add(dependencyName);
        }
      }
    }
    return [pkg.name, [...deps].sort()];
  }),
);

let index = 0;
const stack = [];
const onStack = new Set();
const indices = new Map();
const lowLinks = new Map();
const stronglyConnected = [];

function visit(name) {
  indices.set(name, index);
  lowLinks.set(name, index);
  index += 1;
  stack.push(name);
  onStack.add(name);

  for (const dependency of graph.get(name) ?? []) {
    if (!indices.has(dependency)) {
      visit(dependency);
      lowLinks.set(
        name,
        Math.min(lowLinks.get(name), lowLinks.get(dependency)),
      );
      continue;
    }

    if (onStack.has(dependency)) {
      lowLinks.set(name, Math.min(lowLinks.get(name), indices.get(dependency)));
    }
  }

  if (lowLinks.get(name) !== indices.get(name)) {
    return;
  }

  const component = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }
    onStack.delete(current);
    component.push(current);
    if (current === name) {
      break;
    }
  }

  if (component.length > 1) {
    stronglyConnected.push(component.sort());
  }
}

for (const pkg of workspacePackages) {
  if (!indices.has(pkg.name)) {
    visit(pkg.name);
  }
}

if (stronglyConnected.length > 0) {
  console.error("Workspace package dependency cycle check failed:");
  for (const component of stronglyConnected) {
    console.error(`- ${component.join(" -> ")}`);
  }
  process.exit(1);
}

console.log("Workspace package dependency cycle check passed.");
