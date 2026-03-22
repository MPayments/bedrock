import defaultPackRaw from "../assets/default-pack.json" with { type: "json" };
import {
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
} from "../constants";
import { AccountingPackDefinitionSchema } from "./schema";
import { validatePackDefinition } from "./domain/compile-pack";

const parsedRawPackDefinition = AccountingPackDefinitionSchema.parse(
  defaultPackRaw as unknown,
);

const defaultPackValidation = validatePackDefinition(parsedRawPackDefinition, {
  knownAccountNos: DEFAULT_CHART_TEMPLATE_ACCOUNTS.map((account) => account.accountNo),
  knownPostingCodes: DEFAULT_GLOBAL_CORRESPONDENCE_RULES.map(
    (rule) => rule.postingCode,
  ),
});

if (!defaultPackValidation.ok) {
  throw new Error(
    `Default accounting pack is invalid: ${defaultPackValidation.errors.join("; ")}`,
  );
}

export const rawPackDefinition = parsedRawPackDefinition;
