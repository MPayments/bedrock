import { and, desc, eq, lte } from "drizzle-orm";

import { canonicalJson, makePlanKey, sha256Hex } from "@multihansa/common";
import { schema } from "@multihansa/accounting/schema";

import { type PostingTemplateKey } from "./accounting-contracts";
import {
  AccountingPackCompilationError,
  AccountingPackNotFoundError,
  AccountingPackVersionConflictError,
  AccountingPostingPlanValidationError,
  AccountingTemplateAccessError,
  UnknownPostingTemplateError,
} from "./errors";
import { type AccountingRuntimeDeps } from "./internal/context";
import type {
  AccountingPackDefinition,
  CreatePostingTemplateDefinition,
  PendingPostingTemplateDefinition,
  RawPostingTemplateDefinition,
  ValueBinding,
} from "./packs/schema";

const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

export interface CreateIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planRef: string;
  bookId: string;
  postingCode: string;
  debit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  credit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  amountMinor: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
}

export interface PostPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type IntentLine =
  | CreateIntentLine
  | PostPendingIntentLine
  | VoidPendingIntentLine;

export interface OperationIntent {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  lines: IntentLine[];
}

interface CompiledPackSerializable {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
}

export type CompiledPostingTemplate =
  | (Omit<CreatePostingTemplateDefinition, "requiredRefs" | "pendingMode"> & {
      requiredRefs: string[];
      pendingMode: "allowed" | "required" | "forbidden";
    })
  | (Omit<PendingPostingTemplateDefinition, "requiredRefs"> & {
      requiredRefs: string[];
    });

export interface CompiledPack extends CompiledPackSerializable {
  checksum: string;
  templateLookup: Map<string, CompiledPostingTemplate>;
}

export interface PackValidationResult {
  ok: boolean;
  errors: string[];
}

export interface DocumentPostingPlanRequest {
  templateKey: PostingTemplateKey;
  effectiveAt: Date;
  currency: string;
  amountMinor: bigint;
  bookRefs: Record<string, string>;
  dimensions: Record<string, string>;
  refs?: Record<string, string> | null;
  pending?: {
    ref?: string | null;
    pendingId?: bigint;
    timeoutSeconds?: number;
    amountMinor?: bigint;
  } | null;
  memo?: string | null;
}

export interface DocumentPostingPlan {
  operationCode: string;
  operationVersion?: number;
  payload: Record<string, unknown>;
  requests: DocumentPostingPlanRequest[];
}

export interface ResolvedPostingTemplate {
  requestIndex: number;
  templateKey: string;
  lineType: CompiledPostingTemplate["lineType"];
  postingCode: string | null;
}

export interface ResolvePostingPlanResult {
  intent: OperationIntent;
  packChecksum: string;
  postingPlanChecksum: string;
  journalIntentChecksum: string;
  appliedTemplates: ResolvedPostingTemplate[];
}

export interface ResolvePostingPlanInput {
  accountingSourceId: string;
  source: OperationIntent["source"];
  idempotencyKey: string;
  postingDate: Date;
  at?: Date;
  bookIdContext?: string;
  plan: DocumentPostingPlan;
  pack?: CompiledPack;
}

export interface AccountingRuntime {
  compilePack: (definition: AccountingPackDefinition) => CompiledPack;
  getDefaultCompiledPack: () => CompiledPack;
  activatePackForScope: (input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) => Promise<{
    packChecksum: string;
    scopeId: string;
    scopeType: string;
    effectiveAt: Date;
  }>;
  loadActiveCompiledPackForBook: (input?: {
    bookId?: string;
    at?: Date;
  }) => Promise<CompiledPack>;
  storeCompiledPackVersion: (input: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) => Promise<CompiledPack>;
  resolvePostingPlan: (
    input: ResolvePostingPlanInput,
  ) => Promise<ResolvePostingPlanResult>;
  validatePackDefinition: (
    definition: AccountingPackDefinition,
  ) => PackValidationResult;
}

const BOOK_REF_BOOK_ID = "bookId";
const PACK_CACHE_TTL_MS = 60_000;
const PACK_SCOPE_TYPE_BOOK = "book";

interface CachedPackEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

function serializeCompiledPack(
  pack: CompiledPack,
): CompiledPackSerializable & { checksum: string } {
  return {
    packKey: pack.packKey,
    version: pack.version,
    checksum: pack.checksum,
    templates: pack.templates,
  };
}

