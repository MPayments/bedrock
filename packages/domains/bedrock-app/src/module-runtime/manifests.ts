import { compileModuleGraph, type ModuleManifest } from "@bedrock/modules";

import {
  BEDROCK_DOMAIN_MODULES,
  BEDROCK_FRAMEWORK_MODULES,
  BEDROCK_MODULES,
} from "../bundle";

const fullGraph = compileModuleGraph(BEDROCK_MODULES);
const frameworkModuleIds = new Set(BEDROCK_FRAMEWORK_MODULES.map((module) => module.id));
const domainModuleIds = new Set(BEDROCK_DOMAIN_MODULES.map((module) => module.id));

export const BEDROCK_DOMAIN_MODULE_MANIFESTS = fullGraph.manifests.filter(
  (manifest) => domainModuleIds.has(manifest.id),
) as readonly ModuleManifest[];

export const BEDROCK_APPLICATION_MODULE_MANIFESTS =
  BEDROCK_DOMAIN_MODULE_MANIFESTS;

export const BEDROCK_FRAMEWORK_MODULE_MANIFESTS = fullGraph.manifests.filter(
  (manifest) => frameworkModuleIds.has(manifest.id),
) as readonly ModuleManifest[];

export const BEDROCK_MODULE_MANIFESTS =
  fullGraph.manifests as readonly ModuleManifest[];

export type BedrockApplicationModuleId =
  (typeof BEDROCK_DOMAIN_MODULES)[number]["id"];
export type BedrockDomainModuleId = (typeof BEDROCK_DOMAIN_MODULES)[number]["id"];
export type BedrockFrameworkModuleId =
  (typeof BEDROCK_FRAMEWORK_MODULES)[number]["id"];
export type BedrockModuleId = (typeof BEDROCK_MODULES)[number]["id"];
