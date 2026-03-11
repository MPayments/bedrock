import {
  defineProvider,
  bedrockError,
  isBedrockError,
  token,
  type Provider,
  type BedrockError,
  type Token,
} from "@bedrock/core";
import { ZodError, z } from "zod";

const ENV_LOAD_METADATA = Symbol.for("@bedrock/config-env/load-metadata");

export type ConfigLoadContext<TSchema extends z.ZodTypeAny> = {
  name: string;
  token: Token<z.output<TSchema>>;
  schema: TSchema;
};

export type ConfigLoader<TSchema extends z.ZodTypeAny> = (
  ctx: ConfigLoadContext<TSchema>,
) => z.input<TSchema> | Promise<z.input<TSchema>>;

export type ConfigDescriptor<
  TName extends string = string,
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = Readonly<{
  kind: "config";
  name: TName;
  schema: TSchema;
  token: Token<z.output<TSchema>>;
  load: ConfigLoader<TSchema>;
  provider(): Provider<z.output<TSchema>>;
}>;

export type InferConfig<TConfig extends ConfigDescriptor<any, any>> = z.output<
  TConfig["schema"]
>;

export type EnvBag = Record<string, string | undefined>;

export type EnvFieldOptions = {
  name?: string;
  aliases?: readonly string[];
  secret?: boolean;
};

export type EnvConfigLoaderOptions = {
  env?: EnvBag | (() => EnvBag);
  prefix?: string;
  fields?: Record<string, EnvFieldOptions>;
};

type EnvFieldMetadata = {
  path: string;
  envNames: readonly string[];
  resolvedEnvName?: string;
  provided: boolean;
  value?: string;
  secret: boolean;
};

type EnvLoadMetadata = {
  source: "env";
  fields: readonly EnvFieldMetadata[];
};

type ObjectWithEnvMetadata = Record<string, unknown> & {
  [ENV_LOAD_METADATA]?: EnvLoadMetadata;
};

export function defineConfig<
  TName extends string,
  TSchema extends z.ZodTypeAny,
>(
  name: TName,
  options: {
    schema: TSchema;
    load: ConfigLoader<TSchema>;
    token?: Token<z.output<TSchema>>;
  },
): ConfigDescriptor<TName, TSchema> {
  let descriptor!: ConfigDescriptor<TName, TSchema>;

  descriptor = Object.freeze({
    kind: "config" as const,
    name,
    schema: options.schema,
    token: options.token ?? token<z.output<TSchema>>(`config:${name}`),
    load: options.load,
    provider: () => createConfigProvider(descriptor),
  });

  return descriptor;
}

export function createConfigProvider<
  TName extends string,
  TSchema extends z.ZodTypeAny,
>(
  config: ConfigDescriptor<TName, TSchema>,
): Provider<z.output<TSchema>> {
  return defineProvider({
    provide: config.token,
    scope: "singleton",
    useFactory: async () => {
      let loaded: unknown;

      try {
        loaded = await config.load({
          name: config.name,
          token: config.token,
          schema: config.schema,
        });
      } catch (error) {
        throw wrapConfigLoadError(config.name, error);
      }

      try {
        return await config.schema.parseAsync(loaded);
      } catch (error) {
        throw wrapConfigValidationError(config.name, error, loaded);
      }
    },
  });
}

export function createEnvConfigLoader<
  TSchema extends z.ZodTypeAny,
>(
  options: EnvConfigLoaderOptions = {},
): ConfigLoader<TSchema> {
  return ({ name, schema }) => {
    const rootSchema = unwrapEnvObjectSchema(schema);

    if (!(rootSchema instanceof z.ZodObject)) {
      throw bedrockError({
        message: `Config "${name}" must use an object schema with createEnvConfigLoader().`,
        code: "BEDROCK_CONFIG_LOAD_ERROR",
        details: {
          configName: name,
          source: "env",
        },
      });
    }

    const envBag = resolveEnvBag(options.env);
    const result: ObjectWithEnvMetadata = {};
    const fields = collectEnvFields(rootSchema, options.fields ?? {}, name);

    for (const field of fields) {
      const resolved = resolveEnvField(field, envBag, options.prefix);

      if (resolved.provided && resolved.value !== undefined) {
        setPathValue(result, field.path, resolved.value);
      }
    }

    Object.defineProperty(result, ENV_LOAD_METADATA, {
      value: Object.freeze({
        source: "env" as const,
        fields: Object.freeze(
          fields.map((field) =>
            Object.freeze(resolveEnvField(field, envBag, options.prefix)),
          ),
        ),
      }),
      enumerable: false,
      configurable: false,
      writable: false,
    });

    return result as z.input<TSchema>;
  };
}

type EnvFieldDefinition = {
  path: readonly string[];
  override?: EnvFieldOptions;
};