function hydrateCompiledPack(
  compiledJson: Record<string, unknown>,
  checksumHint?: string,
): CompiledPack {
  const packKey = String(compiledJson.packKey);
  const version = Number(compiledJson.version);
  const templates = ((compiledJson.templates ?? []) as Record<string, unknown>[])
    .map((template) => {
      const allowSources =
        Array.isArray(template.allowSources) &&
        template.allowSources.every((item) => typeof item === "string")
          ? (template.allowSources as string[])
          : [];

      return {
        ...template,
        allowSources,
      } as CompiledPostingTemplate;
    })
    .sort((left, right) => left.key.localeCompare(right.key));
  const serializable: CompiledPackSerializable = {
    packKey,
    version,
    templates,
  };
  const checksum = sha256Hex(canonicalJson(serializable));

  if (checksumHint && checksum !== checksumHint) {
    throw new AccountingPackCompilationError([
      `Compiled pack checksum mismatch for ${packKey}@${version}`,
    ]);
  }

  return {
    ...serializable,
    checksum,
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}

function isCreateTemplateDefinition(
  template: RawPostingTemplateDefinition,
): template is CreatePostingTemplateDefinition {
  return template.lineType === OPERATION_TRANSFER_TYPE.CREATE;
}

function isCompiledCreateTemplate(
  template: CompiledPostingTemplate,
): template is Extract<CompiledPostingTemplate, { lineType: "create" }> {
  return template.lineType === OPERATION_TRANSFER_TYPE.CREATE;
}

function normalizeTemplate(
  template: RawPostingTemplateDefinition,
): CompiledPostingTemplate {
  if (isCreateTemplateDefinition(template)) {
    return {
      ...template,
      pendingMode: template.pendingMode ?? "forbidden",
      requiredRefs: [...(template.requiredRefs ?? [])].sort(),
      requiredBookRefs: [...template.requiredBookRefs].sort(),
      requiredDimensions: [...template.requiredDimensions].sort(),
      allowSources: [...template.allowSources].sort(),
      debit: {
        accountNo: template.debit.accountNo,
        dimensions: sortRecord(template.debit.dimensions),
      },
      credit: {
        accountNo: template.credit.accountNo,
        dimensions: sortRecord(template.credit.dimensions),
      },
    };
  }

  return {
    ...template,
    requiredRefs: [...(template.requiredRefs ?? [])].sort(),
    requiredBookRefs: [...template.requiredBookRefs].sort(),
    requiredDimensions: [...template.requiredDimensions].sort(),
    allowSources: [...template.allowSources].sort(),
  };
}

function sortRecord<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  ) as Record<string, T>;
}

