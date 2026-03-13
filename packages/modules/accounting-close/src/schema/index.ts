import { accountingClosePackages } from "./close-packages";
import { accountingPeriodLocks } from "./period-locks";

export const schema = {
  accountingClosePackages,
  accountingPeriodLocks,
};

export { accountingClosePackages, accountingPeriodLocks };
export type {
  AccountingClosePackage,
  AccountingClosePackageState,
} from "./close-packages";
export type {
  AccountingPeriodLock,
  AccountingPeriodLockInsert,
  AccountingPeriodState,
} from "./period-locks";
