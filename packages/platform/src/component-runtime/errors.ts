import { ServiceError } from "@bedrock/foundation/kernel/errors";

import type {
  EffectiveStateScope,
  ComponentScopeType,
  ComponentState,
} from "./types";

export class ComponentRuntimeError extends ServiceError {}

export class ComponentManifestValidationError extends ComponentRuntimeError {
  constructor(public readonly issues: string[]) {
    super(`Invalid component manifests: ${issues.join("; ")}`);
  }
}

export class UnknownComponentError extends ComponentRuntimeError {
  constructor(public readonly componentId: string) {
    super(`Unknown component: ${componentId}`);
  }
}

export class ImmutableComponentError extends ComponentRuntimeError {
  constructor(public readonly componentId: string) {
    super(`Component is immutable: ${componentId}`);
  }
}

export class MixedDeployError extends ComponentRuntimeError {
  constructor(
    public readonly runtimeChecksum: string,
    public readonly localChecksum: string,
  ) {
    super(
      `Mixed deploy detected: runtime checksum ${runtimeChecksum} differs from local checksum ${localChecksum}`,
    );
  }
}

export class ComponentStateVersionConflictError extends ComponentRuntimeError {
  constructor(
    public readonly componentId: string,
    public readonly scopeType: ComponentScopeType,
    public readonly scopeId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(
      `Version conflict for component ${componentId} (${scopeType}:${scopeId}): expected=${expectedVersion}, actual=${actualVersion}`,
    );
  }
}

export class ComponentDependencyViolationError extends ComponentRuntimeError {
  constructor(
    public readonly componentId: string,
    public readonly dependencyComponentId: string,
    public readonly scope: EffectiveStateScope,
  ) {
    super(
      `Dependency violation: component ${componentId} requires ${dependencyComponentId} in scope ${scope.scopeType}:${scope.scopeId}`,
    );
  }
}

export class ComponentDisabledError extends ComponentRuntimeError {
  constructor(
    public readonly componentId: string,
    public readonly scope: EffectiveStateScope,
    public readonly effectiveState: ComponentState,
    public readonly dependencyChain: string[],
    public readonly retryAfterSec: number,
    public readonly reason: string,
  ) {
    super(
      `Component disabled: ${componentId} (${scope.scopeType}:${scope.scopeId}) reason=${reason}`,
    );
  }
}