function validateBindings(
  template: RawPostingTemplateDefinition,
  errors: string[],
) {
  if (!isCreateTemplateDefinition(template)) {
    return;
  }

  for (const [side, dimensions] of [
    ["debit", template.debit.dimensions],
    ["credit", template.credit.dimensions],
  ] as const) {
    for (const [dimensionKey, binding] of Object.entries(dimensions) as [
      string,
      ValueBinding,
    ][]) {
      if (binding.kind === "dimension") {
        if (!template.requiredDimensions.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared dimension "${binding.key}"`,
          );
        }
      }
      if (binding.kind === "ref") {
        if (!(template.requiredRefs ?? []).includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared ref "${binding.key}"`,
          );
        }
      }
      if (binding.kind === "bookRef") {
        if (!template.requiredBookRefs.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared bookRef "${binding.key}"`,
          );
        }
      }
    }
  }
}

export function validatePackDefinition(
  definition: AccountingPackDefinition,
): PackValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!definition.packKey.trim()) {
    errors.push("packKey must be non-empty");
  }

  if (!Number.isInteger(definition.version) || definition.version <= 0) {
    errors.push("version must be a positive integer");
  }

  for (const template of definition.templates) {
    if (seen.has(template.key)) {
      errors.push(`duplicate template key: ${template.key}`);
      continue;
    }
    seen.add(template.key);

    if (template.allowSources.length === 0) {
      errors.push(`${template.key}: allowSources must be non-empty`);
    }
    if (template.requiredBookRefs.length === 0) {
      errors.push(`${template.key}: requiredBookRefs must be non-empty`);
    }

    validateBindings(template, errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function compilePack(
  definition: AccountingPackDefinition,
): CompiledPack {
  const validation = validatePackDefinition(definition);
  if (!validation.ok) {
    throw new AccountingPackCompilationError(validation.errors);
  }

  const templates = [...definition.templates]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((template) => normalizeTemplate(template));

  const serializable: CompiledPackSerializable = {
    packKey: definition.packKey,
    version: definition.version,
    templates,
  };

  return {
    ...serializable,
    checksum: sha256Hex(canonicalJson(serializable)),
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}

function resolveBindingValue(
  request: DocumentPostingPlanRequest,
  binding: ValueBinding,
): string {
  if (binding.kind === "literal") {
    return binding.value;
  }

  if (binding.kind === "dimension") {
    const value = request.dimensions[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing dimension "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  if (binding.kind === "ref") {
    const value = request.refs?.[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing ref "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  const value = request.bookRefs[binding.key];
  if (!value) {
    throw new AccountingPostingPlanValidationError(
      `Missing bookRef "${binding.key}" for template ${request.templateKey}`,
    );
  }
  return value;
}

function buildPlanRef(request: DocumentPostingPlanRequest): string {
  return makePlanKey(request.templateKey, {
    amountMinor: request.amountMinor,
    bookRefs: request.bookRefs,
    currency: request.currency,
    dimensions: request.dimensions,
    effectiveAt: request.effectiveAt,
    pending: request.pending ?? null,
    refs: request.refs ?? null,
  });
}

function readRequiredBookId(request: DocumentPostingPlanRequest): string {
  const bookId = request.bookRefs[BOOK_REF_BOOK_ID];
  if (!bookId) {
    throw new AccountingPostingPlanValidationError(
      `Posting plan requires bookRefs.${BOOK_REF_BOOK_ID}`,
    );
  }

  return bookId;
}

function resolveBookIdContext(input: ResolvePostingPlanInput): string {
  if (input.plan.requests.length === 0) {
    throw new AccountingPostingPlanValidationError(
      "Posting plan must include at least one request",
    );
  }

  const requestBookIds = input.plan.requests.map((request) =>
    readRequiredBookId(request),
  );

  if (input.bookIdContext) {
    if (!requestBookIds.includes(input.bookIdContext)) {
      throw new AccountingPostingPlanValidationError(
        `Posting plan ${BOOK_REF_BOOK_ID} set must include bookIdContext`,
      );
    }

    return input.bookIdContext;
  }

  return requestBookIds[0]!;
}

function validateRequestShape(
  request: DocumentPostingPlanRequest,
  template: CompiledPostingTemplate,
) {
  for (const key of template.requiredBookRefs) {
    if (!request.bookRefs[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires bookRef "${key}"`,
      );
    }
  }

  for (const key of template.requiredDimensions) {
    if (!request.dimensions[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires dimension "${key}"`,
      );
    }
  }

  for (const key of template.requiredRefs) {
    if (!request.refs?.[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires ref "${key}"`,
      );
    }
  }

  if (isCompiledCreateTemplate(template)) {
    if (request.amountMinor <= 0n) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires amountMinor > 0`,
      );
    }

    if (template.pendingMode === "required") {
      if (!request.pending?.timeoutSeconds) {
        throw new AccountingPostingPlanValidationError(
          `Template ${template.key} requires pending.timeoutSeconds`,
        );
      }
    }

    if (template.pendingMode === "forbidden" && request.pending) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} does not allow pending config`,
      );
    }

    return;
  }

  if (!request.pending?.pendingId || request.pending.pendingId <= 0n) {
    throw new AccountingPostingPlanValidationError(
      `Template ${template.key} requires pending.pendingId`,
    );
  }
}

