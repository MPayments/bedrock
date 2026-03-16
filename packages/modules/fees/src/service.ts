import type { Transaction } from "@bedrock/platform/persistence";

import { createFeesCommandHandlers } from "./application/commands";
import { createFeesQueryHandlers } from "./application/queries";
import {
  createFeesServiceContext,
  type FeesServiceDeps,
} from "./application/shared/context";
import type {
  AdjustmentComponent,
  ApplicableFeeRule,
  CalculateFxQuoteFeeComponentsInput,
  FeeComponent,
  FeeComponentDefaults,
  GetQuoteFeeComponentsInput,
  MergeAdjustmentComponentsInput,
  MergeFeeComponentsInput,
  PartitionedAdjustmentComponents,
  PartitionedFeeComponents,
  ResolveFeeRulesInput,
  SaveQuoteFeeComponentsInput,
  UpsertFeeRuleInput,
} from "./contracts";
import { getComponentDefaults } from "./domain/defaults";
import { calculateBpsAmount } from "./domain/math";
import { createDrizzleFeesQuoteSnapshotsRepository } from "./infra/drizzle/repos/quote-snapshots-repository";
import { createDrizzleFeesRulesRepository } from "./infra/drizzle/repos/rules-repository";

export type { FeesServiceDeps } from "./application/shared/context";

export interface FeesService {
  calculateBpsAmount(amountMinor: bigint, bps: number): bigint;
  getComponentDefaults(kind: string): FeeComponentDefaults;
  upsertRule(input: UpsertFeeRuleInput): Promise<string>;
  listApplicableRules(
    input: ResolveFeeRulesInput,
    tx?: Transaction,
  ): Promise<ApplicableFeeRule[]>;
  calculateFxQuoteFeeComponents(
    input: CalculateFxQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<FeeComponent[]>;
  saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<void>;
  getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<FeeComponent[]>;
  mergeFeeComponents(input: MergeFeeComponentsInput): FeeComponent[];
  aggregateFeeComponents(components: FeeComponent[]): FeeComponent[];
  partitionFeeComponents(components: FeeComponent[]): PartitionedFeeComponents;
  mergeAdjustmentComponents(
    input: MergeAdjustmentComponentsInput,
  ): AdjustmentComponent[];
  aggregateAdjustmentComponents(
    components: AdjustmentComponent[],
  ): AdjustmentComponent[];
  partitionAdjustmentComponents(
    components: AdjustmentComponent[],
  ): PartitionedAdjustmentComponents;
}

export function createFeesService(deps: FeesServiceDeps): FeesService {
  const context = createFeesServiceContext({
    logger: deps.logger,
    currenciesService: deps.currenciesService,
    rulesRepository: createDrizzleFeesRulesRepository({ db: deps.db }),
    quoteSnapshotsQueryRepository:
      createDrizzleFeesQuoteSnapshotsRepository({ db: deps.db }),
    quoteSnapshotsCommandRepository:
      createDrizzleFeesQuoteSnapshotsRepository({ db: deps.db }),
  });

  const commandHandlers = createFeesCommandHandlers(context);
  const queryHandlers = createFeesQueryHandlers(context);

  return {
    calculateBpsAmount,
    getComponentDefaults,
    ...commandHandlers,
    ...queryHandlers,
  };
}
