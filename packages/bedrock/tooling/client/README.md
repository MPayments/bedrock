# `@bedrock/client`

Typed runtime HTTP client generation for Bedrock controllers.

It uses shared TypeScript contracts derived from Bedrock controller descriptors. There is no code generation step in v1.

## Primary exports

- `createApiClient<TContract>(config)`
- `parseResponse(responseOrPromise)`
- `DetailedError`
- `type ApiContract<TApp extends AppDescriptor>`
- `type ApiClient<TContract>`
- `type ApiClientConfig`
- `type ApiClientResponse<TResponses>`
- `type InferParsedResponseType<TResponse>`
- `type InferErrorResponseType<TResponse>`
- `type InferRequestType<TEndpoint>`
- `type InferResponseType<TEndpoint, TStatus = undefined>`

## Contract export pattern

```ts
import type { AppDescriptor } from "@bedrock/core";
import type { ApiContract } from "@bedrock/client";

import { blogModule } from "./module";

export const appDefinition = {
  modules: [blogModule],
} satisfies AppDescriptor;

export type BlogApi = ApiContract<typeof appDefinition>;
```

Clients should import `type BlogApi` only.

## Client usage

```ts
import { createApiClient, parseResponse } from "@bedrock/client";
import type { BlogApi } from "@bedrock/example-blog-app";

const client = createApiClient<BlogApi>({
  baseUrl: "https://example.com/api",
  buildSearchParams(query) {
    return new URLSearchParams(
      Object.entries(query).flatMap(([key, value]) =>
        Array.isArray(value)
          ? [[key, value.join("|")]]
          : value === undefined
            ? []
            : [[key, String(value)]],
      ),
    );
  },
});

const response = await client.users[":id"].$get(
  {
    param: {
      id: "user-1",
    },
  },
  {
    headers: {
      "x-trace-id": "trace-override",
    },
  },
);

const path = client.users[":id"].$path({
  param: {
    id: "user-1",
  },
});

const body = await parseResponse(response);
body.id;
```

## Behavior

- exposes Hono-style helpers: `$get`, `$post`, `$put`, `$patch`, `$delete`, `$url`, `$path`
- returns the native `Response` object with typed `status` and typed `.json()`
- provides `parseResponse()` and `DetailedError` for parsed-body ergonomics
- includes explicit controller HTTP errors and implicit Bedrock HTTP errors
- uses flat query serialization with repeated keys for arrays by default
- supports custom query serialization through `buildSearchParams`
- supports JSON request bodies through `json`
- accepts both `params` and `param` for path parameters
- accepts an optional second method argument for runtime `headers` / `init` overrides

## Important rules

- `baseUrl` must already include any HTTP adapter base path such as `/api`
- only controller routes appear in the contract; raw HTTP mounts are excluded
- literal route segments starting with `$` are escaped in the client tree with `$$`
- nested query object encoding is out of scope in v1
- `$url()` requires an absolute `baseUrl`; use `$path()` when you only need the path string
