import { z } from "zod";

export const AccountingPeriodStateSchema = z.enum(["closed", "reopened"]);
export const AccountingClosePackageStateSchema = z.enum([
  "closed",
  "superseded",
]);

export const AccountingPeriodDateTimeSchema = z.iso.datetime();
