import { ServiceError } from "@bedrock/kernel/errors";

import type {
  EffectiveStateScope,
  ModuleScopeType,
  ModuleState,
} from "./types";

export class ModuleRuntimeError extends ServiceError {}

export class ModuleManifestValidationError extends ModuleRuntimeError {
  constructor(public readonly issues: string[]) {
    super(`Invalid module manifests: ${issues.join("; ")}`);
  }
}

export class UnknownModuleError extends ModuleRuntimeError {
  constructor(public readonly moduleId: string) {
    super(`Unknown module: ${moduleId}`);
  }
}

export class ImmutableModuleError extends ModuleRuntimeError {
  constructor(public readonly moduleId: string) {
    super(`Module is immutable: ${moduleId}`);
  }
}

export class MixedDeployError extends ModuleRuntimeError {
  constructor(
    public readonly runtimeChecksum: string,
    public readonly localChecksum: string,
  ) {
    super(
      `Mixed deploy detected: runtime checksum ${runtimeChecksum} differs from local checksum ${localChecksum}`,
    );
  }
}

export class ModuleStateVersionConflictError extends ModuleRuntimeError {
  constructor(
    public readonly moduleId: string,
    public readonly scopeType: ModuleScopeType,
    public readonly scopeId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(
      `Version conflict for module ${moduleId} (${scopeType}:${scopeId}): expected=${expectedVersion}, actual=${actualVersion}`,
    );
  }
}

export class ModuleDependencyViolationError extends ModuleRuntimeError {
  constructor(
    public readonly moduleId: string,
    public readonly dependencyModuleId: string,
    public readonly scope: EffectiveStateScope,
  ) {
    super(
      `Dependency violation: module ${moduleId} requires ${dependencyModuleId} in scope ${scope.scopeType}:${scope.scopeId}`,
    );
  }
}

export class ModuleDisabledError extends ModuleRuntimeError {
  constructor(
    public readonly moduleId: string,
    public readonly scope: EffectiveStateScope,
    public readonly effectiveState: ModuleState,
    public readonly dependencyChain: string[],
    public readonly retryAfterSec: number,
    public readonly reason: string,
  ) {
    super(
      `Module disabled: ${moduleId} (${scope.scopeType}:${scope.scopeId}) reason=${reason}`,
    );
  }
}
