import {
  defineController,
  defineHttpError,
  defineModule,
  type AppDescriptor,
} from "@bedrock/core";
import { z } from "zod";

import {
  createApiClient,
  type ApiContract,
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from "./index";

const UserExistsError = defineHttpError("USER_EXISTS", {
  status: 409,
  description: "User already exists",
  details: z.object({
    email: z.string().email(),
  }),
});

const usersController = defineController("users-http", {
  basePath: "/users",
  routes: ({ route }) => ({
    create: route.post({
      path: "/",
      request: {
        body: z.object({
          name: z.string().min(1),
        }),
      },
      responses: {
        200: z.object({
          id: z.string(),
          name: z.string(),
        }),
      },
      errors: {
        USER_EXISTS: UserExistsError,
      },
      handler: async ({ request }) => ({
        id: "user-1",
        name: request.body.name,
      }),
    }),
    getById: route.get({
      path: "/:id",
      request: {
        params: z.object({
          id: z.string(),
        }),
        query: z.object({
          expand: z.enum(["posts"]).optional(),
        }),
      },
      responses: {
        200: z.object({
          id: z.string(),
          expand: z.enum(["posts"]).optional(),
        }),
      },
      handler: async ({ request }) => ({
        id: request.params.id,
        expand: request.query.expand,
      }),
    }),
  }),
});

const healthController = defineController("health-http", {
  routes: ({ route }) => ({
    read: route.get({
      path: "/$health",
      responses: {
        200: z.object({
          ok: z.literal(true),
        }),
      },
      handler: async () => ({
        ok: true as const,
      }),
    }),
  }),
});

const deepController = defineController("deep-http", {
  basePath: "/deep",
  routes: ({ route }) => ({
    read: route.get({
      path: "/leaf",
      responses: {
        200: z.object({
          ok: z.literal(true),
        }),
      },
      handler: async () => ({
        ok: true as const,
      }),
    }),
  }),
});

const moduleLevel26 = defineModule("client-depth-26", {
  controllers: [deepController],
});
const moduleLevel25 = defineModule("client-depth-25", {
  imports: [moduleLevel26],
});
const moduleLevel24 = defineModule("client-depth-24", {
  imports: [moduleLevel25],
});
const moduleLevel23 = defineModule("client-depth-23", {
  imports: [moduleLevel24],
});
const moduleLevel22 = defineModule("client-depth-22", {
  imports: [moduleLevel23],
});
const moduleLevel21 = defineModule("client-depth-21", {
  imports: [moduleLevel22],
});
const moduleLevel20 = defineModule("client-depth-20", {
  imports: [moduleLevel21],
});
const moduleLevel19 = defineModule("client-depth-19", {
  imports: [moduleLevel20],
});
const moduleLevel18 = defineModule("client-depth-18", {
  imports: [moduleLevel19],
});
const moduleLevel17 = defineModule("client-depth-17", {
  imports: [moduleLevel18],
});
const moduleLevel16 = defineModule("client-depth-16", {
  imports: [moduleLevel17],
});
const moduleLevel15 = defineModule("client-depth-15", {
  imports: [moduleLevel16],
});
const moduleLevel14 = defineModule("client-depth-14", {
  imports: [moduleLevel15],
});
const moduleLevel13 = defineModule("client-depth-13", {
  imports: [moduleLevel14],
});
const moduleLevel12 = defineModule("client-depth-12", {
  imports: [moduleLevel13],
});
const moduleLevel11 = defineModule("client-depth-11", {
  imports: [moduleLevel12],
});
const moduleLevel10 = defineModule("client-depth-10", {
  imports: [moduleLevel11],
});
const moduleLevel9 = defineModule("client-depth-9", {
  imports: [moduleLevel10],
});
const moduleLevel8 = defineModule("client-depth-8", {
  imports: [moduleLevel9],
});
const moduleLevel7 = defineModule("client-depth-7", {
  imports: [moduleLevel8],
});
const moduleLevel6 = defineModule("client-depth-6", {
  imports: [moduleLevel7],
});
const moduleLevel5 = defineModule("client-depth-5", {
  imports: [moduleLevel6],
});
const moduleLevel4 = defineModule("client-depth-4", {
  imports: [moduleLevel5],
});
const moduleLevel3 = defineModule("client-depth-3", {
  imports: [moduleLevel4],
});
const moduleLevel2 = defineModule("client-depth-2", {
  imports: [moduleLevel3],
});
const moduleLevel1 = defineModule("client-depth-1", {
  imports: [moduleLevel2],
});
const moduleLevel27 = defineModule("client-depth-27", {
  imports: [moduleLevel1],
});
const moduleLevel28 = defineModule("client-depth-28", {
  imports: [moduleLevel27],
});

export const appDefinition = {
  modules: [
    defineModule("client-typecheck", {
      controllers: [usersController, healthController],
    }),
  ],
} satisfies AppDescriptor;

export type TestApi = ApiContract<typeof appDefinition>;

export const deepAppDefinition = {
  modules: [moduleLevel28],
} satisfies AppDescriptor;

export type DeepApi = ApiContract<typeof deepAppDefinition>;

const client = createApiClient<TestApi>({
  baseUrl: "https://api.example.com/api",
});
const deepClient = createApiClient<DeepApi>({
  baseUrl: "https://api.example.com/api",
});
const userByIdEndpoint = client.users[":id"];
const deepLeafEndpoint = deepClient.deep.leaf;

const createRequest: InferRequestType<typeof client.users.$post> = {
  json: {
    name: "Ada",
  },
};
createRequest;

const getByIdRequest: InferRequestType<typeof userByIdEndpoint.$get> = {
  param: {
    id: "user-1",
  },
  query: {
    expand: "posts",
  },
};
getByIdRequest;

const pathValue = userByIdEndpoint.$path({
  param: {
    id: "user-1",
  },
});
pathValue satisfies string;

deepLeafEndpoint.$get();
client.users.$post(
  {
    json: {
      name: "Ada",
    },
  },
  {
    headers: {
      "x-trace-id": "trace-override",
    },
  },
);

const createSuccess: InferResponseType<typeof client.users.$post, 200> = {
  id: "user-1",
  name: "Ada",
};
createSuccess;

const parsedCreate = parseResponse(
  client.users.$post({
    json: {
      name: "Ada",
    },
  }),
);
parsedCreate satisfies Promise<{
  id: string;
  name: string;
}>;

const createConflict: InferResponseType<typeof client.users.$post, 409> = {
  error: {
    code: "USER_EXISTS",
    message: "User already exists",
    details: {
      email: "ada@example.com",
    },
  },
};
createConflict;

const implicitValidation: InferResponseType<typeof client.users.$post, 400> = {
  error: {
    code: "BEDROCK_VALIDATION_ERROR",
    message: "Validation error",
    details: {
      issues: [],
    },
  },
};
implicitValidation;

client["$$health"].$get();

// @ts-expect-error missing required params.id
client.users[":id"].$get();

// @ts-expect-error missing required param.id
client.users[":id"].$get({
  param: {},
});

// @ts-expect-error no delete helper exists on the users collection endpoint
client.users.$delete();
