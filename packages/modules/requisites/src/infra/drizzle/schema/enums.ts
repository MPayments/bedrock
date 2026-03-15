import { pgEnum } from "drizzle-orm/pg-core";

import {
  REQUISITE_KIND_VALUES,
  REQUISITE_OWNER_TYPE_VALUES,
} from "../../../domain/requisite-kind";

export const requisiteKindEnum = pgEnum("requisite_kind", REQUISITE_KIND_VALUES);
export const requisiteOwnerTypeEnum = pgEnum(
  "requisite_owner_type",
  REQUISITE_OWNER_TYPE_VALUES,
);
