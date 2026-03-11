import { createApp } from "@bedrock/core";

import { createMultihansaApiDescriptor } from "@multihansa/app";

function createFakeDb() {
  return {
    select() {
      return {
        from() {
          return {
            limit: async () => [],
          };
        },
      };
    },
  };
}

function createFakeAuth() {
  return {
    api: {
      getSession: async () => null,
    },
    handler: async (request: Request) =>
      Response.json({
        mounted: true,
        path: new URL(request.url).pathname,
      }),
  };
}

describe("multihansa-api", () => {
  const originalEnv = {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET =
      "better-auth-secret-that-is-long-enough-for-api-tests";
    process.env.BETTER_AUTH_URL = "http://test.local/api/auth";
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = "https://app.multihansa.local";
  });

  afterEach(() => {
    if (originalEnv.BETTER_AUTH_SECRET === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = originalEnv.BETTER_AUTH_SECRET;
    }

    if (originalEnv.BETTER_AUTH_URL === undefined) {
      delete process.env.BETTER_AUTH_URL;
    } else {
      process.env.BETTER_AUTH_URL = originalEnv.BETTER_AUTH_URL;
    }

    if (originalEnv.BETTER_AUTH_TRUSTED_ORIGINS === undefined) {
      delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    } else {
      process.env.BETTER_AUTH_TRUSTED_ORIGINS =
        originalEnv.BETTER_AUTH_TRUSTED_ORIGINS;
    }
  });

  test("serves platform routes and mounts Better Auth via Bedrock", async () => {
    const app = createApp(
      createMultihansaApiDescriptor({
        appName: "multihansa-api-test",
        auth: createFakeAuth(),
        db: createFakeDb(),
        trustedOrigins: ["https://app.multihansa.local"],
      }),
    );

    await app.start();

    const rootResponse = await app.fetch(new Request("http://test.local/"));
    expect(rootResponse.status).toBe(200);
    expect(await rootResponse.json()).toEqual({
      status: "ok",
      service: "multihansa-api-test",
    });

    const healthResponse = await app.fetch(new Request("http://test.local/health"));
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toMatchObject({
      status: "healthy",
      checks: {
        postgres: {
          status: "up",
        },
      },
    });

    const openApiResponse = await app.fetch(
      new Request("http://test.local/api/open-api"),
    );
    expect(openApiResponse.status).toBe(200);
    expect(await openApiResponse.json()).toMatchObject({
      openapi: "3.1.0",
    });

    const docsResponse = await app.fetch(new Request("http://test.local/docs"));
    expect(docsResponse.status).toBe(200);
    expect(await docsResponse.text()).toContain("<rapi-doc");

    const authResponse = await app.fetch(
      new Request("http://test.local/api/auth/session"),
    );
    expect(authResponse.status).toBe(200);
    expect(await authResponse.json()).toEqual({
      mounted: true,
      path: "/api/auth/session",
    });

    await app.stop();
  });

  test("protects versioned routes with Bedrock auth middleware", async () => {
    const app = createApp(
      createMultihansaApiDescriptor({
        appName: "multihansa-api-test",
        auth: createFakeAuth(),
        db: createFakeDb(),
        trustedOrigins: ["https://app.multihansa.local"],
      }),
    );

    await app.start();

    const response = await app.fetch(new Request("http://test.local/v1/users"));
    expect(response.status).toBe(401);

    await app.stop();
  });
});
