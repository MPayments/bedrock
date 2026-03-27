import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  CreateCounterpartyEndpointInputSchema,
  CreateTreasuryAccountInputSchema,
  CreateTreasuryEndpointInputSchema,
  CounterpartyEndpointSchema,
  GetTreasuryAccountBalancesInputSchema,
  ListCounterpartyEndpointsInputSchema,
  ListTreasuryAccountsInputSchema,
  ListTreasuryEndpointsInputSchema,
  TreasuryAccountBalancesResponseSchema,
  TreasuryAccountSchema,
  TreasuryEndpointSchema,
} from "@bedrock/treasury/accounts";
import {
  AllocateExecutionInputSchema,
  AllocationSchema,
} from "@bedrock/treasury/allocations";
import {
  TreasuryConflictError,
  TreasuryEntityNotFoundError,
  ValidationError,
} from "@bedrock/treasury";
import {
  CreateExecutionInstructionInputSchema,
  ExecutionEventSchema,
  ExecutionInstructionSchema,
  ListExecutionInstructionsInputSchema,
  ListUnmatchedExternalRecordsInputSchema,
  RecordExecutionEventInputSchema,
  UnmatchedExternalRecordSchema,
} from "@bedrock/treasury/executions";
import {
  ObligationOutstandingSchema,
  ObligationSchema,
  OpenObligationInputSchema,
} from "@bedrock/treasury/obligations";
import {
  ApproveOperationInputSchema,
  GetOperationTimelineInputSchema,
  IssueOperationInputSchema,
  ListTreasuryOperationsInputSchema,
  OperationTimelineItemSchema,
  ReserveOperationFundsInputSchema,
  TreasuryOperationSchema,
} from "@bedrock/treasury/operations";
import {
  ListTreasuryPositionsInputSchema,
  SettlePositionInputSchema,
  TreasuryPositionSchema,
} from "@bedrock/treasury/positions";
import { ServiceError } from "@bedrock/shared/core/errors";

import { ErrorSchema } from "../common";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const ObligationIdParamsSchema = z.object({
  obligationId: z.uuid(),
});

const OperationIdParamsSchema = z.object({
  operationId: z.uuid(),
});

const PositionIdParamsSchema = z.object({
  positionId: z.uuid(),
});

const TreasuryPositionsResponseSchema = z.object({
  data: z.array(TreasuryPositionSchema),
});

const TreasuryAccountsResponseSchema = z.object({
  data: z.array(TreasuryAccountSchema),
});

const TreasuryEndpointsResponseSchema = z.object({
  data: z.array(TreasuryEndpointSchema),
});

const CounterpartyEndpointsResponseSchema = z.object({
  data: z.array(CounterpartyEndpointSchema),
});

const TreasuryOperationsResponseSchema = z.object({
  data: z.array(TreasuryOperationSchema),
});

const ExecutionInstructionsResponseSchema = z.object({
  data: z.array(ExecutionInstructionSchema),
});

const UnmatchedExternalRecordsResponseSchema = z.object({
  data: z.array(UnmatchedExternalRecordSchema),
});

function toErrorResponse(error: unknown) {
  if (error instanceof TreasuryEntityNotFoundError) {
    return {
      status: 404 as const,
      body: {
        error: error.message,
        code: error.name,
      },
    };
  }

  if (error instanceof TreasuryConflictError) {
    return {
      status: 409 as const,
      body: {
        error: error.message,
        code: error.name,
      },
    };
  }

  if (error instanceof ValidationError || error instanceof ServiceError) {
    return {
      status: 400 as const,
      body: {
        error: error.message,
        code: error.name,
      },
    };
  }

  throw error;
}

async function handleTreasuryRoute<T>(
  c: {
    json: (body: unknown, status?: number) => Response;
  },
  handler: () => Promise<T>,
): Promise<any> {
  try {
    return await handler();
  } catch (error) {
    const mapped = toErrorResponse(error);
    return jsonOk(c, mapped.body, mapped.status);
  }
}

