import { and, eq, isNull } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import {
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
} from "./constants";
import {
  createAccountingServiceContext,
  type AccountingServiceDeps,
} from "./internal/context";
import {
  replaceCorrespondenceRulesSchema,
  upsertOrgAccountOverrideSchema,
  type ReplaceCorrespondenceRulesInput,
  type UpsertOrgAccountOverrideInput,
} from "./validation";

export type AccountingService = ReturnType<typeof createAccountingService>;

export function createAccountingService(deps: AccountingServiceDeps) {
  const context = createAccountingServiceContext(deps);
  const { db, log } = context;

  async function seedTemplateAndGlobalRules() {
    for (const account of DEFAULT_CHART_TEMPLATE_ACCOUNTS) {
      await db
        .insert(schema.chartTemplateAccounts)
        .values({
          accountNo: account.accountNo,
          name: account.name,
          kind: account.kind,
          normalSide: account.normalSide,
          postingAllowed: account.postingAllowed,
          parentAccountNo: null,
        })
        .onConflictDoUpdate({
          target: schema.chartTemplateAccounts.accountNo,
          set: {
            name: account.name,
            kind: account.kind,
            normalSide: account.normalSide,
            postingAllowed: account.postingAllowed,
          },
        });
    }

    for (const rule of DEFAULT_GLOBAL_CORRESPONDENCE_RULES) {
      await db
        .insert(schema.correspondenceRules)
        .values({
          scope: "global",
          orgId: null,
          postingCode: rule.postingCode,
          debitAccountNo: rule.debitAccountNo,
          creditAccountNo: rule.creditAccountNo,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: [
            schema.correspondenceRules.scope,
            schema.correspondenceRules.orgId,
            schema.correspondenceRules.postingCode,
            schema.correspondenceRules.debitAccountNo,
            schema.correspondenceRules.creditAccountNo,
          ],
          set: {
            enabled: true,
          },
        });
    }
  }

  async function seedDefaults(orgId: string) {
    await seedTemplateAndGlobalRules();

    return db.transaction(async (tx) => {
      const templateAccounts = await tx
        .select()
        .from(schema.chartTemplateAccounts)
        .orderBy(schema.chartTemplateAccounts.accountNo);

      if (templateAccounts.length > 0) {
        await tx
          .insert(schema.chartOrgOverrides)
          .values(
            templateAccounts.map((account) => ({
              orgId,
              accountNo: account.accountNo,
              enabled: true,
              nameOverride: null,
            })),
          )
          .onConflictDoNothing();
      }

      const globalRules = await tx
        .select({
          postingCode: schema.correspondenceRules.postingCode,
          debitAccountNo: schema.correspondenceRules.debitAccountNo,
          creditAccountNo: schema.correspondenceRules.creditAccountNo,
        })
        .from(schema.correspondenceRules)
        .where(
          and(
            eq(schema.correspondenceRules.scope, "global"),
            isNull(schema.correspondenceRules.orgId),
            eq(schema.correspondenceRules.enabled, true),
          ),
        );

      if (globalRules.length > 0) {
        await tx
          .insert(schema.correspondenceRules)
          .values(
            globalRules.map((rule) => ({
              scope: "org" as const,
              orgId,
              postingCode: rule.postingCode,
              debitAccountNo: rule.debitAccountNo,
              creditAccountNo: rule.creditAccountNo,
              enabled: true,
            })),
          )
          .onConflictDoUpdate({
            target: [
              schema.correspondenceRules.scope,
              schema.correspondenceRules.orgId,
              schema.correspondenceRules.postingCode,
              schema.correspondenceRules.debitAccountNo,
              schema.correspondenceRules.creditAccountNo,
            ],
            set: {
              enabled: true,
            },
          });
      }

      log.info("Seeded accounting defaults", { orgId });
      return { seeded: true, accounts: templateAccounts.length, rules: globalRules.length };
    });
  }

  async function listTemplateAccounts() {
    return db
      .select()
      .from(schema.chartTemplateAccounts)
      .orderBy(schema.chartTemplateAccounts.accountNo);
  }

  async function listOrgAccounts(orgId: string) {
    const [templateAccounts, overrides] = await Promise.all([
      db
        .select()
        .from(schema.chartTemplateAccounts)
        .orderBy(schema.chartTemplateAccounts.accountNo),
      db
        .select()
        .from(schema.chartOrgOverrides)
        .where(eq(schema.chartOrgOverrides.orgId, orgId)),
    ]);

    const overrideByNo = new Map(overrides.map((row) => [row.accountNo, row]));

    return templateAccounts.map((base) => {
      const override = overrideByNo.get(base.accountNo);
      return {
        orgId,
        accountNo: base.accountNo,
        name: override?.nameOverride ?? base.name,
        kind: base.kind,
        normalSide: base.normalSide,
        postingAllowed: base.postingAllowed,
        enabled: override?.enabled ?? true,
      };
    });
  }

  async function upsertOrgAccountOverride(
    orgId: string,
    accountNo: string,
    input: UpsertOrgAccountOverrideInput,
  ) {
    const validated = upsertOrgAccountOverrideSchema.parse(input);

    const [row] = await db
      .insert(schema.chartOrgOverrides)
      .values({
        orgId,
        accountNo,
        enabled: validated.enabled,
        nameOverride: validated.nameOverride ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.chartOrgOverrides.orgId, schema.chartOrgOverrides.accountNo],
        set: {
          enabled: validated.enabled,
          nameOverride: validated.nameOverride ?? null,
        },
      })
      .returning();

    return row!;
  }

  async function listCorrespondenceRules(orgId: string) {
    return db
      .select()
      .from(schema.correspondenceRules)
      .where(
        and(
          eq(schema.correspondenceRules.scope, "org"),
          eq(schema.correspondenceRules.orgId, orgId),
        ),
      )
      .orderBy(
        schema.correspondenceRules.postingCode,
        schema.correspondenceRules.debitAccountNo,
        schema.correspondenceRules.creditAccountNo,
      );
  }

  async function replaceCorrespondenceRules(
    orgId: string,
    input: ReplaceCorrespondenceRulesInput,
  ) {
    const validated = replaceCorrespondenceRulesSchema.parse(input);

    return db.transaction(async (tx) => {
      await tx
        .delete(schema.correspondenceRules)
        .where(
          and(
            eq(schema.correspondenceRules.scope, "org"),
            eq(schema.correspondenceRules.orgId, orgId),
          ),
        );

      if (validated.rules.length === 0) {
        return [];
      }

      return tx
        .insert(schema.correspondenceRules)
        .values(
          validated.rules.map((rule) => ({
            scope: "org" as const,
            orgId,
            postingCode: rule.postingCode,
            debitAccountNo: rule.debitAccountNo,
            creditAccountNo: rule.creditAccountNo,
            enabled: rule.enabled,
          })),
        )
        .returning();
    });
  }

  return {
    seedTemplateAndGlobalRules,
    seedDefaults,
    listTemplateAccounts,
    listOrgAccounts,
    upsertOrgAccountOverride,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
  };
}