function collectEnvFields(
  schema: z.ZodObject<any>,
  overrides: Record<string, EnvFieldOptions>,
  configName: string,
): readonly EnvFieldDefinition[] {
  const fields: EnvFieldDefinition[] = [];
  const knownPaths = new Set<string>();

  walkObjectSchema(schema, [], fields, knownPaths);

  for (const overridePath of Object.keys(overrides)) {
    if (!knownPaths.has(overridePath)) {
      throw bedrockError({
        message: `Config "${configName}" declares env override for unknown field path "${overridePath}".`,
        code: "BEDROCK_CONFIG_LOAD_ERROR",
        details: {
          configName,
          source: "env",
          path: overridePath,
        },
      });
    }
  }

  return fields.map((field) => ({
    path: field.path,
    override: overrides[field.path.join(".")],
  }));
}

function walkObjectSchema(
  schema: z.ZodObject<any>,
  basePath: readonly string[],
  fields: EnvFieldDefinition[],
  knownPaths: Set<string>,
): void {
  for (const [key, value] of Object.entries(schema.shape)) {
    const path = [...basePath, key];
    const nextSchema = unwrapEnvObjectSchema(value as z.ZodTypeAny);

    if (nextSchema instanceof z.ZodObject) {
      walkObjectSchema(nextSchema, path, fields, knownPaths);
      continue;
    }

    fields.push({
      path,
    });
    knownPaths.add(path.join("."));
  }
}

function unwrapEnvObjectSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault ||
      current instanceof z.ZodReadonly ||
      current instanceof z.ZodCatch
    ) {
      current = current._def.innerType as z.ZodTypeAny;
      continue;
    }

    return current;
  }
}

function resolveEnvField(
  field: EnvFieldDefinition,
  envBag: EnvBag,
  prefix: string | undefined,
): EnvFieldMetadata {
  const override = field.override;
  const primaryName =
    override?.name ?? `${normalizePrefix(prefix)}${toEnvName(field.path)}`;
  const envNames = [primaryName, ...(override?.aliases ?? [])];
  const resolvedEntry = envNames
    .map((envName) => ({
      envName,
      value: envBag[envName],
    }))
    .find((entry) => entry.value !== undefined);

  return {
    path: field.path.join("."),
    envNames,
    resolvedEnvName: resolvedEntry?.envName,
    provided: resolvedEntry !== undefined,
    value: override?.secret ? "[redacted]" : resolvedEntry?.value,
    secret: override?.secret ?? false,
  };
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return "";
  }

  const trimmed = prefix.trim();

  if (trimmed.length === 0) {
    return "";
  }

  return `${trimmed.replace(/_+$/u, "")}_`;
}

function toEnvName(path: readonly string[]): string {
  return path.map((segment) => toEnvSegment(segment)).join("_");
}

function toEnvSegment(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[-\s]+/gu, "_")
    .replace(/__+/gu, "_")
    .toUpperCase();
}

function resolveEnvBag(
  source: EnvBag | (() => EnvBag) | undefined,
): EnvBag {
  if (!source) {
    if (typeof process !== "undefined" && process.env) {
      return process.env as EnvBag;
    }

    return {};
  }

  const value = typeof source === "function" ? source() : source;

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw bedrockError({
      message: "Env config loader must resolve to an object.",
      code: "BEDROCK_CONFIG_LOAD_ERROR",
      details: {
        source: "env",
      },
    });
  }

  return value;
}

function setPathValue(
  target: Record<string, unknown>,
  path: readonly string[],
  value: string,
): void {
  let current: Record<string, unknown> = target;

  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];

    if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      current = existing as Record<string, unknown>;
      continue;
    }

    const next: Record<string, unknown> = {};
    current[segment] = next;
    current = next;
  }

  const last = path[path.length - 1];

  if (!last) {
    return;
  }

  current[last] = value;
}

function wrapConfigLoadError(
  configName: string,
  error: unknown,
): BedrockError {
  if (isBedrockError(error)) {
    return error;
  }

  return bedrockError({
    message: `Failed to load config "${configName}".`,
    code: "BEDROCK_CONFIG_LOAD_ERROR",
    details: {
      configName,
      cause: error,
    },
  });
}

function wrapConfigValidationError(
  configName: string,
  error: unknown,
  loaded: unknown,
): BedrockError {
  if (isBedrockError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return bedrockError({
      message: `Invalid config "${configName}".`,
      code: "BEDROCK_CONFIG_VALIDATION_ERROR",
      details: {
        configName,
        issues: error.issues,
        ...extractEnvValidationDetails(loaded),
      },
    });
  }

  return bedrockError({
    message: `Failed to validate config "${configName}".`,
    code: "BEDROCK_CONFIG_VALIDATION_ERROR",
    details: {
      configName,
      cause: error,
      ...extractEnvValidationDetails(loaded),
    },
  });
}

function extractEnvValidationDetails(
  loaded: unknown,
): {
  source?: "env";
  fields?: readonly EnvFieldMetadata[];
} {
  if (typeof loaded !== "object" || loaded === null) {
    return {};
  }

  const metadata = (loaded as ObjectWithEnvMetadata)[ENV_LOAD_METADATA];

  if (!metadata) {
    return {};
  }

  return {
    source: metadata.source,
    fields: metadata.fields,
  };
}
