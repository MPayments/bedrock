import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export interface PostgresConnectionConfig extends Pick<
  PoolConfig,
  "database" | "host" | "password" | "port" | "ssl" | "user"
> {}

export interface CreatePostgresDatabaseOptions<
  TSchema extends Record<string, unknown>,
> {
  env?: NodeJS.ProcessEnv;
  pool?: Pool;
  schema: TSchema;
}

export interface CreateGenericPostgresDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  pool?: Pool;
}

function parseConnectionString(
  connectionString: string,
  env: NodeJS.ProcessEnv,
): PostgresConnectionConfig {
  const parsed = new URL(connectionString);

  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || env.DB_PASSWORD || ""),
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  };
}

export function resolvePostgresConnectionConfig(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConnectionConfig {
  const hasExplicitDbConfig =
    env.DB_HOST ||
    env.DB_PORT ||
    env.DB_NAME ||
    env.DB_USER ||
    typeof env.DB_PASSWORD === "string";

  if (hasExplicitDbConfig) {
    return {
      host: env.DB_HOST ?? "localhost",
      port: Number(env.DB_PORT ?? 5432),
      database: env.DB_NAME ?? "postgres",
      user: env.DB_USER ?? "postgres",
      password: env.DB_PASSWORD ?? "",
      ssl: env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
    };
  }

  if (env.DATABASE_URL) {
    return parseConnectionString(env.DATABASE_URL, env);
  }

  return {
    host: "localhost",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "",
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  };
}

export function createPostgresPool(env: NodeJS.ProcessEnv = process.env): Pool {
  return new Pool(resolvePostgresConnectionConfig(env));
}

export function createPostgresDatabase<TSchema extends Record<string, unknown>>(
  options: CreatePostgresDatabaseOptions<TSchema>,
): NodePgDatabase<TSchema>;
export function createPostgresDatabase(
  options?: CreateGenericPostgresDatabaseOptions,
): NodePgDatabase<any>;
export function createPostgresDatabase<TSchema extends Record<string, unknown>>(
  options?:
    | CreateGenericPostgresDatabaseOptions
    | CreatePostgresDatabaseOptions<TSchema>,
): NodePgDatabase<TSchema> | NodePgDatabase<any> {
  const pool = options?.pool ?? createPostgresPool(options?.env);

  if (options && "schema" in options) {
    return drizzle(pool, { schema: options.schema });
  }

  return drizzle(pool);
}
