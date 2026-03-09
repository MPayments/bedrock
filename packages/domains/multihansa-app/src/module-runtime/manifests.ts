import { compileModuleGraph, type ModuleManifest } from "@bedrock/modules";

import {
  MULTIHANSA_DOMAIN_MODULES,
  MULTIHANSA_FRAMEWORK_MODULES,
  MULTIHANSA_MODULES,
} from "../bundle";

const fullGraph = compileModuleGraph(MULTIHANSA_MODULES);
const frameworkModuleIds = new Set(MULTIHANSA_FRAMEWORK_MODULES.map((module) => module.id));
const domainModuleIds = new Set(MULTIHANSA_DOMAIN_MODULES.map((module) => module.id));

export const MULTIHANSA_DOMAIN_MODULE_MANIFESTS = fullGraph.manifests.filter(
  (manifest) => domainModuleIds.has(manifest.id),
) as readonly ModuleManifest[];

export const MULTIHANSA_APPLICATION_MODULE_MANIFESTS =
  MULTIHANSA_DOMAIN_MODULE_MANIFESTS;

export const MULTIHANSA_FRAMEWORK_MODULE_MANIFESTS = fullGraph.manifests.filter(
  (manifest) => frameworkModuleIds.has(manifest.id),
) as readonly ModuleManifest[];

export const MULTIHANSA_MODULE_MANIFESTS =
  fullGraph.manifests as readonly ModuleManifest[];

export type MultihansaApplicationModuleId =
  (typeof MULTIHANSA_DOMAIN_MODULES)[number]["id"];
export type MultihansaDomainModuleId = (typeof MULTIHANSA_DOMAIN_MODULES)[number]["id"];
export type MultihansaFrameworkModuleId =
  (typeof MULTIHANSA_FRAMEWORK_MODULES)[number]["id"];
export type MultihansaModuleId = (typeof MULTIHANSA_MODULES)[number]["id"];