export function treasuryRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const createTreasuryAccountRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/accounts",
    tags: ["Treasury"],
    summary: "Create treasury account",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateTreasuryAccountInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Treasury account created",
        content: {
          "application/json": {
            schema: TreasuryAccountSchema,
          },
        },
      },
      400: {
        description: "Invalid treasury account input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const createTreasuryEndpointRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/accounts/endpoints",
    tags: ["Treasury"],
    summary: "Create treasury endpoint",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateTreasuryEndpointInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Treasury endpoint created",
        content: {
          "application/json": {
            schema: TreasuryEndpointSchema,
          },
        },
      },
      400: {
        description: "Invalid treasury endpoint input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Treasury account not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const createCounterpartyEndpointRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/counterparty-endpoints",
    tags: ["Treasury"],
    summary: "Create counterparty endpoint",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateCounterpartyEndpointInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Counterparty endpoint created",
        content: {
          "application/json": {
            schema: CounterpartyEndpointSchema,
          },
        },
      },
      400: {
        description: "Invalid counterparty endpoint input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listCounterpartyEndpointsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/counterparty-endpoints",
    tags: ["Treasury"],
    summary: "List counterparty endpoints",
    request: {
      query: ListCounterpartyEndpointsInputSchema,
    },
    responses: {
      200: {
        description: "Counterparty endpoints",
        content: {
          "application/json": {
            schema: CounterpartyEndpointsResponseSchema,
          },
        },
      },
    },
  });

  const getTreasuryAccountBalancesRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/accounts/balances",
    tags: ["Treasury"],
    summary: "List treasury account balances",
    request: {
      query: GetTreasuryAccountBalancesInputSchema,
    },
    responses: {
      200: {
        description: "Treasury account balances",
        content: {
          "application/json": {
            schema: TreasuryAccountBalancesResponseSchema,
          },
        },
      },
    },
  });

  const listTreasuryAccountsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/accounts",
    tags: ["Treasury"],
    summary: "List treasury accounts",
    request: {
      query: ListTreasuryAccountsInputSchema,
    },
    responses: {
      200: {
        description: "Treasury accounts",
        content: {
          "application/json": {
            schema: TreasuryAccountsResponseSchema,
          },
        },
      },
    },
  });

  const listTreasuryEndpointsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/accounts/endpoints",
    tags: ["Treasury"],
    summary: "List treasury endpoints",
    request: {
      query: ListTreasuryEndpointsInputSchema,
    },
    responses: {
      200: {
        description: "Treasury endpoints",
        content: {
          "application/json": {
            schema: TreasuryEndpointsResponseSchema,
          },
        },
      },
    },
  });

  const openObligationRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/obligations",
    tags: ["Treasury"],
    summary: "Open obligation",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: OpenObligationInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Obligation opened",
        content: {
          "application/json": {
            schema: ObligationSchema,
          },
        },
      },
      400: {
        description: "Invalid obligation input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const getObligationOutstandingRoute = createRoute({
    middleware: [requirePermission({ treasury: ["get"] })],
    method: "get",
    path: "/obligations/{obligationId}/outstanding",
    tags: ["Treasury"],
    summary: "Get obligation outstanding amount",
    request: {
      params: ObligationIdParamsSchema,
    },
    responses: {
      200: {
        description: "Outstanding obligation amount",
        content: {
          "application/json": {
            schema: ObligationOutstandingSchema,
          },
        },
      },
      404: {
        description: "Obligation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const issueOperationRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/operations",
    tags: ["Treasury"],
    summary: "Issue treasury operation",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: IssueOperationInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Treasury operation issued",
        content: {
          "application/json": {
            schema: TreasuryOperationSchema,
          },
        },
      },
      400: {
        description: "Invalid operation input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Related entity not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Operation idempotency conflict",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listTreasuryOperationsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/operations",
    tags: ["Treasury"],
    summary: "List treasury operations",
    request: {
      query: ListTreasuryOperationsInputSchema,
    },
    responses: {
      200: {
        description: "Treasury operations",
        content: {
          "application/json": {
            schema: TreasuryOperationsResponseSchema,
          },
        },
      },
    },
  });

  const approveOperationRoute = createRoute({
    middleware: [requirePermission({ treasury: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/approve",
    tags: ["Treasury"],
    summary: "Approve treasury operation",
    request: {
      params: OperationIdParamsSchema,
    },
    responses: {
      200: {
        description: "Treasury operation approved",
        content: {
          "application/json": {
            schema: TreasuryOperationSchema,
          },
        },
      },
      404: {
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const reserveOperationFundsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["update"] })],
    method: "post",
    path: "/operations/{operationId}/reserve",
    tags: ["Treasury"],
    summary: "Reserve funds for treasury operation",
    request: {
      params: OperationIdParamsSchema,
    },
    responses: {
      200: {
        description: "Treasury operation reserved",
        content: {
          "application/json": {
            schema: TreasuryOperationSchema,
          },
        },
      },
      404: {
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const getOperationTimelineRoute = createRoute({
    middleware: [requirePermission({ treasury: ["get"] })],
    method: "get",
    path: "/operations/{operationId}/timeline",
    tags: ["Treasury"],
    summary: "Get treasury operation timeline",
    request: {
      params: OperationIdParamsSchema,
    },
    responses: {
      200: {
        description: "Treasury operation timeline",
        content: {
          "application/json": {
            schema: OperationTimelineItemSchema,
          },
        },
      },
      404: {
        description: "Operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const createExecutionInstructionRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/execution-instructions",
    tags: ["Treasury"],
    summary: "Create execution instruction",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateExecutionInstructionInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Execution instruction created",
        content: {
          "application/json": {
            schema: ExecutionInstructionSchema,
          },
        },
      },
      400: {
        description: "Invalid execution instruction input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Related entity not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listExecutionInstructionsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/execution-instructions",
    tags: ["Treasury"],
    summary: "List execution instructions",
    request: {
      query: ListExecutionInstructionsInputSchema,
    },
    responses: {
      200: {
        description: "Execution instructions",
        content: {
          "application/json": {
            schema: ExecutionInstructionsResponseSchema,
          },
        },
      },
    },
  });

  const recordExecutionEventRoute = createRoute({
    middleware: [requirePermission({ treasury: ["update"] })],
    method: "post",
    path: "/execution-events",
    tags: ["Treasury"],
    summary: "Record execution event",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: RecordExecutionEventInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Execution event recorded",
        content: {
          "application/json": {
            schema: z.object({
              event: ExecutionEventSchema,
              operation: TreasuryOperationSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid execution event input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Instruction or operation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listUnmatchedExternalRecordsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/execution-events/unmatched",
    tags: ["Treasury"],
    summary: "List unmatched external records",
    request: {
      query: ListUnmatchedExternalRecordsInputSchema,
    },
    responses: {
      200: {
        description: "Unmatched external records",
        content: {
          "application/json": {
            schema: UnmatchedExternalRecordsResponseSchema,
          },
        },
      },
    },
  });

  const allocateExecutionRoute = createRoute({
    middleware: [requirePermission({ treasury: ["create"] })],
    method: "post",
    path: "/allocations",
    tags: ["Treasury"],
    summary: "Allocate execution against obligation",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: AllocateExecutionInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Execution allocated",
        content: {
          "application/json": {
            schema: AllocationSchema,
          },
        },
      },
      400: {
        description: "Invalid allocation input",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Execution event or obligation not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  const listTreasuryPositionsRoute = createRoute({
    middleware: [requirePermission({ treasury: ["list"] })],
    method: "get",
    path: "/positions",
    tags: ["Treasury"],
    summary: "List treasury positions",
    request: {
      query: ListTreasuryPositionsInputSchema,
    },
    responses: {
      200: {
        description: "Treasury positions",
        content: {
          "application/json": {
            schema: TreasuryPositionsResponseSchema,
          },
        },
      },
    },
  });

  const settlePositionRoute = createRoute({
    middleware: [requirePermission({ treasury: ["update"] })],
    method: "post",
    path: "/positions/{positionId}/settle",
    tags: ["Treasury"],
    summary: "Settle treasury position",
    request: {
      params: PositionIdParamsSchema,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: SettlePositionInputSchema.omit({ positionId: true }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Treasury position settled",
        content: {
          "application/json": {
            schema: TreasuryPositionSchema,
          },
        },
      },
      404: {
        description: "Position not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  return app
    .openapi(createTreasuryAccountRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.accounts.commands.createTreasuryAccount(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(createTreasuryEndpointRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.accounts.commands.createTreasuryEndpoint(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(createCounterpartyEndpointRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.accounts.commands.createCounterpartyEndpoint(
            body,
          );
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(listCounterpartyEndpointsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.accounts.queries.listCounterpartyEndpoints(
            query,
          );
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(listTreasuryAccountsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.accounts.queries.listTreasuryAccounts(query);
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(listTreasuryEndpointsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.accounts.queries.listTreasuryEndpoints(
            query,
          );
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(getTreasuryAccountBalancesRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.accounts.queries.getTreasuryAccountBalances(
            query,
          );
        return jsonOk(c, data, 200);
      }),
    )
    .openapi(openObligationRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.obligations.commands.openObligation(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(getObligationOutstandingRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const { obligationId } = c.req.valid("param");
        const result =
          await ctx.treasuryModule.obligations.queries.getObligationOutstanding({
            obligationId,
          });
        return jsonOk(c, result, 200);
      }),
    )
    .openapi(issueOperationRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.operations.commands.issueOperation(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(listTreasuryOperationsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.operations.queries.listTreasuryOperations(
            query,
          );
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(approveOperationRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const { operationId } = c.req.valid("param");
        const approved =
          await ctx.treasuryModule.operations.commands.approveOperation({
            operationId,
          });
        return jsonOk(c, approved, 200);
      }),
    )
    .openapi(reserveOperationFundsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const { operationId } = c.req.valid("param");
        const reserved =
          await ctx.treasuryModule.operations.commands.reserveOperationFunds({
            operationId,
          });
        return jsonOk(c, reserved, 200);
      }),
    )
    .openapi(getOperationTimelineRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const { operationId } = c.req.valid("param");
        const result =
          await ctx.treasuryModule.operations.queries.getOperationTimeline({
            operationId,
          });
        return jsonOk(c, result, 200);
      }),
    )
    .openapi(createExecutionInstructionRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.executions.commands.createExecutionInstruction(
            body,
          );
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(listExecutionInstructionsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.executions.queries.listExecutionInstructions(
            query,
          );
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(recordExecutionEventRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.executions.commands.recordExecutionEvent(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(listUnmatchedExternalRecordsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.executions.queries.listUnmatchedExternalRecords(
            query,
          );
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(allocateExecutionRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const body = c.req.valid("json");
        const created =
          await ctx.treasuryModule.allocations.commands.allocateExecution(body);
        return jsonOk(c, created, 201);
      }),
    )
    .openapi(listTreasuryPositionsRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const query = c.req.valid("query");
        const data =
          await ctx.treasuryModule.positions.queries.listTreasuryPositions(query);
        return jsonOk(c, { data }, 200);
      }),
    )
    .openapi(settlePositionRoute, async (c): Promise<any> =>
      handleTreasuryRoute(c, async () => {
        const { positionId } = c.req.valid("param");
        const body = c.req.valid("json");
        const settled =
          await ctx.treasuryModule.positions.commands.settlePosition({
            positionId,
            amountMinor: body.amountMinor,
          });
        return jsonOk(c, settled, 200);
      }),
    );
}
