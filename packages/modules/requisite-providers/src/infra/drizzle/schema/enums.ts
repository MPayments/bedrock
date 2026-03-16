import { pgEnum } from "drizzle-orm/pg-core";

import { REQUISITE_KIND_VALUES } from "../../../contracts";

export const requisiteKindEnum = pgEnum("requisite_kind", REQUISITE_KIND_VALUES);
