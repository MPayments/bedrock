import type {
  ReconciliationExceptionListItemDto,
  ReconciliationExternalRecordDto,
  ReconciliationRunDto,
} from "../contracts";
import type {
  ReconciliationExceptionListRow,
} from "./exceptions/ports";
import type { ReconciliationExternalRecordRecord } from "./records/ports";
import type { ReconciliationRunRecord } from "./runs/ports";

export function toReconciliationExternalRecordDto(
  record: ReconciliationExternalRecordRecord,
): ReconciliationExternalRecordDto {
  return { ...record };
}

export function toReconciliationRunDto(
  record: ReconciliationRunRecord,
): ReconciliationRunDto {
  return { ...record };
}

export function toReconciliationExceptionListItemDto(
  row: ReconciliationExceptionListRow,
): ReconciliationExceptionListItemDto {
  return {
    exception: { ...row.exception },
    run: { ...row.run },
    externalRecord: { ...row.externalRecord },
  };
}
