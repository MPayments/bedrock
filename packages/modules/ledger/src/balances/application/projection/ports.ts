import type {
  BalanceProjectorCursor,
  ProjectedBalanceDelta,
  ProjectionOperationRow,
  ProjectionPostingRow,
} from "../../domain/projection";

export interface BalancesProjectionRepository {
  ensureCursor(): Promise<BalanceProjectorCursor>;
  listOperationsAfterCursor(
    cursor: BalanceProjectorCursor,
    batchSize: number,
  ): Promise<ProjectionOperationRow[]>;
  listProjectionPostingRowsForOperations(
    operations: ProjectionOperationRow[],
  ): Promise<Map<string, ProjectionPostingRow[]>>;
  applyProjectedDelta(
    input: ProjectedBalanceDelta & {
      operationId: string;
      sourceType: string;
      sourceId: string;
      operationCode: string;
      postedAt: Date;
    },
  ): Promise<boolean>;
  advanceCursor(input: { postedAt: Date; operationId: string }): Promise<void>;
}