function resolveCreateLine(
  request: DocumentPostingPlanRequest,
  template: Extract<CompiledPostingTemplate, { lineType: "create" }>,
): CreateIntentLine {
  return {
    type: OPERATION_TRANSFER_TYPE.CREATE,
    planRef: buildPlanRef(request),
    bookId: readRequiredBookId(request),
    postingCode: template.postingCode,
    debit: {
      accountNo: template.debit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.debit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    credit: {
      accountNo: template.credit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.credit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    amountMinor: request.amountMinor,
    code: template.transferCode,
    pending: request.pending
      ? {
          timeoutSeconds: request.pending.timeoutSeconds!,
          ref: request.pending.ref ?? null,
        }
      : undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };
}

function resolvePendingLine(
  request: DocumentPostingPlanRequest,
  template: Extract<
    CompiledPostingTemplate,
    { lineType: "post_pending" | "void_pending" }
  >,
): PostPendingIntentLine | VoidPendingIntentLine {
  const base = {
    planRef: buildPlanRef(request),
    currency: request.currency,
    pendingId: request.pending!.pendingId!,
    code: undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };

  if (template.lineType === OPERATION_TRANSFER_TYPE.POST_PENDING) {
    return {
      type: OPERATION_TRANSFER_TYPE.POST_PENDING,
      ...base,
      amount: request.pending?.amountMinor ?? 0n,
    };
  }

  return {
    type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
    ...base,
  };
}

async function resolvePostingPlanInternal(
  input: ResolvePostingPlanInput,
  compiledPack: CompiledPack,
): Promise<ResolvePostingPlanResult> {
  const { accountingSourceId, plan } = input;
  const lines: IntentLine[] = [];
  const appliedTemplates: ResolvedPostingTemplate[] = [];

  for (const [requestIndex, request] of plan.requests.entries()) {
    const template = compiledPack.templateLookup.get(request.templateKey);
    if (!template) {
      throw new UnknownPostingTemplateError(request.templateKey);
    }

    if (!template.allowSources.includes(accountingSourceId)) {
      throw new AccountingTemplateAccessError(accountingSourceId, template.key);
    }

    validateRequestShape(request, template);

    const line = isCompiledCreateTemplate(template)
      ? resolveCreateLine(request, template)
      : resolvePendingLine(request, template);

    lines.push(line);
    appliedTemplates.push({
      requestIndex,
      templateKey: template.key,
      lineType: template.lineType,
      postingCode: isCompiledCreateTemplate(template)
        ? template.postingCode
        : null,
    });
  }

  const intent: OperationIntent = {
    source: input.source,
    operationCode: plan.operationCode,
    operationVersion: plan.operationVersion ?? 1,
    payload: plan.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    lines,
  };

  return {
    intent,
    packChecksum: compiledPack.checksum,
    postingPlanChecksum: sha256Hex(canonicalJson(plan)),
    journalIntentChecksum: sha256Hex(canonicalJson(intent)),
    appliedTemplates,
  };
}

export function createAccountingRuntime(
  deps: AccountingRuntimeDeps,
): AccountingRuntime {
  const { db } = deps;
  const defaultCompiledPack = compilePack(deps.defaultPackDefinition);
  const packCache = new Map<string, CachedPackEntry>();

  function readCachedPack(key: string) {
    const cached = packCache.get(key);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt < Date.now()) {
      packCache.delete(key);
      return undefined;
    }

    return cached.value;
  }

  function writeCachedPack(key: string, value: CompiledPack | null) {
    packCache.set(key, {
      value,
      expiresAt: Date.now() + PACK_CACHE_TTL_MS,
    });
  }

  function requireDb() {
    if (!db) {
      throw new Error("Accounting runtime requires db for pack persistence");
    }
    return db;
  }

  async function storeCompiledPackVersion(input: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) {
    const runtimeDb = requireDb();
    const compiled =
      input.pack ??
      (input.definition ? compilePack(input.definition) : defaultCompiledPack);
    const serializedCompiled = serializeCompiledPack(compiled) as unknown as Record<
      string,
      unknown
    >;
    let replacedChecksum: string | null = null;

    const stored = await runtimeDb.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          checksum: schema.accountingPackVersions.checksum,
          compiledJson: schema.accountingPackVersions.compiledJson,
        })
        .from(schema.accountingPackVersions)
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, compiled.packKey),
            eq(schema.accountingPackVersions.version, compiled.version),
          ),
        )
        .limit(1);

      if (!existing) {
        await tx.insert(schema.accountingPackVersions).values({
          packKey: compiled.packKey,
          version: compiled.version,
          checksum: compiled.checksum,
          compiledJson: serializedCompiled,
        });
        return compiled;
      }

      const existingPack = hydrateCompiledPack(
        existing.compiledJson as Record<string, unknown>,
      );
      const checksumMatches = existing.checksum === compiled.checksum;
      const payloadMatches = existingPack.checksum === compiled.checksum;

      if (checksumMatches && payloadMatches) {
        return existingPack;
      }

      if (!checksumMatches) {
        const [assignment] = await tx
          .select({ id: schema.accountingPackAssignments.id })
          .from(schema.accountingPackAssignments)
          .where(
            eq(schema.accountingPackAssignments.packChecksum, existing.checksum),
          )
          .limit(1);

        if (assignment) {
          throw new AccountingPackVersionConflictError(
            compiled.packKey,
            compiled.version,
            existing.checksum,
            compiled.checksum,
          );
        }
      }

      await tx
        .update(schema.accountingPackVersions)
        .set({
          checksum: compiled.checksum,
          compiledJson: serializedCompiled,
          compiledAt: new Date(),
        })
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, compiled.packKey),
            eq(schema.accountingPackVersions.version, compiled.version),
          ),
        );

      if (existing.checksum !== compiled.checksum) {
        replacedChecksum = existing.checksum;
      }

      return compiled;
    });

    if (replacedChecksum) {
      writeCachedPack(replacedChecksum, null);
    }
    writeCachedPack(stored.checksum, stored);
    return stored;
  }

  async function loadCompiledPackByChecksum(checksum: string) {
    const runtimeDb = requireDb();
    const cached = readCachedPack(checksum);
    if (typeof cached !== "undefined") {
      return cached;
    }

    const [row] = await runtimeDb
      .select({
        checksum: schema.accountingPackVersions.checksum,
        compiledJson: schema.accountingPackVersions.compiledJson,
      })
      .from(schema.accountingPackVersions)
      .where(eq(schema.accountingPackVersions.checksum, checksum))
      .limit(1);

    if (!row) {
      writeCachedPack(checksum, null);
      return null;
    }

    const pack = hydrateCompiledPack(row.compiledJson as Record<string, unknown>);
    writeCachedPack(checksum, pack);
    if (pack.checksum !== checksum) {
      writeCachedPack(pack.checksum, pack);
    }
    return pack;
  }

  async function activatePackForScope(input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) {
    const runtimeDb = requireDb();
    const pack = await loadCompiledPackByChecksum(input.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(input.packChecksum);
    }

    const scopeType = input.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = input.effectiveAt ?? new Date();

    await runtimeDb.insert(schema.accountingPackAssignments).values({
      scopeType,
      scopeId: input.scopeId,
      packChecksum: input.packChecksum,
      effectiveAt,
    });

    writeCachedPack(
      `scope:${scopeType}:${input.scopeId}:${effectiveAt.toISOString()}`,
      pack,
    );

    return {
      packChecksum: input.packChecksum,
      scopeId: input.scopeId,
      scopeType,
      effectiveAt,
    };
  }

  async function loadActiveCompiledPackForBook(input?: {
    bookId?: string;
    at?: Date;
  }) {
    if (!input?.bookId) {
      throw new AccountingPostingPlanValidationError(
        `Active pack lookup requires ${BOOK_REF_BOOK_ID}`,
      );
    }

    if (!db) {
      return defaultCompiledPack;
    }

    const at = input.at ?? new Date();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${input.bookId}:${at.toISOString()}`;
    const cached = readCachedPack(scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const [assignment] = await db
      .select({
        packChecksum: schema.accountingPackAssignments.packChecksum,
      })
      .from(schema.accountingPackAssignments)
      .where(
        and(
          eq(schema.accountingPackAssignments.scopeType, PACK_SCOPE_TYPE_BOOK),
          eq(schema.accountingPackAssignments.scopeId, input.bookId),
          lte(schema.accountingPackAssignments.effectiveAt, at),
        ),
      )
      .orderBy(desc(schema.accountingPackAssignments.effectiveAt))
      .limit(1);

    if (!assignment) {
      writeCachedPack(scopeCacheKey, defaultCompiledPack);
      return defaultCompiledPack;
    }

    const pack = await loadCompiledPackByChecksum(assignment.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(assignment.packChecksum);
    }

    writeCachedPack(scopeCacheKey, pack);
    return pack;
  }

  async function resolvePostingPlan(input: ResolvePostingPlanInput) {
    const bookId = resolveBookIdContext(input);

    const pack =
      input.pack ??
      (await loadActiveCompiledPackForBook({
        bookId,
        at: input.at ?? input.postingDate,
      }));
    return resolvePostingPlanInternal(input, pack);
  }

  return {
    compilePack,
    activatePackForScope,
    getDefaultCompiledPack: () => defaultCompiledPack,
    loadActiveCompiledPackForBook,
    storeCompiledPackVersion,
    resolvePostingPlan,
    validatePackDefinition,
  };
}
