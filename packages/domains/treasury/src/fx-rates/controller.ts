import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";

import {
  FxRateHistoryResponseSchema,
  FxRatePairsResponseSchema,
  FxRateSourceStatusesResponseSchema,
  SetManualRateInputSchema,
  SetManualRateResponseSchema,
} from "@multihansa/treasury/fx/contracts";

import {
  fxRatesService,
  LatestRateQuerySchema,
  LatestRateResponseSchema,
  RateHistoryQuerySchema,
  SyncRateSourceParamsSchema,
  SyncRateSourceQuerySchema,
  SyncRateSourceResponseSchema,
} from "./service";
import {
  BadRequestHttpError,
  NotFoundHttpError,
  ServiceUnavailableHttpError,
} from "@multihansa/common/bedrock";

export const fxRatesController: DefinedController = defineController("fx-rates-http", {
  basePath: "/v1/treasury/fx/rates",
  deps: {
    auth: AuthContextToken,
  },
  routes: ({ route }) => ({
    history: route.get({
      path: "/history",
      request: {
        query: RateHistoryQuerySchema,
      },
      responses: {
        200: FxRateHistoryResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:list")],
      handler: fxRatesService.actions.history,
    }),
    pairs: route.get({
      path: "/pairs",
      responses: {
        200: FxRatePairsResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:list")],
      handler: fxRatesService.actions.pairs,
    }),
    setManualRate: route.post({
      path: "/manual",
      request: {
        body: SetManualRateInputSchema,
      },
      responses: {
        201: SetManualRateResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:sync")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(await call(fxRatesService.actions.setManualRate, request.body)),
    }),
    latest: route.get({
      path: "/latest",
      request: {
        query: LatestRateQuerySchema,
      },
      responses: {
        200: LatestRateResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_SERVICE_UNAVAILABLE: ServiceUnavailableHttpError,
      },
      handler: ({ call, request }) => call(fxRatesService.actions.latest, request.query),
    }),
    sourceStatuses: route.get({
      path: "/sources",
      responses: {
        200: FxRateSourceStatusesResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:list")],
      handler: fxRatesService.actions.sourceStatuses,
    }),
    syncSource: route.post({
      path: "/sources/:source/sync",
      request: {
        params: SyncRateSourceParamsSchema,
        query: SyncRateSourceQuerySchema,
      },
      responses: {
        200: SyncRateSourceResponseSchema,
      },
      middleware: [requirePermissionMiddleware("fx_rates:sync")],
      errors: {
        MULTIHANSA_SERVICE_UNAVAILABLE: ServiceUnavailableHttpError,
      },
      handler: ({ call, request }) =>
        call(fxRatesService.actions.syncSource, {
          source: request.params.source,
          force: request.query.force,
        }),
    }),
  }),
});
