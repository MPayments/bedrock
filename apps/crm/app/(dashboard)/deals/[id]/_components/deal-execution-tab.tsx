import { ExecutionPlanCard } from "./execution-plan-card";
import { OperationalStateCard } from "./operational-state-card";
import type {
  ApiDealOperationalState,
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
  DealLegState,
  DealStatus,
} from "./types";

type DealExecutionTabProps = {
  executionPlan: ApiDealWorkflowLeg[];
  isUpdatingLegKey: string | null;
  onBlockedTransitionClick: (status: DealStatus) => void;
  onUpdateLegState: (idx: number, state: DealLegState) => void;
  operationalState: ApiDealOperationalState;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function DealExecutionTab({
  executionPlan,
  isUpdatingLegKey,
  onBlockedTransitionClick,
  onUpdateLegState,
  operationalState,
  sectionCompleteness,
  transitionReadiness,
}: DealExecutionTabProps) {
  return (
    <div className="space-y-6">
      <ExecutionPlanCard
        executionPlan={executionPlan}
        isUpdatingLegKey={isUpdatingLegKey}
        onBlockedTransitionClick={onBlockedTransitionClick}
        onUpdateLegState={onUpdateLegState}
        sectionCompleteness={sectionCompleteness}
        transitionReadiness={transitionReadiness}
      />
      <OperationalStateCard operationalState={operationalState} />
    </div>
  );
}
