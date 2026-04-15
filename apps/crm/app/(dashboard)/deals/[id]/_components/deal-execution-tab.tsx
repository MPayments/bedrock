import { ExecutionPlanCard } from "./execution-plan-card";
import { OperationalStateCard } from "./operational-state-card";
import type {
  ApiCrmDealWorkbenchProjection,
  DealStatus,
} from "./types";

type DealExecutionTabProps = {
  onBlockedTransitionClick: (status: DealStatus) => void;
  workbench: ApiCrmDealWorkbenchProjection;
};

export function DealExecutionTab({
  onBlockedTransitionClick,
  workbench,
}: DealExecutionTabProps) {
  return (
    <div className="space-y-6">
      <ExecutionPlanCard
        executionPlan={workbench.executionPlan}
        onBlockedTransitionClick={onBlockedTransitionClick}
        sectionCompleteness={workbench.sectionCompleteness}
        transitionReadiness={workbench.transitionReadiness}
      />
      <OperationalStateCard operationalState={workbench.operationalState} />
    </div>
  );
}
